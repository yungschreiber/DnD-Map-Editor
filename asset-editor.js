const STORAGE_KEY = 'dnd-map-editor-assets';

const TOOL_DEFS = [
  { id: 'paint', label: 'Pinsel' },
  { id: 'erase', label: 'Radierer' },
  { id: 'fill', label: 'Fill' },
  { id: 'rect', label: 'Rechteck' },
  { id: 'circle', label: 'Kreis' },
  { id: 'picker', label: 'Pipette' }
];

const BUTTON_ICONS = {
  paint: '✦',
  erase: '×',
  fill: '■',
  picker: '◌',
  load: '◇',
  export: '⇱',
  delete: '✕'
};

const PALETTE = [
  '#00000000',
  '#8f9aa8',
  '#374151',
  '#8b5a2b',
  '#16a34a',
  '#166534',
  '#3f9b4a',
  '#d4b36a',
  '#7c4a2d',
  '#2563eb',
  '#60a5fa',
  '#dc2626',
  '#b91c1c',
  '#9ca3af',
  '#f8fafc',
  '#111827'
];

const TILE_CATEGORIES = [
  {
    id: 'basic',
    label: 'BASIC',
    tiles: [
      { id: 'stone', label: 'Stone', color: '#8f9aa8' },
      { id: 'wood', label: 'Wood', color: '#8b5a2b' },
      { id: 'earth', label: 'Earth', color: '#7a5a3a' },
      { id: 'sand', label: 'Sand', color: '#d4b36a' },
      { id: 'water', label: 'Water', color: '#2563eb' }
    ]
  },
  {
    id: 'nature',
    label: 'NATURE',
    tiles: [
      { id: 'grass', label: 'Grass', color: '#16a34a' },
      { id: 'trees', label: 'Trees', color: '#166534' },
      { id: 'bush', label: 'Bush', color: '#3f9b4a' },
      { id: 'dirt', label: 'Dirt', color: '#7c4a2d' },
      { id: 'lava', label: 'Lava', color: '#dc2626' }
    ]
  },
  {
    id: 'village',
    label: 'VILLAGE',
    tiles: [
      { id: 'floor', label: 'Floor', color: '#6b7280' },
      { id: 'wall', label: 'Wall', color: '#374151' },
      { id: 'roof', label: 'Roof', color: '#b5653b' },
      { id: 'door', label: 'Door', color: '#a16207' },
      { id: 'window', label: 'Window', color: '#60a5fa' },
      { id: 'fence', label: 'Fence', color: '#9a6a3f' }
    ]
  },
  {
    id: 'dungeon',
    label: 'DUNGEON',
    tiles: [
      { id: 'stone-floor', label: 'Stone Floor', color: '#717c88' },
      { id: 'brick-wall', label: 'Brick Wall', color: '#5c4b51' },
      { id: 'stairs', label: 'Stairs', color: '#9ca3af' },
      { id: 'trap', label: 'Trap', color: '#b91c1c' },
      { id: 'pillar', label: 'Pillar', color: '#94a3b8' }
    ]
  }
];

const canvas = document.getElementById('assetCanvas');
const ctx = canvas.getContext('2d');
const previewCanvas = document.getElementById('assetPreviewCanvas');
const previewCtx = previewCanvas.getContext('2d');
const assetList = document.getElementById('assetList');
const assetStatus = document.getElementById('assetStatus');
const assetNameInput = document.getElementById('assetNameInput');
const assetCategoryInput = document.getElementById('assetCategoryInput');
const assetWidthInput = document.getElementById('assetWidthInput');
const assetHeightInput = document.getElementById('assetHeightInput');
const assetImportInput = document.getElementById('assetImportInput');
const paletteButtons = document.getElementById('paletteButtons');
const assetToolButtons = document.getElementById('assetToolButtons');
const assetTileButtons = document.getElementById('assetTileButtons');
const rgbColorInput = document.getElementById('rgbColorInput');
const rgbRInput = document.getElementById('rgbRInput');
const rgbGInput = document.getElementById('rgbGInput');
const rgbBInput = document.getElementById('rgbBInput');

const state = {
  width: 20,
  height: 20,
  cellSize: 32,
  currentTool: 'paint',
  currentColor: '#166534',
  currentTileId: null,
  customColor: '#166534',
  isDrawing: false,
  dragStart: null,
  hoverCell: null,
  openTileCategories: new Set(['basic']),
  assetId: null,
  pixels: [],
  assets: []
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createEmptyPixels(width, height) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => null));
}

function normalizeColor(color) {
  return color === '#00000000' ? null : color;
}

function sanitizeAssetDefinition(asset) {
  if (!asset || !Array.isArray(asset.pixels)) return null;
  const width = clamp(parseInt(asset.width, 10) || 0, 1, 30);
  const height = clamp(parseInt(asset.height, 10) || 0, 1, 30);
  if (!width || !height) return null;

  const pixels = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => asset.pixels[y]?.[x] || null)
  );

  return {
    ...asset,
    width,
    height,
    pixels
  };
}

function clampRgb(value) {
  return clamp(parseInt(value, 10) || 0, 0, 255);
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex) {
  const normalized = (hex || '#000000').replace('#', '');
  const safeHex = normalized.length === 6 ? normalized : '000000';
  return {
    r: parseInt(safeHex.slice(0, 2), 16),
    g: parseInt(safeHex.slice(2, 4), 16),
    b: parseInt(safeHex.slice(4, 6), 16)
  };
}

function syncColorInputs() {
  const sourceColor = state.currentColor === '#00000000' ? state.customColor : state.currentColor;
  const { r, g, b } = hexToRgb(sourceColor);
  rgbColorInput.value = sourceColor;
  rgbRInput.value = r;
  rgbGInput.value = g;
  rgbBInput.value = b;
}

function setCurrentColor(color, options = {}) {
  state.currentColor = color;
  if (color !== '#00000000') state.customColor = color;
  if (options.keepTileSelection !== true) state.currentTileId = null;
  if (options.renderPalette !== false) renderPalette();
  if (options.renderTiles !== false) renderAssetTiles();
  syncColorInputs();
  if (options.statusMessage) setStatus(options.statusMessage);
}

function setStatus(message) {
  assetStatus.innerHTML = message;
}

function syncInputs() {
  assetWidthInput.value = state.width;
  assetHeightInput.value = state.height;
}

function resizeEditorCanvas() {
  canvas.width = state.width * state.cellSize;
  canvas.height = state.height * state.cellSize;
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
}

function drawEditor(preview = null) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const color = state.pixels[y][x];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * state.cellSize, y * state.cellSize, state.cellSize, state.cellSize);
    }
  }

  if (preview && (preview.tool === 'rect' || preview.tool === 'circle')) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = normalizeColor(state.currentColor) || '#ef4444';
    applyShapeToGrid(preview.start.x, preview.start.y, preview.end.x, preview.end.y, preview.tool, (x, y) => {
      ctx.fillRect(x * state.cellSize, y * state.cellSize, state.cellSize, state.cellSize);
    });
    ctx.restore();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= state.width; x++) {
    ctx.beginPath();
    ctx.moveTo(x * state.cellSize + 0.5, 0);
    ctx.lineTo(x * state.cellSize + 0.5, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= state.height; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * state.cellSize + 0.5);
    ctx.lineTo(canvas.width, y * state.cellSize + 0.5);
    ctx.stroke();
  }
}

function drawPreview() {
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  previewCtx.fillStyle = '#0b1220';
  previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

  const size = Math.floor(Math.min(
    previewCanvas.width / Math.max(state.width, 1),
    previewCanvas.height / Math.max(state.height, 1)
  ));
  const offsetX = Math.floor((previewCanvas.width - state.width * size) / 2);
  const offsetY = Math.floor((previewCanvas.height - state.height * size) / 2);

  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const color = state.pixels[y][x];
      if (!color) continue;
      previewCtx.fillStyle = color;
      previewCtx.fillRect(offsetX + x * size, offsetY + y * size, size, size);
    }
  }
}

function renderPalette() {
  paletteButtons.innerHTML = '';
  PALETTE.forEach(color => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'palette-btn' + (state.currentColor === color ? ' active' : '');
    btn.style.background = color === '#00000000'
      ? 'linear-gradient(135deg, #0f172a 0 45%, #ef4444 45% 55%, #0f172a 55% 100%)'
      : color;
    btn.title = color === '#00000000' ? 'Transparent' : color;
    btn.addEventListener('click', () => {
      setCurrentColor(
        color,
        { renderPalette: true }
      );
      setStatus(`Farbe ausgewählt: <strong>${color === '#00000000' ? 'Transparent' : color}</strong>`);
    });
    paletteButtons.appendChild(btn);
  });
}

function applyRgbInputs() {
  const nextColor = rgbToHex(
    clampRgb(rgbRInput.value),
    clampRgb(rgbGInput.value),
    clampRgb(rgbBInput.value)
  );
  setCurrentColor(nextColor);
  setStatus(`Farbe: <strong>${nextColor}</strong>`);
}

function renderAssetTiles() {
  assetTileButtons.innerHTML = '';

  TILE_CATEGORIES.forEach(category => {
    const wrapper = document.createElement('details');
    wrapper.className = 'tile-category';
    if (state.openTileCategories.has(category.id) || category.tiles.some(tile => tile.id === state.currentTileId)) {
      wrapper.open = true;
    }

    wrapper.addEventListener('toggle', () => {
      if (wrapper.open) state.openTileCategories.add(category.id);
      else state.openTileCategories.delete(category.id);
    });

    const summary = document.createElement('summary');
    summary.className = 'tile-category-summary';
    summary.innerHTML = `<span>${category.label}</span><span class="tile-category-count">${category.tiles.length}</span>`;
    wrapper.appendChild(summary);

    const grid = document.createElement('div');
    grid.className = 'tile-grid';

    category.tiles.forEach(tile => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tile-btn' + (state.currentTileId === tile.id ? ' active' : '');
      btn.innerHTML = `<span class="swatch" style="background:${tile.color}"></span><span>${tile.label}</span>`;
      btn.addEventListener('click', () => {
        state.currentTileId = tile.id;
        state.openTileCategories.add(category.id);
        setCurrentColor(tile.color, {
          keepTileSelection: true,
          statusMessage: `Tile ausgewaehlt: <strong>${tile.label}</strong>`
        });
      });
      grid.appendChild(btn);
    });

    wrapper.appendChild(grid);
    assetTileButtons.appendChild(wrapper);
  });
}

function renderTools() {
  assetToolButtons.innerHTML = '';
  TOOL_DEFS.forEach(tool => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = tool.label;
    btn.dataset.icon = BUTTON_ICONS[tool.id] || '•';
    btn.className = state.currentTool === tool.id ? 'active' : '';
    btn.addEventListener('click', () => {
      state.currentTool = tool.id;
      renderTools();
      setStatus(`Tool: <strong>${tool.label}</strong>`);
    });
    assetToolButtons.appendChild(btn);
  });
}

function renderAssetList() {
  assetList.innerHTML = '';
  if (!state.assets.length) {
    const empty = document.createElement('div');
    empty.className = 'hint';
    empty.textContent = 'Noch keine Assets gespeichert.';
    assetList.appendChild(empty);
    return;
  }

  state.assets.forEach(asset => {
    const card = document.createElement('div');
    card.className = 'asset-card' + (asset.id === state.assetId ? ' active' : '');

    const head = document.createElement('div');
    head.className = 'asset-card-head';

    const meta = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'asset-card-title';
    title.textContent = asset.name;
    const info = document.createElement('div');
    info.className = 'asset-card-meta';
    info.innerHTML = `${asset.category}<br>${asset.width}x${asset.height} Zellen`;
    meta.appendChild(title);
    meta.appendChild(info);

    head.appendChild(meta);
    card.appendChild(head);

    const actions = document.createElement('div');
    actions.className = 'asset-card-actions';

    const loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.dataset.icon = BUTTON_ICONS.load;
    loadBtn.textContent = 'Laden';
    loadBtn.addEventListener('click', () => loadAsset(asset.id));

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.dataset.icon = BUTTON_ICONS.export;
    exportBtn.textContent = 'Export';
    exportBtn.addEventListener('click', () => exportAsset(asset));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.dataset.icon = BUTTON_ICONS.delete;
    deleteBtn.textContent = 'Löschen';
    deleteBtn.className = 'danger';
    deleteBtn.addEventListener('click', () => deleteAsset(asset.id));

    actions.appendChild(loadBtn);
    actions.appendChild(exportBtn);
    actions.appendChild(deleteBtn);
    card.appendChild(actions);
    assetList.appendChild(card);
  });
}

function saveAssets() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.assets));
}

function loadAssetsFromStorage() {
  try {
    state.assets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      .map(sanitizeAssetDefinition)
      .filter(Boolean);
  } catch {
    state.assets = [];
  }
}

function exportAsset(asset = null) {
  const target = asset || buildCurrentAsset();
  const blob = new Blob([JSON.stringify(target, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slugify(target.name || 'asset')}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus(`Asset exportiert: <strong>${target.name}</strong>`);
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'asset';
}

function buildCurrentAsset() {
  return {
    id: state.assetId || `${slugify(assetNameInput.value)}-${Date.now()}`,
    name: assetNameInput.value.trim() || 'Unnamed Asset',
    category: assetCategoryInput.value.trim() || 'Misc',
    width: state.width,
    height: state.height,
    pixels: state.pixels.map(row => [...row]),
    updatedAt: new Date().toISOString()
  };
}

function saveCurrentAsset() {
  const asset = buildCurrentAsset();
  const existingIndex = state.assets.findIndex(entry => entry.id === asset.id);
  if (existingIndex === -1) state.assets.unshift(asset);
  else state.assets.splice(existingIndex, 1, asset);

  state.assetId = asset.id;
  saveAssets();
  renderAssetList();
  setStatus(`Asset gespeichert: <strong>${asset.name}</strong>`);
}

function loadAsset(assetId) {
  const asset = state.assets.find(entry => entry.id === assetId);
  if (!asset) return;

  state.assetId = asset.id;
  state.width = asset.width;
  state.height = asset.height;
  state.pixels = asset.pixels.map(row => [...row]);
  assetNameInput.value = asset.name;
  assetCategoryInput.value = asset.category;
  syncInputs();
  resizeEditorCanvas();
  drawEditor();
  drawPreview();
  renderAssetList();
  setStatus(`Asset geladen: <strong>${asset.name}</strong>`);
}

function deleteAsset(assetId) {
  state.assets = state.assets.filter(asset => asset.id !== assetId);
  if (state.assetId === assetId) state.assetId = null;
  saveAssets();
  renderAssetList();
  setStatus('Asset gelöscht');
}

function applyGridSize() {
  const nextWidth = clamp(parseInt(assetWidthInput.value, 10) || state.width, 1, 30);
  const nextHeight = clamp(parseInt(assetHeightInput.value, 10) || state.height, 1, 30);
  const nextPixels = createEmptyPixels(nextWidth, nextHeight);

  for (let y = 0; y < Math.min(state.height, nextHeight); y++) {
    for (let x = 0; x < Math.min(state.width, nextWidth); x++) {
      nextPixels[y][x] = state.pixels[y][x];
    }
  }

  state.width = nextWidth;
  state.height = nextHeight;
  state.pixels = nextPixels;
  syncInputs();
  resizeEditorCanvas();
  drawEditor();
  drawPreview();
  setStatus(`Raster angepasst: <strong>${state.width}x${state.height}</strong>`);
}

function resetEditor() {
  state.assetId = null;
  state.width = 20;
  state.height = 20;
  state.pixels = createEmptyPixels(state.width, state.height);
  assetNameInput.value = 'Tree Small';
  assetCategoryInput.value = 'Nature';
  syncInputs();
  resizeEditorCanvas();
  drawEditor();
  drawPreview();
  renderAssetList();
  setStatus('Neues leeres Asset erstellt');
}

function getCellFromEvent(evt) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((evt.clientX - rect.left) / state.cellSize);
  const y = Math.floor((evt.clientY - rect.top) / state.cellSize);
  return {
    x: clamp(x, 0, state.width - 1),
    y: clamp(y, 0, state.height - 1)
  };
}

function applyShapeToGrid(startX, startY, endX, endY, shape, callback) {
  const minX = Math.min(startX, endX);
  const maxX = Math.max(startX, endX);
  const minY = Math.min(startY, endY);
  const maxY = Math.max(startY, endY);

  if (shape === 'rect') {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) callback(x, y);
    }
    return;
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const radiusX = Math.max((maxX - minX + 1) / 2, 0.5);
  const radiusY = Math.max((maxY - minY + 1) / 2, 0.5);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const normX = (x - centerX) / radiusX;
      const normY = (y - centerY) / radiusY;
      if (normX * normX + normY * normY <= 1) callback(x, y);
    }
  }
}

function applyShape(startX, startY, endX, endY, shape) {
  const replacement = normalizeColor(state.currentColor);
  applyShapeToGrid(startX, startY, endX, endY, shape, (x, y) => {
    state.pixels[y][x] = replacement;
  });
}

function fillPixels(startX, startY, replacement) {
  const target = state.pixels[startY]?.[startX] ?? null;
  if (target === replacement) return;
  const stack = [[startX, startY]];

  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= state.width || y >= state.height) continue;
    if ((state.pixels[y][x] ?? null) !== target) continue;
    state.pixels[y][x] = replacement;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}

function applyToolAt(x, y) {
  if (state.currentTool === 'paint') {
    state.pixels[y][x] = normalizeColor(state.currentColor);
  } else if (state.currentTool === 'erase') {
    state.pixels[y][x] = null;
  } else if (state.currentTool === 'fill') {
    fillPixels(x, y, normalizeColor(state.currentColor));
  } else if (state.currentTool === 'picker') {
    setCurrentColor(state.pixels[y][x] || '#00000000');
  }

  drawEditor();
  drawPreview();
}

function importAssetFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const asset = JSON.parse(reader.result);
      if (!Array.isArray(asset.pixels) || !asset.width || !asset.height) {
        throw new Error('Ungültiges Asset-Format');
      }

      const imported = {
        id: asset.id || `${slugify(asset.name || 'asset')}-${Date.now()}`,
        name: asset.name || 'Imported Asset',
        category: asset.category || 'Imported',
        width: clamp(asset.width, 1, 30),
        height: clamp(asset.height, 1, 30),
        pixels: asset.pixels.map(row => row.map(cell => cell || null)),
        updatedAt: new Date().toISOString()
      };

      const existingIndex = state.assets.findIndex(entry => entry.id === imported.id);
      if (existingIndex === -1) state.assets.unshift(imported);
      else state.assets.splice(existingIndex, 1, imported);

      saveAssets();
      renderAssetList();
      loadAsset(imported.id);
      setStatus(`Asset importiert: <strong>${imported.name}</strong>`);
    } catch (error) {
      setStatus(`Import fehlgeschlagen: <strong>${error.message}</strong>`);
    }
  };
  reader.readAsText(file);
}

canvas.addEventListener('mousedown', evt => {
  const { x, y } = getCellFromEvent(evt);
  state.hoverCell = { x, y };

  if (state.currentTool === 'rect' || state.currentTool === 'circle') {
    state.isDrawing = true;
    state.dragStart = { x, y };
    drawEditor({ tool: state.currentTool, start: state.dragStart, end: { x, y } });
    return;
  }

  state.isDrawing = true;
  applyToolAt(x, y);
});

canvas.addEventListener('mousemove', evt => {
  const { x, y } = getCellFromEvent(evt);
  state.hoverCell = { x, y };

  if (state.isDrawing && (state.currentTool === 'paint' || state.currentTool === 'erase')) {
    applyToolAt(x, y);
    return;
  }

  if (state.isDrawing && (state.currentTool === 'rect' || state.currentTool === 'circle') && state.dragStart) {
    drawEditor({ tool: state.currentTool, start: state.dragStart, end: { x, y } });
  }
});

window.addEventListener('mouseup', () => {
  if (state.isDrawing && state.dragStart && state.hoverCell && (state.currentTool === 'rect' || state.currentTool === 'circle')) {
    applyShape(state.dragStart.x, state.dragStart.y, state.hoverCell.x, state.hoverCell.y, state.currentTool);
    drawEditor();
    drawPreview();
  }
  state.isDrawing = false;
  state.dragStart = null;
});

document.getElementById('applyGridBtn').addEventListener('click', applyGridSize);
document.getElementById('newAssetBtn').addEventListener('click', resetEditor);
document.getElementById('saveAssetBtn').addEventListener('click', saveCurrentAsset);
document.getElementById('exportAssetBtn').addEventListener('click', () => exportAsset());
assetImportInput.addEventListener('change', event => importAssetFile(event.target.files[0]));
rgbColorInput.addEventListener('input', () => {
  setCurrentColor(rgbColorInput.value);
  setStatus(`Farbe: <strong>${rgbColorInput.value}</strong>`);
});
rgbRInput.addEventListener('input', applyRgbInputs);
rgbGInput.addEventListener('input', applyRgbInputs);
rgbBInput.addEventListener('input', applyRgbInputs);

function init() {
  loadAssetsFromStorage();
  state.pixels = createEmptyPixels(state.width, state.height);
  syncInputs();
  renderPalette();
  renderAssetTiles();
  syncColorInputs();
  renderTools();
  renderAssetList();
  resizeEditorCanvas();
  drawEditor();
  drawPreview();
  setStatus('Rasterbasierter Asset-Editor bereit');
}

init();
