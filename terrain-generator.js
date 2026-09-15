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
    const world = { version: 1, size: SIZE, settings, seed, height, moisture, edits: new Map(), forestEdits: new Map(), waterEdits: new Map(), buildings: [], mode: 'island' };
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

  function waterAt(world, x, y) {
    return Math.max(world.settings.water / 100, world.waterEdits.get(`${x},${y}`) ?? 0);
  }

  function buildingBounds(building) {
    const turned = building.rotation % 180 !== 0;
    const rx = turned ? 3 : 2, ry = turned ? 2 : 3;
    return { minX: building.x - rx, maxX: building.x + rx, minY: building.y - ry, maxY: building.y + ry };
  }

  function buildingSurface(world, building) {
    const bounds = buildingBounds(building);
    let min = Infinity, max = -Infinity, water = 0, wet = false;
    for (let y = bounds.minY; y <= bounds.maxY; y++) for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const h = heightAt(world, x, y);
      min = Math.min(min, h); max = Math.max(max, h);
      water = Math.max(water, waterAt(world, x, y));
      wet ||= h <= waterAt(world, x, y) + .008;
    }
    return { min, max, height: Math.max(max, water) + .004, wet };
  }

  function buildingPlacement(world, point, rotation = 0, ignoreId = null) {
    if (!point || ![point.x, point.y, rotation].every(Number.isFinite)
      || Math.max(Math.abs(point.x), Math.abs(point.y)) > 999000) return { valid: false, reason: 'Außerhalb des Baubereichs.' };
    const building = { type: 'house', x: Math.round(point.x), y: Math.round(point.y),
      rotation: ((Math.round(rotation / 90) * 90) % 360 + 360) % 360 };
    const surface = buildingSurface(world, building), bounds = buildingBounds(building);
    let reason = '';
    if (surface.wet) reason = 'Hier ist Wasser oder das Ufer zu nah.';
    else if (surface.max - surface.min > .045) reason = 'Dieser Hang ist zu steil. Zuerst eine ebene Baufläche formen.';
    else if (world.buildings.some(other => {
      if (other.id === ignoreId) return false;
      const b = buildingBounds(other);
      return bounds.minX < b.maxX + 1 && bounds.maxX > b.minX - 1
        && bounds.minY < b.maxY + 1 && bounds.maxY > b.minY - 1;
    })) reason = 'Zu nah an einem anderen Gebäude.';
    else if (ignoreId === null && world.buildings.length >= 1000) reason = 'Die Grenze von 1000 Gebäuden ist erreicht.';
    return { building, ...surface, valid: !reason, reason };
  }

  function placeBuilding(world, point, rotation = 0) {
    const placement = buildingPlacement(world, point, rotation);
    if (!placement.valid) return null;
    const id = world.buildings.reduce((max, building) => Math.max(max, building.id), 0) + 1;
    if (!Number.isSafeInteger(id)) return null;
    const building = { id, ...placement.building };
    world.buildings.push(building); refreshDetails(world);
    return building;
  }

  function removeBuilding(world, id) {
    const index = world.buildings.findIndex(building => building.id === id);
    if (index < 0) return false;
    world.buildings.splice(index, 1); refreshDetails(world);
    return true;
  }

  function rotateBuilding(world, id, rotation) {
    const building = world.buildings.find(building => building.id === id);
    if (!building) return { valid: false, reason: 'Kein Haus ausgewählt.' };
    const placement = buildingPlacement(world, building, rotation, id);
    if (placement.valid) { building.rotation = placement.building.rotation; refreshDetails(world); }
    return placement;
  }

  function refreshDetails(world) {
    const { settings, seed } = world;
    const trees = [];
    // Protect the footprint and a narrow apron from later terrain brushes.
    // Trees are hidden around the roof, without destroying the forest settings.
    world.buildingGround = new Set();
    const treeExclusion = new Set();
    for (const building of world.buildings) {
      const b = buildingBounds(building);
      for (let y = b.minY - 2; y <= b.maxY + 2; y++) for (let x = b.minX - 2; x <= b.maxX + 2; x++) {
        treeExclusion.add(`${x},${y}`);
        if (x >= b.minX - 1 && x <= b.maxX + 1 && y >= b.minY - 1 && y <= b.maxY + 1) world.buildingGround.add(`${x},${y}`);
      }
    }
    let land = 0;
    for (let y = 1; y < SIZE - 1; y++) {
      for (let x = 1; x < SIZE - 1; x++) {
        const h = heightAt(world, x, y);
        if (h > waterAt(world, x, y)) land++;
      }
    }
    const candidates = new Set();
    for (let y = 0; y < SIZE; y += 2) for (let x = 0; x < SIZE; x += 2) candidates.add(`${x},${y}`);
    for (const key of world.edits.keys()) {
      const [x, y] = key.split(',').map(Number);
      if (x % 2 === 0 && y % 2 === 0) candidates.add(key);
    }
    for (const key of world.forestEdits.keys()) candidates.add(key);
    for (const key of candidates) {
      if (treeExclusion.has(key)) continue;
      const [x, y] = key.split(',').map(Number), h = heightAt(world, x, y);
      const slope = Math.abs(heightAt(world, x + 1, y) - heightAt(world, x - 1, y))
        + Math.abs(heightAt(world, x, y + 1) - heightAt(world, x, y - 1));
      const manual = world.forestEdits.has(key);
      const density = manual ? world.forestEdits.get(key) / 100 : settings.forest / 100 * moistureAt(world, x, y) * .65;
      if (h > waterAt(world, x, y) + (manual ? .015 : .035) && h < (manual ? .9 : .72) && slope < (manual ? .16 : .10)
        && randomAt(seed + 4, x, y) < density) {
        trees.push({ x, y, height: h, type: 'fir', variant: randomAt(seed + 5, x, y) });
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
        if (world.buildingGround.has(`${x},${y}`)) continue;
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
        if (next !== old) {
          const key = `${x},${y}`;
          world.edits.set(key, next);
          if (next >= (world.waterEdits.get(key) ?? Infinity)) world.waterEdits.delete(key);
          changed = true;
        }
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

  // Keep the original surface for the entire stroke: holding or crossing the
  // same spot cannot excavate an ever deeper hole on every animation frame.
  function beginWaterStroke(world, point, depth, mode = 'lake') {
    const source = { ...world, edits: new Map(world.edits), waterEdits: new Map(world.waterEdits) };
    const x = Math.round(point.x), y = Math.round(point.y);
    return { source, depth: clamp(depth, 1, 100) / 1000, mode,
      level: Math.max(heightAt(source, x, y), waterAt(source, x, y)) - clamp(depth, 1, 100) / 5000 };
  }

  function paintWater(world, from, to, radius, depth, stroke = null) {
    if (![from.x, from.y, to.x, to.y, radius, depth].every(Number.isFinite) || radius <= 0 || depth <= 0) return false;
    radius = clamp(radius, 2, 30);
    const dx = to.x - from.x, dy = to.y - from.y, length2 = dx * dx + dy * dy;
    if (length2 > 1000000 || Math.max(Math.abs(from.x), Math.abs(from.y), Math.abs(to.x), Math.abs(to.y)) > 1000000) return false;
    stroke ||= beginWaterStroke(world, from, depth);
    let changed = false;
    for (let y = Math.floor(Math.min(from.y, to.y) - radius); y <= Math.ceil(Math.max(from.y, to.y) + radius); y++) {
      for (let x = Math.floor(Math.min(from.x, to.x) - radius); x <= Math.ceil(Math.max(from.x, to.x) + radius); x++) {
        const t = length2 ? clamp(((x - from.x) * dx + (y - from.y) * dy) / length2, 0, 1) : 0;
        const distance = Math.hypot(x - from.x - t * dx, y - from.y - t * dy) / radius;
        if (distance >= 1) continue;
        if (world.buildingGround.has(`${x},${y}`)) continue;
        const key = `${x},${y}`, original = heightAt(stroke.source, x, y);
        const sea = world.settings.water / 100;
        const existingWater = stroke.source.waterEdits.get(key);
        const surface = Math.max(original, existingWater ?? 0);
        if (surface <= sea) continue;
        const cut = stroke.depth * (1 - distance * distance) ** 2;
        const bed = Math.max(0, original - cut);
        // Lakes have one level per stroke; rivers follow the local terrain.
        // Reject low banks so a lake never adds floating water above the ground.
        const level = Math.max(sea, existingWater ?? (stroke.mode === 'river' ? surface - cut * .2 : stroke.level));
        if ((level >= surface && existingWater === undefined) || bed >= level) continue;
        const next = Math.min(heightAt(world, x, y), bed);
        if (next !== heightAt(world, x, y)) { world.edits.set(key, next); changed = true; }
        const nextLevel = Math.min(world.waterEdits.get(key) ?? Infinity, level);
        if (nextLevel > sea && world.waterEdits.get(key) !== nextLevel) {
          world.waterEdits.set(key, nextLevel); changed = true;
        }
      }
    }
    return changed;
  }

  function serialize(world) {
    return { version: 5, settings: world.settings, mode: world.mode,
      buildings: world.buildings.map(building => ({ ...building })),
      edits: Array.from(world.edits, ([key, value]) => [...key.split(',').map(Number), value]),
      forestEdits: Array.from(world.forestEdits, ([key, value]) => [...key.split(',').map(Number), value]),
      waterEdits: Array.from(world.waterEdits, ([key, value]) => [...key.split(',').map(Number), value]) };
  }

  function restore(data) {
    if (!data || ![1, 2, 3, 4, 5].includes(data.version)) throw new Error('Ungültige Landschaft');
    const world = generate(data.settings);
    if (data.mode === 'ocean') { world.mode = 'ocean'; world.height.fill(0); }
    if (data.version >= 2) {
      if (!Array.isArray(data.edits) || data.edits.length > 200000) throw new Error('Ungültige Geländeänderungen');
      for (const entry of data.edits) {
        if (!Array.isArray(entry) || entry.length !== 3 || !entry.every(Number.isFinite)
          || !Number.isInteger(entry[0]) || !Number.isInteger(entry[1])
          || Math.abs(entry[0]) > 1000020 || Math.abs(entry[1]) > 1000020 || entry[2] < 0 || entry[2] > 1.4) throw new Error('Ungültiger Höhenwert');
        world.edits.set(`${entry[0]},${entry[1]}`, entry[2]);
      }
    }
    if (data.version >= 3) {
      if (!Array.isArray(data.forestEdits) || data.forestEdits.length > 200000) throw new Error('Ungültige Waldänderungen');
      for (const entry of data.forestEdits) {
        if (!Array.isArray(entry) || entry.length !== 3 || !entry.every(Number.isFinite)
          || !Number.isInteger(entry[0]) || !Number.isInteger(entry[1]) || entry[0] % 2 !== 0 || entry[1] % 2 !== 0
          || Math.abs(entry[0]) > 1000020 || Math.abs(entry[1]) > 1000020
          || !Number.isInteger(entry[2]) || entry[2] < 0 || entry[2] > 100) throw new Error('Ungültige Walddichte');
        world.forestEdits.set(`${entry[0]},${entry[1]}`, entry[2]);
      }
    }
    if (data.version >= 4) {
      if (!Array.isArray(data.waterEdits) || data.waterEdits.length > 200000) throw new Error('Ungültige Wasseränderungen');
      for (const entry of data.waterEdits) {
        if (!Array.isArray(entry) || entry.length !== 3 || !entry.every(Number.isFinite)
          || !Number.isInteger(entry[0]) || !Number.isInteger(entry[1])
          || Math.abs(entry[0]) > 1000020 || Math.abs(entry[1]) > 1000020
          || entry[2] <= world.settings.water / 100 || entry[2] > 1.4
          || entry[2] <= heightAt(world, entry[0], entry[1])) throw new Error('Ungültiger Wasserstand');
        world.waterEdits.set(`${entry[0]},${entry[1]}`, entry[2]);
      }
    }
    if (data.version >= 5) {
      if (!Array.isArray(data.buildings) || data.buildings.length > 1000) throw new Error('Ungültige Gebäude');
      const ids = new Set();
      for (const building of data.buildings) {
        if (!building || building.type !== 'house' || !Number.isSafeInteger(building.id) || building.id <= 0
          || building.id >= Number.MAX_SAFE_INTEGER || ids.has(building.id)
          || !Number.isInteger(building.x) || !Number.isInteger(building.y)
          || ![0, 90, 180, 270].includes(building.rotation)
          || !buildingPlacement(world, building, building.rotation).valid) throw new Error('Ungültige Gebäudeplatzierung');
        ids.add(building.id);
        world.buildings.push({ id: building.id, type: 'house', x: building.x, y: building.y, rotation: building.rotation });
      }
    }
    refreshDetails(world);
    return world;
  }

  function paintForest(world, from, to, radius, density) {
    if (![from.x, from.y, to.x, to.y, radius, density].every(Number.isFinite) || radius <= 0) return false;
    radius = clamp(radius, 2, 30); density = clamp(Math.round(density), 0, 100);
    const dx = to.x - from.x, dy = to.y - from.y, length2 = dx * dx + dy * dy;
    if (length2 > 1000000 || Math.max(Math.abs(from.x), Math.abs(from.y), Math.abs(to.x), Math.abs(to.y)) > 1000000) return false;
    let changed = false;
    for (let y = Math.floor((Math.min(from.y, to.y) - radius) / 2) * 2; y <= Math.ceil(Math.max(from.y, to.y) + radius); y += 2) {
      for (let x = Math.floor((Math.min(from.x, to.x) - radius) / 2) * 2; x <= Math.ceil(Math.max(from.x, to.x) + radius); x += 2) {
        const t = length2 ? clamp(((x - from.x) * dx + (y - from.y) * dy) / length2, 0, 1) : 0;
        if (Math.hypot(x - from.x - t * dx, y - from.y - t * dy) > radius) continue;
        const key = `${x},${y}`, h = heightAt(world, x, y);
        const slope = Math.abs(heightAt(world, x + 1, y) - heightAt(world, x - 1, y))
          + Math.abs(heightAt(world, x, y + 1) - heightAt(world, x, y - 1));
        const suitable = h > waterAt(world, x, y) + .015 && h < .9 && slope < .16;
        if (!suitable && !(density === 0 && world.forestEdits.has(key))) continue;
        // An absolute density makes repainting stable; 0% also clears generated trees.
        if (world.forestEdits.get(key) !== density) { world.forestEdits.set(key, density); changed = true; }
      }
    }
    return changed;
  }

  const api = { DEFAULTS, normalizeSettings, generate, randomAt, heightAt, waterAt, moistureAt, refreshDetails, raise, raiseTimed, paintForest, beginWaterStroke, paintWater,
    buildingBounds, buildingSurface, buildingPlacement, placeBuilding, removeBuilding, rotateBuilding, serialize, restore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.DND_TERRAIN = api;
})();
