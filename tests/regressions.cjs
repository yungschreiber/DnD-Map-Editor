// Run with Node.js: node tests/regressions.cjs (no dependencies).
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const read = name => readFileSync(join(__dirname, '..', name), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
(async () => {
const source = read('script.js');
for (const name of ['script.js', 'shared-tiles.js', 'asset-editor.js', 'tile-drawer.js', 'ui.js', 'map-tools.js', 'starter-assets.js']) {
  new Function(read(name));
}

const elements = new Map();
let dimensionWrites = 0;
const context = new Proxy({}, { get: () => () => {} });
function element() {
  let width = 96;
  let height = 96;
  return {
    style: {}, listeners: {}, classList: { toggle() {}, add() {}, remove() {} },
    get width() { return width; }, set width(value) { width = value; dimensionWrites++; },
    get height() { return height; }, set height(value) { height = value; dimensionWrites++; },
    getContext: () => context,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    addEventListener(name, handler) { this.listeners[name] = handler; },
    append() {}, replaceChildren() {}, click() {}, toBlob(callback) { callback({}); }
  };
}
const document = {
  getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
  createElement: element, body: element()
};
const timers = new Map();
let timerId = 0;
const window = {
  addEventListener() {},
  setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
  clearTimeout(id) { timers.delete(id); }
};
const storage = new Map();
const localStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
new Function('window', 'localStorage', read('shared-tiles.js'))(window, localStorage);
new Function('window', read('map-tools.js'))(window);
new Function('window', read('starter-assets.js'))(window);
const alerts = [];
class FileReader {
  readAsText(file) { this.result = file; this.onload(); }
}
const editor = new Function('window', 'document', 'localStorage', 'FileReader', 'alert', 'URL',
  source.replace('    void init();', '') + `
    let draws = 0;
    drawMap = () => { draws++; };
    renderLayerList = () => {}; renderTileButtons = () => {}; renderRoomOptions = () => {};
    updateStatus = () => {};
    return { state, parseMapImport, loadJsonFile, loadMapDraft, resizeCanvas, undo, redo,
      exportPng, buildMapDraftPayload, buildProjectPayload, refreshSharedTiles, editSelectedObject, updateObjectDrag, selectedPlacedObject, applyShape, draws: () => draws };
  `)(window, document, localStorage, FileReader, message => alerts.push(message), {
    createObjectURL: () => 'blob:test', revokeObjectURL() {}
  });
const makeMap = () => ({ mapWidth: 4, mapHeight: 4, tileSize: 24,
  layers: [{ id: 1, name: 'Test', tiles: Array.from({ length: 4 }, () => Array(4).fill('void')) }] });
Object.assign(editor.state, editor.parseMapImport(makeMap()));

editor.state.zoom = 2;
editor.resizeCanvas();
assert(dimensionWrites === 0, 'Zoom must not clear the canvas');
assert(elements.get('mapCanvas').style.width === '192px', 'Zoom must change CSS dimensions');

const original = JSON.stringify(editor.state);
for (const change of [
  map => { map.mapWidth = 1000000; },
  map => { map.layers = []; },
  map => { map.layers[0].tiles[0] = null; },
  map => { map.layers.push(map.layers[0]); },
  map => { map.layers[0].assetItems = [{ x: 0, y: 0, asset: { width: 1, height: 1, pixels: [null] } }]; }
]) {
  const invalid = makeMap();
  change(invalid);
  editor.loadJsonFile(JSON.stringify(invalid));
  assert(JSON.stringify(editor.state) === original, 'Invalid import must leave state and history untouched');
}
assert(alerts.length === 5, 'Each invalid import must report a failure');

const valid = makeMap();
valid.layers[0].tiles[0][0] = 'stone';
valid.activeLayerId = 99;
valid.nextLayerId = 1;
editor.loadJsonFile(JSON.stringify(valid));
assert(editor.state.layers[0].tiles[0][0] === 'stone', 'Valid import must load tiles');
assert(editor.state.activeLayerId === 1 && editor.state.nextLayerId === 2, 'Layer references must be normalized');
editor.undo();
assert(editor.state.layers[0].tiles[0][0] === 'void', 'Import must support undo');
editor.redo();
assert(editor.state.layers[0].tiles[0][0] === 'stone', 'Import must support redo');

const legacy = makeMap();
legacy.tiles = legacy.layers[0].tiles;
delete legacy.layers;
assert(editor.parseMapImport(legacy).layers.length === 1, 'Legacy maps must still load');
const withAsset = makeMap();
withAsset.layers[0].assetItems = [{ x: -1, y: 0, asset: {
  width: 64, height: 1, pixels: [Array(64).fill('#ffffff')]
} }];
assert(editor.parseMapImport(withAsset).layers[0].assetItems.length === 1, 'Existing 64-cell assets must load');

const draftKey = 'dnd-map-editor-map-draft';
const beforeDraft = JSON.stringify(editor.state);
storage.set(draftKey, JSON.stringify({ ...makeMap(), layers: [null] }));
assert(!editor.loadMapDraft(), 'Malformed draft must be rejected');
assert(JSON.stringify(editor.state) === beforeDraft, 'Malformed draft must not change state');
storage.set(draftKey, JSON.stringify(editor.buildMapDraftPayload()));
assert(editor.loadMapDraft(), 'Saved draft must load again');

const canvas = elements.get('mapCanvas');
editor.state.zoom = 1;
editor.state.selectedTool = 'erase';
canvas.listeners.mousedown({ clientX: 1, clientY: 1 });
assert(editor.state.isDrawing, 'Eraser must support dragging');
const beforeMove = editor.draws();
canvas.listeners.mousemove({ clientX: 2, clientY: 2 });
assert(editor.draws() === beforeMove, 'Movement inside the same cell must not redraw');
timers.clear();
canvas.listeners.mousemove({ clientX: 25, clientY: 1 });
assert(editor.draws() === beforeMove + 1, 'Movement into a new cell must redraw');
assert(timers.size === 1, 'Continuing a stroke must schedule another autosave');
const beforeExport = editor.draws();
editor.exportPng();
assert(editor.draws() === beforeExport + 2, 'PNG export must render a clean output and restore the editor');
assert(editor.state.showGrid === true, 'PNG export must preserve grid state');
assert(editor.exportPng({ tileSize: 9999 }) === false, 'Oversized exports must be rejected');
console.log('Regression checks passed: syntax, zoom, imports, undo/redo, drafts, eraser, redraws, autosave, PNG.');

const ops = window.DND_MAP_TOOLS;
const cells = [];
ops.line(0, 0, 6, 2, (x, y) => cells.push([x, y]));
assert(cells.length === 7 && cells.at(-1)[1] === 2, 'Fast strokes must cover every column');
const room = Array.from({ length: 4 }, () => Array(5).fill('void'));
ops.room(4, 3, 0, 0, 'floor', 'wall', (x, y, tile) => { room[y][x] = tile; });
assert(room[0].every(tile => tile === 'wall') && room[2][2] === 'floor', 'Rooms need a wall perimeter and floor interior');
assert(!ops.room(0, 0, 1, 1, 'floor', 'wall', () => { throw Error('Tiny room mutated map'); }), 'Tiny rooms must be rejected');
const asset = { id: 'test', name: 'Chair', width: 2, height: 1, pixels: [['#ffffff', null]] };
const layer = { id: 1, visible: true, assetItems: [{ x: 1, y: 1, asset }] };
assert(ops.hitAsset([layer], 1, 1)?.index === 0, 'Opaque asset pixels must be selectable');
assert(ops.hitAsset([layer], 2, 1) === null, 'Transparent pixels must not intercept clicks');
assert(ops.hitAsset([{ ...layer, visible: false }], 1, 1) === null, 'Hidden layers must not intercept clicks');
assert(ops.hitAsset([{ ...layer, id: 2 }, layer], 1, 1)?.layerId === 2, 'Top visible layer must win hit testing');
Object.assign(editor.state, editor.parseMapImport(makeMap()));
editor.state.layers[0].assetItems = layer.assetItems;
editor.state.selectedObject = { layerId: 1, index: 0 };
editor.state.objectDrag = { startX: 1, startY: 1, originX: 1, originY: 1, changed: false };
const historyBefore = editor.state.history.length;
editor.updateObjectDrag(2, 2);
editor.updateObjectDrag(3, 3);
assert(editor.state.history.length === historyBefore + 1, 'An object drag must create exactly one undo entry');
assert(editor.selectedPlacedObject().item.x === 3, 'Object drag must update position');
editor.undo();
assert(editor.state.layers[0].assetItems[0].x === 1, 'Undo must restore object position');
editor.state.selectedObject = { layerId: 1, index: 0 };
editor.editSelectedObject('rotate');
assert(editor.selectedPlacedObject().item.asset.height === 2, 'Object rotation must swap dimensions');
editor.editSelectedObject('duplicate');
assert(editor.state.layers[0].assetItems.length === 2, 'Duplicate must append a separate object');
editor.selectedPlacedObject().item.asset.pixels[0][0] = '#000000';
assert(editor.state.layers[0].assetItems[0].asset.pixels[0][0] === '#ffffff', 'Duplicated pixels must be independent');
editor.editSelectedObject('delete');
assert(editor.state.layers[0].assetItems.length === 1, 'Delete must remove only the selected object');
editor.undo();
assert(editor.state.layers[0].assetItems.length === 2, 'Object deletion must support undo');

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==';
const project = makeMap();
project.projectTiles = [{ id: 'custom-test', label: '<img src=x>', color: '#123456', textureDataUrl: png }];
project.layers[0].tiles[0][0] = 'custom-test';
editor.loadJsonFile(JSON.stringify(project));
const portable = await editor.buildProjectPayload();
assert(portable.version === 4 && portable.projectTiles[0].textureDataUrl === png, 'Project export must embed custom textures');
assert(!portable.projectTiles.some(tile => tile.id === 'stone'), 'Unused tiles must not inflate exports');
editor.loadJsonFile(JSON.stringify(makeMap()));
editor.undo();
assert(editor.state.projectTiles[0].id === 'custom-test', 'Undo across imports must restore project tiles');
const roundTrip = editor.parseMapImport(JSON.parse(JSON.stringify(portable)));
assert(roundTrip.layers[0].tiles[0][0] === 'custom-test', 'Portable projects must round-trip');
assert(window.DND_TILE_SHARED.escapeHtml('<img src=x>') === '&lt;img src=x&gt;', 'Imported labels must be escaped');
let rejected = false;
try { ops.validateProjectTiles([{ id: 'bad', label: 'Bad', color: '#000000', textureDataUrl: 'https://example.com/tracker' }]); } catch { rejected = true; }
assert(rejected, 'Projects must reject external texture URLs');
assert(window.DND_STARTER_ASSETS.length === 12, 'Starter library must contain twelve assets');
assert(window.DND_STARTER_ASSETS.every(asset => asset.pixels.length === asset.height && asset.pixels.every(row => row.length === asset.width)), 'Starter assets must have valid grids');
console.log('New checks passed: continuous strokes, rooms, selection, object history, portable projects, safe labels, starter assets.');
})().catch(error => { console.error(error); process.exitCode = 1; });