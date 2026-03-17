const STORAGE_KEY = window.DND_TILE_SHARED.CUSTOM_TILE_STORAGE_KEY;
const DRAW_MIN = 8;
const DRAW_MAX = 32;
const CELL_SIZE = 28;
const TOOL_DEFS = [
  { id: 'paint', label: 'Pinsel' },
  { id: 'erase', label: 'Radierer' },
  { id: 'fill', label: 'Fill' },
  { id: 'rect', label: 'Rechteck' },
  { id: 'circle', label: 'Kreis' },
  { id: 'picker', label: 'Pipette' },
  { id: 'move', label: 'Move' }
];
const BUTTON_ICONS = {
  paint: '✦',
  erase: '×',
  fill: '■',
  rect: '▭',
  circle: '◯',
  picker: '◌',
  move: '✋'
};

const canvas = document.getElementById('tileDrawerCanvas');
const ctx = canvas.getContext('2d');
const previewCanvas = document.getElementById('tilePreviewCanvas');
const previewCtx = previewCanvas.getContext('2d');
const statusBox = document.getElementById('tileDrawerStatus');
const tileNameInput = document.getElementById('tileNameInput');
const tileCategorySelect = document.getElementById('tileCategorySelect');
const newCategoryInput = document.getElementById('newCategoryInput');
const tileWidthInput = document.getElementById('tileWidthInput');
const tileHeightInput = document.getElementById('tileHeightInput');
const paletteButtons = document.getElementById('tilePaletteButtons');
const toolButtons = document.getElementById('tileToolButtons');
const rgbColorInput = document.getElementById('tileRgbColorInput');
const rgbRInput = document.getElementById('tileRgbRInput');
const rgbGInput = document.getElementById('tileRgbGInput');
const rgbBInput = document.getElementById('tileRgbBInput');
const customTileList = document.getElementById('customTileList');

const state = {
  tileId: null,
  width: 16,
  height: 16,
  pixels: [],
  currentColor: '#8b5a2b',
  customColor: '#8b5a2b',
  currentTool: 'paint',
  isDrawing: false,
  dragStart: null,
  lastHoverCell: null,
  moveDrag: null,
  showGrid: true,
  customCategories: []
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'tile';
}

function createEmptyPixels(width, height) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => null));
}

function clonePixels() {
  return state.pixels.map(row => [...row]);
}

function setStatus(message) {
  statusBox.innerHTML = message;
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

function normalizeColor(color) {
  return color === '#00000000' ? null : color;
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
  if (options.renderPalette !== false) renderPalette();
  syncColorInputs();
}

function colorFromId(id) {
  let hash = 0;
  for (const char of id) hash = ((hash << 5) - hash) + char.charCodeAt(0);
  const safe = Math.abs(hash);
  const r = 64 + (safe & 0x7f);
  const g = 64 + ((safe >> 7) & 0x7f);
  const b = 64 + ((safe >> 14) & 0x7f);
  return `#${[r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

function loadCustomStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, categories: [] };
    const parsed = JSON.parse(raw);
    return {
      version: 1,
      categories: Array.isArray(parsed?.categories) ? parsed.categories : []
    };
  } catch {
    return { version: 1, categories: [] };
  }
}

function saveCustomStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.DND_TILE_SHARED.refreshFromStorage();
}

function getCellFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / CELL_SIZE);
  const y = Math.floor((event.clientY - rect.top) / CELL_SIZE);
  return {
    x: clamp(x, 0, state.width - 1),
    y: clamp(y, 0, state.height - 1)
  };
}

function drawCanvas() {
  canvas.width = state.width * CELL_SIZE;
  canvas.height = state.height * CELL_SIZE;
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0f0f0f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const color = state.pixels[y][x];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }

  if (!state.showGrid) return;

  ctx.save();
  ctx.globalCompositeOperation = 'difference';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.2;
  for (let x = 0; x <= state.width; x++) {
    ctx.beginPath();
    ctx.moveTo(x * CELL_SIZE + 0.5, 0);
    ctx.lineTo(x * CELL_SIZE + 0.5, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= state.height; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * CELL_SIZE + 0.5);
    ctx.lineTo(canvas.width, y * CELL_SIZE + 0.5);
    ctx.stroke();
  }
  ctx.restore();
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

function shiftPixels(sourcePixels, offsetX, offsetY) {
  const nextPixels = createEmptyPixels(state.width, state.height);
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const sourceX = x - offsetX;
      const sourceY = y - offsetY;
      if (sourceX < 0 || sourceY < 0 || sourceX >= state.width || sourceY >= state.height) continue;
      nextPixels[y][x] = sourcePixels[sourceY]?.[sourceX] || null;
    }
  }
  return nextPixels;
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

  drawCanvas();
  drawPreview();
}

function applyShape(startX, startY, endX, endY, shape) {
  const replacement = normalizeColor(state.currentColor);
  applyShapeToGrid(startX, startY, endX, endY, shape, (x, y) => {
    state.pixels[y][x] = replacement;
  });
}

function updateMoveDrag(x, y) {
  if (!state.moveDrag) return;
  const offsetX = x - state.moveDrag.startX;
  const offsetY = y - state.moveDrag.startY;
  if (offsetX === state.moveDrag.lastOffsetX && offsetY === state.moveDrag.lastOffsetY) return;
  state.moveDrag.lastOffsetX = offsetX;
  state.moveDrag.lastOffsetY = offsetY;
  state.pixels = shiftPixels(state.moveDrag.snapshot, offsetX, offsetY);
  drawCanvas();
  drawPreview();
  setStatus(`Verschiebung: <strong>${offsetX}, ${offsetY}</strong>`);
}

function drawPreview() {
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  previewCtx.fillStyle = '#0f0f0f';
  previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

  const size = Math.floor(Math.min(previewCanvas.width / state.width, previewCanvas.height / state.height));
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
  window.DND_TILE_SHARED.PALETTE.forEach(color => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'palette-btn' + (state.currentColor === color ? ' active' : '');
    button.style.background = color === '#00000000'
      ? 'linear-gradient(135deg, #0f172a 0 45%, #ef4444 45% 55%, #0f172a 55% 100%)'
      : color;
    button.addEventListener('click', () => {
      setCurrentColor(color);
      setStatus(`Farbe: <strong>${color === '#00000000' ? 'Transparent' : color}</strong>`);
    });
    paletteButtons.appendChild(button);
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

function renderTools() {
  toolButtons.innerHTML = '';
  TOOL_DEFS.forEach(tool => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = tool.label;
    button.dataset.icon = BUTTON_ICONS[tool.id] || '•';
    button.className = state.currentTool === tool.id ? 'active' : '';
    button.addEventListener('click', () => {
      state.currentTool = tool.id;
      renderTools();
      setStatus(`Tool: <strong>${tool.label}</strong>`);
    });
    toolButtons.appendChild(button);
  });
}

function getCategoryOptions() {
  const mergedCategories = window.DND_TILE_SHARED.TILE_CATEGORIES.map(category => ({
    id: category.id,
    label: category.label
  }));
  return [...mergedCategories, { id: '__new__', label: 'Neue Kategorie...' }];
}

function renderCategoryOptions() {
  const previous = tileCategorySelect.value || 'props';
  tileCategorySelect.innerHTML = '';
  getCategoryOptions().forEach(category => {
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = category.label;
    tileCategorySelect.appendChild(option);
  });
  tileCategorySelect.value = getCategoryOptions().some(option => option.id === previous) ? previous : 'props';
}

function buildTextureDataUrl() {
  const offscreen = document.createElement('canvas');
  offscreen.width = state.width;
  offscreen.height = state.height;
  const offscreenCtx = offscreen.getContext('2d');
  offscreenCtx.clearRect(0, 0, offscreen.width, offscreen.height);

  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const color = state.pixels[y][x];
      if (!color) continue;
      offscreenCtx.fillStyle = color;
      offscreenCtx.fillRect(x, y, 1, 1);
    }
  }

  return offscreen.toDataURL('image/png');
}

function resolveTargetCategory(store) {
  if (tileCategorySelect.value !== '__new__') {
    const selected = getCategoryOptions().find(category => category.id === tileCategorySelect.value);
    return {
      id: tileCategorySelect.value,
      label: selected?.label || tileCategorySelect.value.toUpperCase()
    };
  }

  const label = newCategoryInput.value.trim();
  if (!label) return null;
  const id = slugify(label);
  const existing = store.categories.find(category => category.id === id);
  return {
    id,
    label: existing?.label || label
  };
}

function buildTileDefinition() {
  const id = state.tileId || slugify(tileNameInput.value);
  return {
    id,
    label: tileNameInput.value.trim() || 'New Tile',
    color: colorFromId(id),
    textureDataUrl: buildTextureDataUrl()
  };
}

function saveTile() {
  const store = loadCustomStore();
  const targetCategory = resolveTargetCategory(store);
  if (!targetCategory) {
    setStatus('Bitte Kategorie auswÃ¤hlen oder eine neue anlegen');
    return;
  }

  const tile = buildTileDefinition();
  let category = store.categories.find(entry => entry.id === targetCategory.id);
  if (!category) {
    category = {
      id: targetCategory.id,
      label: targetCategory.label,
      tiles: []
    };
    store.categories.push(category);
  } else {
    category.label = targetCategory.label;
  }

  const tileIndex = category.tiles.findIndex(entry => entry.id === tile.id);
  if (tileIndex === -1) category.tiles.unshift(tile);
  else category.tiles.splice(tileIndex, 1, tile);

  state.tileId = tile.id;
  saveCustomStore(store);
  renderCategoryOptions();
  renderCustomTileList();
  setStatus(`Tile gespeichert: <strong>${tile.label}</strong>`);
}

function applyPixel(x, y, color) {
  state.pixels[y][x] = color === '#00000000' ? null : color;
  drawCanvas();
  drawPreview();
}

function resetEditor() {
  state.tileId = null;
  state.width = 16;
  state.height = 16;
  state.pixels = createEmptyPixels(state.width, state.height);
  state.currentTool = 'paint';
  tileNameInput.value = 'New Tile';
  tileWidthInput.value = state.width;
  tileHeightInput.value = state.height;
  tileCategorySelect.value = 'props';
  newCategoryInput.value = '';
  drawCanvas();
  drawPreview();
  renderPalette();
  renderTools();
  syncColorInputs();
  setStatus('Neues Tile bereit');
}

function applySize() {
  const width = clamp(parseInt(tileWidthInput.value, 10) || state.width, DRAW_MIN, DRAW_MAX);
  const height = clamp(parseInt(tileHeightInput.value, 10) || state.height, DRAW_MIN, DRAW_MAX);
  const next = createEmptyPixels(width, height);

  for (let y = 0; y < Math.min(height, state.height); y++) {
    for (let x = 0; x < Math.min(width, state.width); x++) {
      next[y][x] = state.pixels[y][x];
    }
  }

  state.width = width;
  state.height = height;
  state.pixels = next;
  tileWidthInput.value = width;
  tileHeightInput.value = height;
  drawCanvas();
  drawPreview();
  setStatus(`Raster angepasst: <strong>${width}x${height}</strong>`);
}

function renderCustomTileList() {
  const store = loadCustomStore();
  customTileList.innerHTML = '';
  const entries = store.categories.flatMap(category =>
    category.tiles.map(tile => ({ category, tile }))
  );

  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'hint';
    empty.textContent = 'Noch keine eigenen Tiles gespeichert.';
    customTileList.appendChild(empty);
    return;
  }

  entries.forEach(({ category, tile }) => {
    const card = document.createElement('div');
    card.className = 'asset-card' + (tile.id === state.tileId ? ' active' : '');

    const head = document.createElement('div');
    head.className = 'asset-card-head';

    const meta = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'asset-card-title';
    title.textContent = tile.label;
    const info = document.createElement('div');
    info.className = 'asset-card-meta';
    info.innerHTML = `${category.label}<br>${tile.id}`;
    meta.appendChild(title);
    meta.appendChild(info);
    head.appendChild(meta);
    card.appendChild(head);

    const preview = document.createElement('img');
    preview.src = tile.textureDataUrl;
    preview.alt = tile.label;
    preview.style.width = '100%';
    preview.style.imageRendering = 'pixelated';
    preview.style.borderRadius = '10px';
    preview.style.border = '1px solid rgba(255,255,255,0.08)';
    card.appendChild(preview);

    const actions = document.createElement('div');
    actions.className = 'asset-card-actions';

    const loadButton = document.createElement('button');
    loadButton.type = 'button';
    loadButton.textContent = 'Laden';
    loadButton.addEventListener('click', () => loadCustomTile(category, tile));

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'LÃ¶schen';
    deleteButton.className = 'danger';
    deleteButton.addEventListener('click', () => deleteCustomTile(category.id, tile.id));

    actions.appendChild(loadButton);
    actions.appendChild(deleteButton);
    card.appendChild(actions);
    customTileList.appendChild(card);
  });
}

function loadImagePixels(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = image.width;
      offscreen.height = image.height;
      const offscreenCtx = offscreen.getContext('2d');
      offscreenCtx.drawImage(image, 0, 0);
      const { data } = offscreenCtx.getImageData(0, 0, image.width, image.height);
      const pixels = createEmptyPixels(image.width, image.height);

      for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
          const index = (y * image.width + x) * 4;
          const alpha = data[index + 3];
          if (!alpha) continue;
          const r = data[index].toString(16).padStart(2, '0');
          const g = data[index + 1].toString(16).padStart(2, '0');
          const b = data[index + 2].toString(16).padStart(2, '0');
          pixels[y][x] = `#${r}${g}${b}`;
        }
      }

      resolve({ width: image.width, height: image.height, pixels });
    };
    image.onerror = reject;
    image.src = dataUrl;
  });
}

async function loadCustomTile(category, tile) {
  try {
    const imageData = await loadImagePixels(tile.textureDataUrl);
    state.tileId = tile.id;
    state.width = imageData.width;
    state.height = imageData.height;
    state.pixels = imageData.pixels;
    tileNameInput.value = tile.label;
    tileWidthInput.value = state.width;
    tileHeightInput.value = state.height;
    renderCategoryOptions();
    tileCategorySelect.value = category.id;
    newCategoryInput.value = '';
    drawCanvas();
    drawPreview();
    renderCustomTileList();
    setStatus(`Tile geladen: <strong>${tile.label}</strong>`);
  } catch {
    setStatus('Tile konnte nicht geladen werden');
  }
}

function deleteCustomTile(categoryId, tileId) {
  const store = loadCustomStore();
  const category = store.categories.find(entry => entry.id === categoryId);
  if (!category) return;

  category.tiles = category.tiles.filter(tile => tile.id !== tileId);
  store.categories = store.categories.filter(entry => entry.tiles.length);
  saveCustomStore(store);

  if (state.tileId === tileId) resetEditor();
  renderCategoryOptions();
  renderCustomTileList();
  setStatus('Tile gelÃ¶scht');
}

canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('mousedown', event => {
  const { x, y } = getCellFromEvent(event);
  state.lastHoverCell = { x, y };

  if (state.currentTool === 'move') {
    state.isDrawing = true;
    state.dragStart = { x, y };
    state.moveDrag = {
      startX: x,
      startY: y,
      snapshot: clonePixels(),
      lastOffsetX: 0,
      lastOffsetY: 0
    };
    setStatus('Verschiebung: <strong>0, 0</strong>');
    return;
  }

  if (state.currentTool === 'rect' || state.currentTool === 'circle') {
    state.isDrawing = true;
    state.dragStart = { x, y };
    return;
  }

  state.isDrawing = true;
  if (event.button === 2) {
    state.pixels[y][x] = null;
    drawCanvas();
    drawPreview();
    state.isDrawing = false;
    return;
  }
  applyToolAt(x, y);
  if (state.currentTool === 'fill' || state.currentTool === 'picker') state.isDrawing = false;
});

canvas.addEventListener('mousemove', event => {
  const { x, y } = getCellFromEvent(event);
  state.lastHoverCell = { x, y };
  if (!state.isDrawing) return;

  if (state.currentTool === 'move' && state.moveDrag) {
    updateMoveDrag(x, y);
    return;
  }

  if (state.currentTool === 'paint' || state.currentTool === 'erase') {
    if (event.buttons === 2) {
      state.pixels[y][x] = null;
      drawCanvas();
      drawPreview();
      return;
    }
    applyToolAt(x, y);
  }
});

window.addEventListener('mouseup', () => {
  if (state.isDrawing && state.currentTool === 'move' && state.moveDrag) {
    setStatus(`Inhalt verschoben: <strong>${state.moveDrag.lastOffsetX}, ${state.moveDrag.lastOffsetY}</strong>`);
    state.moveDrag = null;
  }
  if (state.isDrawing && state.dragStart && (state.currentTool === 'rect' || state.currentTool === 'circle')) {
    const end = state.lastHoverCell || state.dragStart;
    applyShape(state.dragStart.x, state.dragStart.y, end.x, end.y, state.currentTool);
    drawCanvas();
    drawPreview();
  }
  state.isDrawing = false;
  state.dragStart = null;
});

window.addEventListener('keydown', event => {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;
  if (event.key === '1') state.currentTool = 'paint';
  if (event.key === '2') state.currentTool = 'erase';
  if (event.key === '3') state.currentTool = 'fill';
  if (event.key === '4') state.currentTool = 'rect';
  if (event.key === '5') state.currentTool = 'circle';
  if (event.key === '6') state.currentTool = 'picker';
  if (event.key === '7') state.currentTool = 'move';
  if (event.key.toLowerCase() === 'g') {
    document.getElementById('toggleTileGridBtn').click();
    return;
  }
  renderTools();
});

document.getElementById('newTileBtn').addEventListener('click', resetEditor);
document.getElementById('saveTileBtn').addEventListener('click', saveTile);
document.getElementById('applyTileSizeBtn').addEventListener('click', applySize);
rgbColorInput.addEventListener('input', () => {
  setCurrentColor(rgbColorInput.value);
  setStatus(`Farbe: <strong>${rgbColorInput.value}</strong>`);
});
rgbRInput.addEventListener('input', applyRgbInputs);
rgbGInput.addEventListener('input', applyRgbInputs);
rgbBInput.addEventListener('input', applyRgbInputs);
document.getElementById('toggleTileGridBtn').addEventListener('click', event => {
  state.showGrid = !state.showGrid;
  event.target.classList.toggle('active', state.showGrid);
  event.target.textContent = state.showGrid ? 'Grid an' : 'Grid aus';
  drawCanvas();
});

window.addEventListener('focus', () => {
  window.DND_TILE_SHARED.refreshFromStorage();
  renderCategoryOptions();
  renderCustomTileList();
});

window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY) return;
  window.DND_TILE_SHARED.refreshFromStorage();
  renderCategoryOptions();
  renderCustomTileList();
});

function init() {
  state.pixels = createEmptyPixels(state.width, state.height);
  renderCategoryOptions();
  renderPalette();
  renderTools();
  syncColorInputs();
  drawCanvas();
  drawPreview();
  renderCustomTileList();
  setStatus('Tile Drawer bereit');
}

init();
