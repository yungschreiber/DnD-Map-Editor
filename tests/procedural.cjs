// Run with Node.js: node tests/procedural.cjs (no dependencies).
const assert = require('node:assert/strict');
const terrain = require('../terrain-generator.js');
const baseline = terrain.generate(terrain.DEFAULTS);
const repeat = terrain.generate(terrain.DEFAULTS);
assert.deepEqual(baseline.height, repeat.height, 'A seed must reproduce the terrain');
assert.deepEqual(baseline.trees, repeat.trees, 'A seed must reproduce the vegetation');
assert.notDeepEqual(baseline.height, terrain.generate({ seed: 'Andere Insel' }).height);
assert(baseline.landPercent > 10 && baseline.landPercent < 90, 'The default island should show both land and sea');
for (const value of baseline.height) assert(Number.isFinite(value) && value >= 0 && value <= 1);
for (let i = 0; i < baseline.size; i++) {
  assert(baseline.height[i] <= .15, 'The north boundary must stay submerged');
  assert(baseline.height[(baseline.size - 1) * baseline.size + i] <= .15, 'The south boundary must stay submerged');
}
const flooded = terrain.generate({ ...terrain.DEFAULTS, water: 65 });
const dry = terrain.generate({ ...terrain.DEFAULTS, water: 15 });
assert(flooded.landPercent < baseline.landPercent && baseline.landPercent < dry.landPercent);
const bare = terrain.generate({ ...terrain.DEFAULTS, forest: 0 });
const wooded = terrain.generate({ ...terrain.DEFAULTS, forest: 100 });
assert.equal(bare.trees.length, 0);
assert(wooded.trees.length > baseline.trees.length);
assert.deepEqual(bare.height, wooded.height, 'Vegetation must not change the terrain');
for (const tree of wooded.trees) assert(tree.height > wooded.settings.water / 100, 'Trees must be on land');
assert.deepEqual(terrain.normalizeSettings({ seed: '  ', water: Infinity, relief: -3, forest: 1000 }),
  { seed: 'Morgenwald', water: 38, relief: 0, forest: 100 });
assert.equal(terrain.normalizeSettings({ seed: 'x'.repeat(1000) }).seed.length, 80);
const sculpted = terrain.generate(terrain.DEFAULTS);
sculpted.height.fill(0); sculpted.mode = 'ocean';
const start = { x: -200, y: 300 }, end = { x: -100, y: 300 };
assert(terrain.raise(sculpted, start, end, 6, .1));
for (let x = -200; x <= -100; x++) assert(terrain.heightAt(sculpted, x, 300) > 0, 'Fast strokes stay connected outside the original map');
assert.equal(terrain.heightAt(sculpted, -150, 307), 0, 'Brush must leave the surrounding ocean alone');
assert(terrain.heightAt(sculpted, -150, 300) > terrain.heightAt(sculpted, -150, 304), 'Soft falloff');
for (let i = 0; i < 30; i++) terrain.raise(sculpted, start, start, 6, .1);
assert.equal(terrain.heightAt(sculpted, start.x, start.y), 1.4, 'Holding raises terrain up to a finite limit');
terrain.refreshDetails(sculpted);
const restored = terrain.restore(JSON.parse(JSON.stringify(terrain.serialize(sculpted))));
assert.deepEqual(restored.edits, sculpted.edits, 'All sculpted heights survive saving');
assert.equal(restored.mode, 'ocean');
assert.equal(restored.height[200], 0);
assert.deepEqual(restored.trees, sculpted.trees, 'Vegetation follows saved heights');
assert.deepEqual(terrain.restore({ version: 1, settings: terrain.DEFAULTS }).height, baseline.height, 'Old seed-only drafts still load');
assert.throws(() => terrain.restore({ version: 2, edits: [[0, 0, null]] }));
assert.throws(() => terrain.restore({ version: 2, edits: [[0, 0, 2]] }));
assert.equal(terrain.raise(sculpted, { x: NaN, y: 0 }, end, 6, .1), false);
const emptyOcean = () => {
  const world = terrain.generate(terrain.DEFAULTS);
  world.height.fill(0); world.mode = 'ocean'; return world;
};
const anchor = { x: -30, y: 200 };
const timedHold = (world, seconds, fps, strength, limit) => {
  for (let i = 0; i < seconds * fps; i++) terrain.raiseTimed(world, anchor, anchor, 10, 1 / fps, strength, limit);
};
const gentle = emptyOcean();
terrain.raiseTimed(gentle, anchor, anchor, 10, .01, 20, .42);
assert(terrain.heightAt(gentle, anchor.x, anchor.y) < .002, 'Click must not jump the seabed up to the coast');
const slowFrames = emptyOcean(), fastFrames = emptyOcean();
timedHold(slowFrames, 1, 15, 20, .42); timedHold(fastFrames, 1, 120, 20, .42);
assert(Math.abs(terrain.heightAt(slowFrames, anchor.x, anchor.y) - terrain.heightAt(fastFrames, anchor.x, anchor.y)) < 1e-10, 'Holding speed must not depend on frame rate');
assert(terrain.heightAt(slowFrames, anchor.x, anchor.y) < .2, 'Default tempo takes time to raise the seabed');
timedHold(gentle, 12, 30, 20, .42);
assert.equal(terrain.heightAt(gentle, anchor.x, anchor.y), .42, 'Flatland stops at its ceiling after prolonged holding');
gentle.edits.set(`${anchor.x},${anchor.y}`, .9);
timedHold(gentle, 1, 30, 100, .42);
assert.equal(terrain.heightAt(gentle, anchor.x, anchor.y), .9, 'Flatland preset does not lower existing mountains');
const coarsePath = emptyOcean(), finePath = emptyOcean();
const pathEnd = { x: anchor.x + 40, y: anchor.y };
terrain.raiseTimed(coarsePath, anchor, pathEnd, 10, 2, 20, .42);
for (let i = 0; i < 16; i++) {
  terrain.raiseTimed(finePath, { x: anchor.x + i * 2.5, y: anchor.y }, { x: anchor.x + (i + 1) * 2.5, y: anchor.y }, 10, 2 / 16, 20, .42);
}
for (const [key, height] of coarsePath.edits) assert(Math.abs(height - (finePath.edits.get(key) || 0)) < 1e-10, 'Mouse event density must not add strength');
const lowTempo = emptyOcean(), highTempo = emptyOcean();
timedHold(lowTempo, 1, 30, 1, .88); timedHold(highTempo, 1, 30, 100, .88);
assert(terrain.heightAt(lowTempo, anchor.x, anchor.y) < .01 && terrain.heightAt(highTempo, anchor.x, anchor.y) > .4, 'Tempo works across its entire range');
console.log('Brush control checks passed: gentle clicks, elapsed-time speed, event density, flatland ceiling, existing peaks, tempo range.');
const forestWorld = emptyOcean();
forestWorld.settings.forest = 0;
for (let y = -220; y <= -180; y++) for (let x = 180; x <= 260; x++) forestWorld.edits.set(`${x},${y}`, .5);
terrain.refreshDetails(forestWorld);
const forestCenter = { x: 200, y: -200 };
const originalHeights = new Map(forestWorld.edits);
assert(terrain.paintForest(forestWorld, forestCenter, forestCenter, 12, 100));
terrain.refreshDetails(forestWorld);
const denseTrees = forestWorld.trees.map(tree => `${tree.x},${tree.y}`);
assert(denseTrees.length > 70 && forestWorld.trees.every(tree => tree.type === 'fir'), 'Forest brush plants one tree type on distant land');
assert.deepEqual(forestWorld.edits, originalHeights, 'Forest painting never changes terrain heights');
assert.equal(terrain.paintForest(forestWorld, forestCenter, forestCenter, 12, 100), false, 'Repainting the same density is idempotent');
terrain.paintForest(forestWorld, forestCenter, forestCenter, 12, 25); terrain.refreshDetails(forestWorld);
assert(forestWorld.trees.length > 0 && forestWorld.trees.length < denseTrees.length);
assert(forestWorld.trees.every(tree => denseTrees.includes(`${tree.x},${tree.y}`)), 'Density keeps stable tree positions');
const forestReload = terrain.restore(JSON.parse(JSON.stringify(terrain.serialize(forestWorld))));
assert.deepEqual(forestReload.forestEdits, forestWorld.forestEdits);
assert.deepEqual(forestReload.trees, forestWorld.trees, 'Painted forest survives reload');
terrain.paintForest(forestWorld, forestCenter, forestCenter, 12, 0); terrain.refreshDetails(forestWorld);
assert.equal(forestWorld.trees.length, 0, 'Zero density removes painted trees');
terrain.paintForest(forestWorld, forestCenter, { x: 240, y: -200 }, 4, 100);
for (let x = 200; x <= 240; x += 2) assert.equal(forestWorld.forestEdits.get(`${x},-200`), 100, 'Fast forest strokes have no gaps');
const waterOnly = emptyOcean();
assert.equal(terrain.paintForest(waterOnly, forestCenter, forestCenter, 12, 100), false, 'No trees can be painted in water');
const generatedTree = wooded.trees[0];
terrain.paintForest(wooded, generatedTree, generatedTree, 3, 0); terrain.refreshDetails(wooded);
assert(!wooded.trees.some(tree => tree.x === generatedTree.x && tree.y === generatedTree.y), 'Zero density also removes generated trees');
assert.throws(() => terrain.restore({ version: 3, edits: [], forestEdits: [[0, 0, 101]] }));
assert.throws(() => terrain.restore({ version: 3, edits: [], forestEdits: [[1, 0, 50]] }));
assert.equal(terrain.restore({ version: 2, edits: [] }).forestEdits.size, 0, 'Older sculpted maps load without forest overrides');
console.log('Forest checks passed: density, stable positions, one species, zero-density clearing, continuous strokes, unchanged heights, water rejection, persistence and legacy drafts.');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const browserWindow = { DND_TERRAIN: terrain };
new Function('window', readFileSync(path.join(__dirname, '../terrain-renderer.js'), 'utf8'))(browserWindow);
let rendered;
const canvas = { width: 256, height: 192, getContext: () => ({
  createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
  putImageData: image => { rendered = image.data; }
}) };
const view = browserWindow.DND_TERRAIN_RENDERER.create(canvas);
const isolated = terrain.generate(terrain.DEFAULTS);
isolated.mode = 'ocean'; isolated.height.fill(0);
view.camera.x = 300; view.camera.y = -200;
for (let i = 0; i < 15; i++) terrain.raise(isolated, { x: 300, y: -200 }, { x: 300, y: -200 }, 12, .06);
terrain.refreshDetails(isolated);
view.render(isolated);
assert(rendered.every((value, i) => i % 4 !== 3 || value === 255), 'Every view pixel has water or terrain');
// Move the camera vertically so the tall mountain remains in this small test view.
view.camera.x -= 20; view.camera.y -= 20;
view.render(isolated);
const peak = view.project(isolated, 300, -200, terrain.heightAt(isolated, 300, -200));
const picked = view.pick(peak.x, peak.y);
assert(picked && Math.hypot(picked.x - 300, picked.y + 200) < 1, 'Picking must hit the visible raised surface, even outside the seed map');
assert.equal(view.pick(-1, 20), null);
const frozen = view.getPicking();
terrain.raise(isolated, { x: 300, y: -200 }, { x: 300, y: -200 }, 12, .2);
view.render(isolated);
assert.deepEqual(view.pick(peak.x, peak.y, frozen), picked, 'A stroke keeps its original ground anchor while the hill grows');
console.log('Renderer checks passed: full water coverage, raised-surface picking, distant coordinates, stable stroke anchor.');
const cameraApi = browserWindow.DND_TERRAIN_RENDERER;
assert.deepEqual(cameraApi.normalizeCamera({ x: 12, y: -8 }), { x: 12, y: -8, yaw: 45, pitch: 30, zoom: 1 }, 'Old camera drafts receive default angles');
assert.deepEqual(cameraApi.normalizeCamera({ yaw: -15, pitch: 0, zoom: 20 }), { x: 47.5, y: 47.5, yaw: 345, pitch: 10, zoom: 4 });
const cameraWorld = emptyOcean();
for (let y = -204; y <= -196; y++) for (let x = 296; x <= 304; x++) cameraWorld.edits.set(`${x},${y}`, .55);
terrain.refreshDetails(cameraWorld); cameraWorld.trees = [];
const unchangedHeights = JSON.stringify(terrain.serialize(cameraWorld));
for (const yaw of [0, 45, 90, 180, 270, 359]) {
  for (const pitch of [10, 30, 60, 90]) {
    for (const zoom of [.25, 1, 4]) {
      view.setCamera({ x: 300, y: -200, yaw, pitch, zoom });
      const sea = view.project(cameraWorld, 302, -203, .38);
      const inverse = view.oceanPoint(sea.x, sea.y);
      assert(Math.hypot(inverse.x - 302, inverse.y + 203) < 1e-9, 'Pan/inverse projection works at every angle and zoom');
    }
    view.setCamera({ x: 300, y: -200, yaw, pitch, zoom: 1 });
    view.render(cameraWorld);
    const surface = view.project(cameraWorld, 300, -200, .55);
    const hit = view.pick(surface.x, surface.y);
    assert(hit && Math.hypot(hit.x - 300, hit.y + 200) < 1.5 && Math.abs(hit.height - .55) < .001, 'Sculpt picking follows rotated and tilted terrain');
    view.zoomAt(cameraWorld, 2, surface.x, surface.y);
    const anchored = view.project(cameraWorld, hit.x, hit.y, hit.height);
    assert(Math.hypot(anchored.x - Math.floor(surface.x) - .5, anchored.y - Math.floor(surface.y) - .5) < .003, 'Zoom keeps the visible surface under the cursor');
  }
}
assert.equal(JSON.stringify(terrain.serialize(cameraWorld)), unchangedHeights, 'Camera navigation never changes terrain');
console.log('Camera checks passed: angle and zoom bounds, old drafts, all quadrants, flat/top views, sculpt picking, cursor-anchored zoom.');
console.log('Sculpt checks passed: continuous strokes, distant ocean, falloff, height limit, persistence, legacy drafts, invalid data.');
console.log(`Procedural checks passed: reproducible terrain and trees, seeds, coasts, water levels, vegetation, settings. Default: ${baseline.landPercent}% land, ${baseline.trees.length} trees.`);
