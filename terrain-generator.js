// Pure, seeded terrain generation. Version 1 keeps saved seeds reproducible.
(() => {
  const SIZE = 96;
  const DEFAULTS = { seed: 'Morgenwald', water: 38, relief: 65, forest: 45 };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function normalizeSettings(input = {}) {
    const number = (key, min, max) => {
      const value = input[key];
      return typeof value === 'number' && Number.isFinite(value)
        ? clamp(Math.round(value), min, max) : DEFAULTS[key];
    };
    return {
      seed: typeof input.seed === 'string' && input.seed.trim()
        ? input.seed.trim().slice(0, 80) : DEFAULTS.seed,
      water: number('water', 15, 65),
      relief: number('relief', 0, 100),
      forest: number('forest', 0, 100)
    };
  }

  function seedHash(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return hash >>> 0;
  }

  function randomAt(seed, x, y) {
    let value = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  }

  function noise(seed, x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = randomAt(seed, ix, iy), b = randomAt(seed, ix + 1, iy);
    const c = randomAt(seed, ix, iy + 1), d = randomAt(seed, ix + 1, iy + 1);
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  }

  function generate(input) {
    const settings = normalizeSettings(input);
    const seed = seedHash(settings.seed);
    const height = new Float32Array(SIZE * SIZE);
    const moisture = new Float32Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const nx = x / (SIZE - 1), ny = y / (SIZE - 1);
        const distance = Math.hypot((nx - .5) * 2, (ny - .5) * 2);
        const hills = noise(seed, nx * 4 + 11, ny * 4 + 17) * .60
          + noise(seed + 1, nx * 9, ny * 9) * .27
          + noise(seed + 2, nx * 22, ny * 22) * .13;
        height[y * SIZE + x] = clamp(.28 + hills * .68 - Math.pow(distance, 2.5) * .82, 0, 1);
        moisture[y * SIZE + x] = noise(seed + 3, nx * 7, ny * 7);
      }
    }
    const world = { version: 1, size: SIZE, settings, seed, height, moisture, edits: new Map(), mode: 'island' };
    refreshDetails(world);
    return world;
  }

  function heightAt(world, x, y) {
    return world.edits.get(`${x},${y}`) ?? (x >= 0 && y >= 0 && x < world.size && y < world.size
      ? world.height[y * world.size + x] : 0);
  }

  function moistureAt(world, x, y) {
    return noise(world.seed + 3, x / (SIZE - 1) * 7, y / (SIZE - 1) * 7);
  }

  function refreshDetails(world) {
    const { settings, seed } = world;
    const trees = [];
    const water = settings.water / 100;
    let land = 0;
    for (let y = 1; y < SIZE - 1; y++) {
      for (let x = 1; x < SIZE - 1; x++) {
        const h = heightAt(world, x, y);
        if (h > water) land++;
      }
    }
    const candidates = new Set();
    for (let y = 0; y < SIZE; y += 2) for (let x = 0; x < SIZE; x += 2) candidates.add(`${x},${y}`);
    for (const key of world.edits.keys()) {
      const [x, y] = key.split(',').map(Number);
      if (x % 2 === 0 && y % 2 === 0) candidates.add(key);
    }
    for (const key of candidates) {
      const [x, y] = key.split(',').map(Number), h = heightAt(world, x, y);
      const slope = Math.abs(heightAt(world, x + 1, y) - heightAt(world, x - 1, y))
        + Math.abs(heightAt(world, x, y + 1) - heightAt(world, x, y - 1));
      if (h > water + .035 && h < .72 && slope < .10
        && randomAt(seed + 4, x, y) < settings.forest / 100 * moistureAt(world, x, y) * .65) {
        trees.push({ x, y, height: h, variant: randomAt(seed + 5, x, y) });
      }
    }
    world.trees = trees;
    world.landPercent = Math.round(land / ((SIZE - 2) ** 2) * 100);
  }

  // A soft capsule between successive pointer samples keeps fast strokes connected.
  function raise(world, from, to, radius, amount, ceiling = 1.4) {
    if (![from.x, from.y, to.x, to.y, radius, amount, ceiling].every(Number.isFinite) || radius <= 0 || amount <= 0) return false;
    radius = clamp(radius, 2, 20);
    amount = Math.min(amount, .2);
    const dx = to.x - from.x, dy = to.y - from.y, length2 = dx * dx + dy * dy;
    if (length2 > 1000000 || Math.max(Math.abs(to.x), Math.abs(to.y), Math.abs(from.x), Math.abs(from.y)) > 1000000) return false;
    let changed = false;
    for (let y = Math.floor(Math.min(from.y, to.y) - radius); y <= Math.ceil(Math.max(from.y, to.y) + radius); y++) {
      for (let x = Math.floor(Math.min(from.x, to.x) - radius); x <= Math.ceil(Math.max(from.x, to.x) + radius); x++) {
        const t = length2 ? clamp(((x - from.x) * dx + (y - from.y) * dy) / length2, 0, 1) : 0;
        const distance = Math.hypot(x - from.x - t * dx, y - from.y - t * dy) / radius;
        if (distance >= 1) continue;
        const weight = (1 - distance * distance) ** 2;
        const old = heightAt(world, x, y);
        const limit = clamp(ceiling, 0, 1.4);
        if (old >= limit) continue;
        // Approach the coast faster underwater, without any instantaneous lift.
        // Consume the time budget before continuing at the gentler land speed.
        const coast = Math.max(0, world.settings.water / 100 - .015);
        const budget = amount * weight;
        const underwater = Math.min(Math.max(0, coast - old), budget * 8);
        const next = Math.min(limit, old + underwater + Math.max(0, budget - underwater / 8));
        if (next !== old) { world.edits.set(`${x},${y}`, next); changed = true; }
      }
    }
    return changed;
  }

  // Integrate exposure along the path instead of adding a bonus per mouse event.
  // Spatial sampling keeps the same stroke comparable on slow and fast mice.
  function raiseTimed(world, from, to, radius, seconds, strength, ceiling = 1.4) {
    if (![from.x, from.y, to.x, to.y, radius, seconds, strength, ceiling].every(Number.isFinite)
      || seconds <= 0 || radius <= 0 || strength <= 0) return false;
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    if (distance > 1000) return false;
    const steps = Math.max(1, Math.ceil(distance / Math.max(.5, radius / 4)));
    const amount = seconds * clamp(strength, 1, 100) / 100 * .12 / steps;
    let changed = false;
    for (let i = 0; i < steps; i++) {
      const t = (i + .5) / steps;
      const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      changed = raise(world, point, point, radius, amount, ceiling) || changed;
    }
    return changed;
  }

  function serialize(world) {
    return { version: 2, settings: world.settings, mode: world.mode,
      edits: Array.from(world.edits, ([key, value]) => [...key.split(',').map(Number), value]) };
  }

  function restore(data) {
    if (!data || ![1, 2].includes(data.version)) throw new Error('Ungültige Landschaft');
    const world = generate(data.settings);
    if (data.mode === 'ocean') { world.mode = 'ocean'; world.height.fill(0); }
    if (data.version === 2) {
      if (!Array.isArray(data.edits) || data.edits.length > 200000) throw new Error('Ungültige Geländeänderungen');
      for (const entry of data.edits) {
        if (!Array.isArray(entry) || entry.length !== 3 || !entry.every(Number.isFinite)
          || !Number.isInteger(entry[0]) || !Number.isInteger(entry[1])
          || Math.abs(entry[0]) > 1000020 || Math.abs(entry[1]) > 1000020 || entry[2] < 0 || entry[2] > 1.4) throw new Error('Ungültiger Höhenwert');
        world.edits.set(`${entry[0]},${entry[1]}`, entry[2]);
      }
    }
    refreshDetails(world);
    return world;
  }

  const api = { DEFAULTS, normalizeSettings, generate, randomAt, heightAt, moistureAt, refreshDetails, raise, raiseTimed, serialize, restore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.DND_TERRAIN = api;
})();
