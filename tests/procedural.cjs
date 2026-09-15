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
const mountain = () => {
  const world = emptyOcean();
  world.settings.forest = 0;
  for (let y = -225; y <= -175; y++) for (let x = 175; x <= 265; x++) world.edits.set(`${x},${y}`, .85);
  return world;
};
const lake = mountain(), lakePoint = { x: 200, y: -200 };
terrain.paintForest(lake, lakePoint, lakePoint, 10, 100);
const lakeStroke = terrain.beginWaterStroke(lake, lakePoint, 20);
assert(terrain.paintWater(lake, lakePoint, lakePoint, 8, 20, lakeStroke));
assert(Math.abs(terrain.heightAt(lake, 200, -200) - .83) < 1e-10, 'Water carves only a shallow depression on a mountain');
assert(Math.abs(terrain.waterAt(lake, 200, -200) - .846) < 1e-10, 'Mountain lake stays above sea level and below its original surface');
assert.equal(new Set(lake.waterEdits.values()).size, 1, 'Lake surface is level');
assert.equal(terrain.heightAt(lake, 208, -200), .85, 'Banks outside the brush stay intact');
const once = terrain.serialize(lake);
for (let i = 0; i < 60; i++) assert.equal(terrain.paintWater(lake, lakePoint, lakePoint, 8, 20, lakeStroke), false);
assert.deepEqual(terrain.serialize(lake), once, 'Holding does not keep digging');
terrain.refreshDetails(lake);
assert(lake.trees.every(tree => tree.height > terrain.waterAt(lake, tree.x, tree.y)), 'Flooded forest disappears');
assert.equal(terrain.paintForest(lake, lakePoint, lakePoint, 2, 100), false, 'No new forest can be painted in a mountain lake');
const reloadedLake = terrain.restore(JSON.parse(JSON.stringify(terrain.serialize(lake))));
assert.deepEqual(reloadedLake.waterEdits, lake.waterEdits);
assert.deepEqual(reloadedLake.edits, lake.edits);
assert.deepEqual(reloadedLake.trees, lake.trees);
const river = mountain();
for (const key of river.edits.keys()) river.edits.set(key, .85 - (Number(key.split(',')[0]) - 200) * .003);
const riverEnd = { x: 240, y: -200 }, riverStroke = terrain.beginWaterStroke(river, lakePoint, 30, 'river');
terrain.paintWater(river, lakePoint, riverEnd, 3, 30, riverStroke);
for (let x = 200; x <= 240; x++) {
  const h = terrain.heightAt(river, x, -200), water = terrain.waterAt(river, x, -200);
  assert(h < water && water > .38 && water < .85 - (x - 200) * .003, 'A fast river stroke carves and fills a connected channel down the mountain');
}
assert(terrain.waterAt(river, 200, -200) > terrain.waterAt(river, 240, -200), 'River follows local elevation');
const fineRiver = mountain();
fineRiver.edits = new Map(riverStroke.source.edits);
const fineStroke = terrain.beginWaterStroke(fineRiver, lakePoint, 30, 'river');
for (let x = 200; x < 240; x++) terrain.paintWater(fineRiver, { x, y: -200 }, { x: x + 1, y: -200 }, 3, 30, fineStroke);
assert.deepEqual(fineRiver.edits, river.edits, 'River bed does not depend on pointer event density');
assert.deepEqual(fineRiver.waterEdits, river.waterEdits, 'River surface does not depend on pointer event density');
const slopeLake = mountain();
for (const key of slopeLake.edits.keys()) slopeLake.edits.set(key, .85 + (Number(key.split(',')[0]) - 200) * .001);
terrain.paintWater(slopeLake, lakePoint, lakePoint, 10, 40);
assert.equal(new Set(slopeLake.waterEdits.values()).size, 1, 'Even a lake on uneven land has a level surface');
for (const [key, water] of slopeLake.waterEdits) {
  const [x, y] = key.split(',').map(Number);
  assert(water < .85 + (x - 200) * .001 && water > terrain.heightAt(slopeLake, x, y), 'Water is inside its carved basin');
}
assert.equal(terrain.paintWater(emptyOcean(), lakePoint, lakePoint, 8, 20), false, 'Painting open sea has no effect');
assert.equal(terrain.paintWater(lake, { x: NaN, y: 0 }, lakePoint, 8, 20), false);
assert.equal(terrain.restore({ version: 3, edits: [], forestEdits: [] }).waterEdits.size, 0, 'Old drafts load without local water');
for (const waterEdits of [null, [[0, 0, null]], [[.5, 0, .8]], [[0, 0, 1.5]], [[0, 0, .2]], [[0, 0, .8]]]) {
  assert.throws(() => terrain.restore({ version: 4, mode: 'ocean', edits: [[0, 0, .9]], forestEdits: [], waterEdits }), 'Reject invalid or buried water');
}
for (let i = 0; i < 20; i++) terrain.raise(reloadedLake, lakePoint, lakePoint, 10, .1, 1.4);
assert(!reloadedLake.waterEdits.has('200,-200'), 'Raising terrain above a lake removes the water');
assert.doesNotThrow(() => terrain.restore(terrain.serialize(reloadedLake)), 'Refilled lakes remain loadable');
console.log('Water checks passed: mountain basins, level lakes, sloping rivers, stable holds and sampling, forest, persistence, legacy drafts, validation and refilling.');
const village = mountain(), housePoint = { x: 200, y: -200 };
const houseGround = new Map(village.edits);
terrain.paintForest(village, housePoint, housePoint, 10, 100); terrain.refreshDetails(village);
const forestBeforeHouses = village.trees.map(tree => ({ ...tree }));
const house = terrain.placeBuilding(village, { x: 200.2, y: -199.8 }, 0);
assert(house && house.x === 200 && house.y === -200, 'Houses snap to integer terrain coordinates');
assert.deepEqual(village.edits, houseGround, 'Building placement does not flatten or otherwise change the terrain');
assert(village.trees.length < forestBeforeHouses.length, 'Trees around a house are cleared from the view');
assert.equal(terrain.placeBuilding(village, housePoint), null, 'Overlapping houses are rejected');
assert.equal(terrain.buildingPlacement(village, { x: NaN, y: 0 }).valid, false);
assert.equal(terrain.placeBuilding(emptyOcean(), housePoint), null, 'No houses on open sea');
const badSite = mountain();
badSite.edits.set('200,-200', .79);
assert.match(terrain.buildingPlacement(badSite, housePoint).reason, /steil/, 'The entire footprint is checked for steep terrain');
badSite.edits.set('200,-200', .83); badSite.waterEdits.set('200,-200', .84);
assert.match(terrain.buildingPlacement(badSite, housePoint).reason, /Wasser/, 'Even a small inland pool inside the footprint blocks construction');
const gentleSite = mountain();
gentleSite.edits.set('200,-200', .83);
const gentleHouse = terrain.placeBuilding(gentleSite, housePoint);
assert(gentleHouse && terrain.buildingSurface(gentleSite, gentleHouse).height > .85, 'Foundation sits above the highest point and spans small unevenness');
const neighbor = terrain.placeBuilding(village, { x: 205, y: -200 });
assert(neighbor, 'Adjacent houses with a one-cell gap form a row');
assert.equal(terrain.rotateBuilding(village, house.id, 90).valid, false, 'A rotation cannot overlap a neighbor');
assert.equal(house.rotation, 0, 'Rejected rotation does not change the house');
terrain.removeBuilding(village, neighbor.id);
assert(terrain.rotateBuilding(village, house.id, -90).valid && house.rotation === 270, 'Rotation supports all four cardinal directions');
terrain.raise(village, housePoint, housePoint, 8, .1, 1.4);
terrain.paintWater(village, housePoint, housePoint, 8, 100);
for (const key of village.buildingGround) assert.equal(village.edits.get(key), houseGround.get(key), 'Height and water brushes preserve the house foundation');
terrain.refreshDetails(village);
const savedVillage = terrain.serialize(village);
assert.equal(savedVillage.version, 5);
const loadedVillage = terrain.restore(JSON.parse(JSON.stringify(savedVillage)));
assert.deepEqual(loadedVillage.buildings, village.buildings, 'Buildings and rotations survive reload');
assert.deepEqual(loadedVillage.trees, village.trees);
house.rotation = 180;
assert.equal(savedVillage.buildings[0].rotation, 270, 'Undo snapshots own independent building data');
assert(terrain.removeBuilding(loadedVillage, house.id) && !loadedVillage.buildings.length);
assert.equal(terrain.removeBuilding(loadedVillage, house.id), false, 'Removing a missing building is a no-op');
const unchangedForest = terrain.restore(savedVillage);
unchangedForest.edits = new Map(houseGround);
terrain.removeBuilding(unchangedForest, house.id);
assert.deepEqual(unchangedForest.trees, forestBeforeHouses, 'Deleting a house reveals the original forest');
assert.equal(terrain.restore({ version: 4, edits: [], forestEdits: [], waterEdits: [] }).buildings.length, 0, 'Existing water drafts load without buildings');
for (const buildings of [null, [{ ...savedVillage.buildings[0], id: 0 }], [{ ...savedVillage.buildings[0], type: 'unknown' }],
  [{ ...savedVillage.buildings[0], x: .5 }], [{ ...savedVillage.buildings[0], rotation: 45 }],
  [savedVillage.buildings[0], savedVillage.buildings[0]], [{ ...savedVillage.buildings[0], x: 1e8 }]]) {
  assert.throws(() => terrain.restore({ ...savedVillage, buildings }), 'Invalid building drafts are rejected');
}
console.log('Building checks passed: grid, foundations, wet/steep sites, spacing, rotation, forest, protected terrain, snapshots, deletion, persistence and validation.');
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
view.setCamera({ x: 200, y: -200, yaw: 45, pitch: 90, zoom: 2 });
view.render(lake);
const lakeSurface = view.project(lake, 200, -200, terrain.waterAt(lake, 200, -200));
const lakeHit = view.pick(lakeSurface.x, lakeSurface.y);
assert(Math.abs(lakeHit.height - .846) < .0001, 'Picking hits the mountain lake surface, not the bed or sea');
const lakePixel = (Math.floor(lakeSurface.y) * canvas.width + Math.floor(lakeSurface.x)) * 4;
assert(rendered[lakePixel + 2] > rendered[lakePixel] + 40, 'Mountain lake renders blue water');
const renderedVillage = terrain.restore(savedVillage);
const renderedHouse = renderedVillage.buildings[0];
for (const yaw of [0, 45, 90, 180, 270]) for (const pitch of [10, 30, 90]) {
  view.setCamera({ x: 200, y: -200, yaw, pitch, zoom: 2 });
  const roof = terrain.buildingSurface(renderedVillage, renderedHouse).height + 4.1 * view.step * Math.SQRT2 * Math.cos(Math.PI / 6) / (40 + renderedVillage.settings.relief * 1.4);
  const center = view.project(renderedVillage, 200, -200, roof);
  const shift = view.screenDelta(center.x - canvas.width / 2, center.y - canvas.height / 2);
  view.setCamera({ ...view.camera, x: view.camera.x + shift.x, y: view.camera.y + shift.y });
  view.render(renderedVillage);
  assert(view.getPicking().buildings.some(id => id === renderedHouse.id), 'House meshes are visible and selectable at all camera angles');
  const visiblePixel = view.getPicking().buildings.findIndex(id => id === renderedHouse.id);
  assert.equal(view.pickBuilding(visiblePixel % canvas.width, Math.floor(visiblePixel / canvas.width)), renderedHouse.id);
}
const cleanHouseImage = rendered.slice(), cleanPicking = view.getPicking().buildings.slice();
view.renderOverlay(null, renderedHouse.id);
assert.notDeepEqual(rendered, cleanHouseImage, 'Selection visibly highlights the house');
assert.deepEqual(view.getPicking().buildings, cleanPicking, 'Selection does not change hit testing');
view.renderOverlay();
assert.deepEqual(rendered, cleanHouseImage, 'Export can omit the selection overlay');
const preview = terrain.buildingPlacement(renderedVillage, { x: 210, y: -200 });
const sceneBeforePreview = terrain.serialize(renderedVillage);
view.renderOverlay(preview);
assert.notDeepEqual(rendered, cleanHouseImage, 'Placement preview is rendered');
assert.deepEqual(view.getPicking().buildings, cleanPicking, 'A preview is not an actual selectable building');
assert.deepEqual(terrain.serialize(renderedVillage), sceneBeforePreview, 'Preview never changes saved scene data');
view.renderOverlay();
assert.deepEqual(rendered, cleanHouseImage, 'Moving away completely removes the preview');
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
