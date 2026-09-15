(() => {
  const terrain = window.DND_TERRAIN;
  const STEP = 3.5;
  const SCALE = STEP * Math.SQRT2;
  const DEFAULT_CAMERA = { x: 47.5, y: 47.5, yaw: 45, pitch: 30, zoom: 1 };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function normalizeCamera(input = {}) {
    const number = key => Number.isFinite(input?.[key]) ? input[key] : DEFAULT_CAMERA[key];
    return { x: clamp(number('x'), -999000, 999000), y: clamp(number('y'), -999000, 999000),
      yaw: ((number('yaw') % 360) + 360) % 360, pitch: clamp(number('pitch'), 10, 90), zoom: clamp(number('zoom'), .25, 4) };
  }

  function create(canvas) {
    const ctx = canvas.getContext('2d');
    let picking = null;
    let drawOverlay = () => {};
    const camera = { ...DEFAULT_CAMERA };
    let cachedBasis;
    function basis(state = camera) {
      if (state === camera && cachedBasis && cachedBasis.yaw === state.yaw && cachedBasis.pitch === state.pitch && cachedBasis.zoom === state.zoom) return cachedBasis;
      const yaw = state.yaw * Math.PI / 180, pitch = state.pitch * Math.PI / 180;
      const value = { yaw: state.yaw, pitch: state.pitch, zoom: state.zoom,
        cos: Math.cos(yaw), sin: Math.sin(yaw), rise: Math.sin(pitch), lift: Math.cos(pitch), scale: SCALE * state.zoom };
      if (state === camera) cachedBasis = value;
      return value;
    }
    const relief = world => 40 + world.settings.relief * 1.4;
    function project(world, x, y, h) {
      const b = basis(), dx = x - camera.x, dy = y - camera.y;
      const u = b.cos * dx - b.sin * dy, v = b.sin * dx + b.cos * dy;
      const z = (h - world.settings.water / 100) * relief(world) / (SCALE * Math.cos(Math.PI / 6));
      return { x: canvas.width / 2 + u * b.scale,
        y: canvas.height / 2 + (v * b.rise - z * b.lift) * b.scale,
        depth: v * b.lift + z * b.rise, wx: x, wy: y, wh: h };
    }
    function screenDelta(x, y, state = camera) {
      const b = basis(state), u = x / b.scale, v = y / (b.scale * b.rise);
      return { x: b.cos * u + b.sin * v, y: -b.sin * u + b.cos * v };
    }
    function oceanPoint(x, y) {
      const delta = screenDelta(x - canvas.width / 2, y - canvas.height / 2);
      return { x: camera.x + delta.x, y: camera.y + delta.y };
    }

    function render(world) {
      const width = canvas.width, height = canvas.height;
      const image = ctx.createImageData(width, height), pixels = image.data;
      const depth = new Float32Array(width * height).fill(-Infinity);
      const pickX = new Float32Array(width * height), pickY = new Float32Array(width * height);
      const pickHeight = new Float32Array(width * height).fill(world.settings.water / 100);
      const pickBuildings = new Float64Array(width * height);
      let decorating = false, cleanPixels = null;
      const water = world.settings.water / 100, elevation = relief(world);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x, point = oceanPoint(x + .5, y + .5);
          pickX[i] = point.x; pickY[i] = point.y;
          const grain = (terrain.randomAt(world.seed + 20, x, y) - .5) * 7;
          pixels[i * 4] = Math.round((31 + grain) / 4) * 4;
          pixels[i * 4 + 1] = Math.round((66 + grain) / 4) * 4;
          pixels[i * 4 + 2] = Math.round((82 + grain) / 4) * 4;
          pixels[i * 4 + 3] = 255;
        }
      }
      function triangle(a, b, c, terrainSurface = true, buildingId = 0) {
        const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
        const maxX = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
        const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
        const maxY = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
        const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
        if (Math.abs(denominator) < .00001) return;
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const u = ((b.y - c.y) * (x + .5 - c.x) + (c.x - b.x) * (y + .5 - c.y)) / denominator;
            const v = ((c.y - a.y) * (x + .5 - c.x) + (a.x - c.x) * (y + .5 - c.y)) / denominator;
            const w = 1 - u - v;
            if (u < -.00001 || v < -.00001 || w < -.00001) continue;
            const z = u * a.depth + v * b.depth + w * c.depth + (decorating ? .0002 : 0), i = y * width + x;
            if (z < depth[i]) continue;
            depth[i] = z;
            if (!decorating) pickBuildings[i] = buildingId;
            if (terrainSurface) {
              pickX[i] = u * a.wx + v * b.wx + w * c.wx;
              pickY[i] = u * a.wy + v * b.wy + w * c.wy;
              pickHeight[i] = u * a.wh + v * b.wh + w * c.wh;
            }
            const grain = (terrain.randomAt(world.seed + 20, x, y) - .5) * 7;
            for (let channel = 0; channel < 3; channel++) {
              const color = u * a.color[channel] + v * b.color[channel] + w * c.color[channel] + grain;
              pixels[i * 4 + channel] = Math.round((decorating ? color * .65 + cleanPixels[i * 4 + channel] * .35 : color) / 4) * 4;
            }
          }
        }
      }

      const points = new Map();
      function vertex(x, y) {
        const key = `${x},${y}`;
        if (points.has(key)) return points.get(key);
        const h = terrain.heightAt(world, x, y);
        const localWater = terrain.waterAt(world, x, y);
        let color;
        if (h <= localWater) {
          const shallow = Math.max(0, 1 - (localWater - h) / .20);
          color = [31 + shallow * 26, 66 + shallow * 54, 82 + shallow * 44];
        } else {
          const dx = terrain.heightAt(world, x + 1, y) - terrain.heightAt(world, x - 1, y);
          const dy = terrain.heightAt(world, x, y + 1) - terrain.heightAt(world, x, y - 1);
          const slope = Math.hypot(dx, dy) * elevation / 130;
          if (h < water + .026) color = [189, 175, 119];
          else if (h > .90) color = [204, 214, 202];
          else if (h > .65 || slope > .075) color = [123, 133, 117];
          else if (terrain.moistureAt(world, x, y) > .55) color = [73, 115, 66];
          else color = [111, 143, 76];
          const light = Math.max(.58, Math.min(1.22, .94 + (dx - dy) * elevation / 14));
          color = color.map(value => value * light);
        }
        const point = { ...project(world, x, y, Math.max(localWater, h)), color };
        points.set(key, point);
        return point;
      }
      // Water is implicit everywhere. Only generated or sculpted terrain needs
      // geometry; distant strokes never allocate a huge rectangular world grid.
      const cells = new Set();
      if (world.mode !== 'ocean') {
        for (let y = -1; y < world.size; y++) for (let x = -1; x < world.size; x++) cells.add(`${x},${y}`);
      }
      for (const key of world.edits.keys()) {
        const [x, y] = key.split(',').map(Number);
        cells.add(key); cells.add(`${x - 1},${y}`); cells.add(`${x},${y - 1}`); cells.add(`${x - 1},${y - 1}`);
      }
      for (const key of cells) {
        const [x, y] = key.split(',').map(Number);
        const base = project(world, x, y, water);
        const viewBasis = basis(), margin = viewBasis.scale * 2;
        const maxLift = 1.4 * elevation * camera.zoom * viewBasis.lift / Math.cos(Math.PI / 6);
        if (base.x < -margin || base.x > width + margin || base.y < -margin || base.y > height + maxLift + margin) continue;
        const a = vertex(x, y), b = vertex(x + 1, y), c = vertex(x, y + 1), d = vertex(x + 1, y + 1);
        triangle(a, b, c); triangle(b, d, c);
      }
      // Small cone meshes keep trees upright in the world and show their crowns
      // from above. They use the same depth test as the terrain at every angle.
      for (const tree of world.trees) {
        const tall = (8 + tree.variant * 7) / elevation, radius = .8 + tree.variant * .45;
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4, b = (i + 1) * Math.PI / 4;
          const shade = .8 + Math.cos(a - 2) * .2;
          const color = [58, 104, 57].map(value => value * shade);
          const top = { ...project(world, tree.x, tree.y, tree.height + tall), color };
          const left = { ...project(world, tree.x + Math.cos(a) * radius, tree.y + Math.sin(a) * radius, tree.height + tall * .2), color };
          const right = { ...project(world, tree.x + Math.cos(b) * radius, tree.y + Math.sin(b) * radius, tree.height + tall * .2), color };
          triangle(top, left, right, false);
          const trunkColor = [94 * shade, 75 * shade, 48 * shade];
          const bottomA = { ...project(world, tree.x + Math.cos(a) * .16, tree.y + Math.sin(a) * .16, tree.height), color: trunkColor };
          const bottomB = { ...project(world, tree.x + Math.cos(b) * .16, tree.y + Math.sin(b) * .16, tree.height), color: trunkColor };
          const trunkA = { ...project(world, tree.x + Math.cos(a) * .16, tree.y + Math.sin(a) * .16, tree.height + tall * .25), color: trunkColor };
          const trunkB = { ...project(world, tree.x + Math.cos(b) * .16, tree.y + Math.sin(b) * .16, tree.height + tall * .25), color: trunkColor };
          triangle(bottomA, bottomB, trunkA, false); triangle(bottomB, trunkB, trunkA, false);
        }
      }
      function house(building, tint = null, surface = terrain.buildingSurface(world, building)) {
        const angle = building.rotation / 90, cos = [1, 0, -1, 0][angle], sin = [0, 1, 0, -1][angle];
        const unit = SCALE * Math.cos(Math.PI / 6) / elevation;
        const base = surface.height, wall = 2.5, ridge = 4.1;
        const vertex = ([x, y, z], color) => ({ ...project(world,
          building.x + x * cos - y * sin, building.y + x * sin + y * cos, base + z * unit),
          color: tint ? color.map((value, i) => value * .25 + tint[i] * .75) : color });
        const face = (coords, color) => {
          const vertices = coords.map(point => vertex(point, color));
          for (let i = 1; i < vertices.length - 1; i++) triangle(vertices[0], vertices[i], vertices[i + 1], false, building.id || 0);
        };
        const bottom = (surface.min - .004 - base) / unit;
        const corners = [[-2, -3], [2, -3], [2, 3], [-2, 3]];
        for (let i = 0; i < 4; i++) {
          const a = corners[i], b = corners[(i + 1) % 4];
          const shade = [.85, 1, 1.08, .72][(i + angle) % 4];
          face([[...a, bottom], [...b, bottom], [...b, 0], [...a, 0]], [108, 109, 95].map(v => v * shade));
          face([[...a, 0], [...b, 0], [...b, wall], [...a, wall]], [206, 187, 144].map(v => v * shade));
        }
        for (const y of [-3, 3]) {
          face([[-2, y, wall], [2, y, wall], [0, y, ridge]], [175, 153, 111]);
          // Timber sill and two upright posts on each gable wall.
          const outward = y + Math.sign(y) * .015;
          face([[-2, outward, .1], [2, outward, .1], [2, outward, .32], [-2, outward, .32]], [83, 65, 47]);
          for (const x of [-1.85, 1.65]) face([[x, outward, 0], [x + .2, outward, 0], [x + .2, outward, wall], [x, outward, wall]], [83, 65, 47]);
        }
        face([[-.5, -3.025, 0], [.5, -3.025, 0], [.5, -3.025, 1.7], [-.5, -3.025, 1.7]], [62, 48, 33]);
        for (const x of [-2.015, 2.015]) for (const y of [-1.5, 1]) {
          face([[x, y, 1], [x, y + .8, 1], [x, y + .8, 1.8], [x, y, 1.8]], [58, 78, 77]);
        }
        face([[-2.3, -3.3, wall - .15], [-2.3, 3.3, wall - .15], [0, 3.3, ridge], [0, -3.3, ridge]], [117, 59, 43]);
        face([[0, -3.3, ridge], [0, 3.3, ridge], [2.3, 3.3, wall - .15], [2.3, -3.3, wall - .15]], [161, 85, 57]);
        // A narrow ridge cap makes the roof readable even in the top view.
        face([[-.1, -3.35, ridge + .03], [.1, -3.35, ridge + .03], [.1, 3.35, ridge + .03], [-.1, 3.35, ridge + .03]], [191, 116, 76]);
      }
      for (const building of world.buildings) house(building);
      ctx.putImageData(image, 0, 0);
      picking = { x: pickX, y: pickY, heights: pickHeight, buildings: pickBuildings, width, height };
      cleanPixels = pixels.slice();
      const cleanDepth = depth.slice();
      // Cursor movement only redraws the houses used as overlays, not the terrain.
      drawOverlay = (preview = null, selectedId = null) => {
        pixels.set(cleanPixels); depth.set(cleanDepth); decorating = true;
        const selected = world.buildings.find(building => building.id === selectedId);
        if (selected) house(selected, [245, 216, 102]);
        if (preview?.building) house(preview.building, preview.valid ? [132, 231, 151] : [248, 91, 82], preview);
        decorating = false;
        ctx.putImageData(image, 0, 0);
      };
    }
    function pick(x, y, buffer = picking) {
      if (!buffer || x < 0 || y < 0 || x >= buffer.width || y >= buffer.height) return null;
      const i = Math.floor(y) * buffer.width + Math.floor(x);
      return { x: buffer.x[i], y: buffer.y[i], height: buffer.heights[i] };
    }
    function zoomAt(world, zoom, x, y) {
      const anchor = pick(x, y);
      camera.zoom = clamp(zoom, .25, 4);
      if (anchor) {
        // Picking samples pixel centers; use that same point when anchoring zoom.
        const projected = project(world, anchor.x, anchor.y, anchor.height);
        const delta = screenDelta(projected.x - Math.floor(x) - .5, projected.y - Math.floor(y) - .5);
        camera.x = clamp(camera.x + delta.x, -999000, 999000);
        camera.y = clamp(camera.y + delta.y, -999000, 999000);
      }
    }
    function pickBuilding(x, y) {
      if (!picking || x < 0 || y < 0 || x >= picking.width || y >= picking.height) return null;
      return picking.buildings[Math.floor(y) * picking.width + Math.floor(x)] || null;
    }
    return { render, pick, pickBuilding, project, camera, screenDelta, zoomAt, oceanPoint,
      renderOverlay: (preview, selectedId) => drawOverlay(preview, selectedId),
      setCamera: input => Object.assign(camera, normalizeCamera(input)),
      getPicking: () => picking, step: STEP, basis };
  }
  window.DND_TERRAIN_RENDERER = { create, normalizeCamera, DEFAULT_CAMERA };
})();
