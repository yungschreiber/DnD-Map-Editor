// Run with Node.js: node tests/regressions.cjs (no dependencies).
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const read = name => readFileSync(join(__dirname, '..', name), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const source = read('script.js');
for (const name of ['script.js', 'shared-tiles.js', 'asset-editor.js', 'tile-drawer.js', 'ui.js']) {
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
    click() {}, toBlob(callback) { callback({}); }
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
const alerts = [];
class FileReader {
  readAsText(file) { this.result = file; this.onload(); }
}
const editor = new Function('window', 'document', 'localStorage', 'FileReader', 'alert', 'URL',
  source.replace('    void init();', '') + `
    let draws = 0;
    drawMap = () => { draws++; };
    renderLayerList = () => {};
    updateStatus = () => {};
    return { state, parseMapImport, loadJsonFile, loadMapDraft, resizeCanvas, undo, redo,
      exportPng, buildMapDraftPayload, draws: () => draws };
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
assert(editor.draws() === beforeExport + 1, 'PNG export must redraw without a hover preview');
console.log('Regression checks passed: syntax, zoom, imports, undo/redo, drafts, eraser, redraws, autosave, PNG.');
