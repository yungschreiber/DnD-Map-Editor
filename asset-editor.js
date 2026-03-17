const STORAGE_KEY = 'dnd-map-editor-assets';
const ASSET_DRAFT_STORAGE_KEY = 'dnd-map-editor-asset-draft';
const REPO_ASSET_MANIFEST_PATH = 'assets/index.json';

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
  picker: '◌',
  load: '◇',
  export: '⇱',
  delete: '✕'
};

BUTTON_ICONS.paint = '✦';
BUTTON_ICONS.erase = '×';
BUTTON_ICONS.fill = '■';
BUTTON_ICONS.rect = '▭';
BUTTON_ICONS.circle = '◯';
BUTTON_ICONS.picker = '◌';
BUTTON_ICONS.load = '◇';
BUTTON_ICONS.export = '⇱';
BUTTON_ICONS.delete = '✕';

BUTTON_ICONS.move = '✋';

const { PALETTE, TILE_CATEGORIES, TILE_MAP, TILE_BY_COLOR } = window.DND_TILE_SHARED;

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
const assetResizeHandleRight = document.getElementById('assetResizeHandleRight');
const assetResizeHandleBottom = document.getElementById('assetResizeHandleBottom');
const assetResizeHandleCorner = document.getElementById('assetResizeHandleCorner');
const tileTextureCache = new Map();

const state = {
  width: 20,
  height: 20,
  cellSize: 32,
  zoom: 1,
  showGrid: true,
  currentTool: 'paint',
  currentColor: '#166534',
  currentTileId: null,
  customColor: '#166534',
  isDrawing: false,
  dragStart: null,
  moveDrag: null,
  hoverCell: null,
  resizeDrag: null,
  openTileCategories: new Set(['basic']),
  assetId: null,
  assetFileName: null,
  pixels: [],
  assets: []
};

let draftSaveTimer = null;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createEmptyPixels(width, height) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => null));
}

function shiftPixels(sourcePixels, offsetX, offsetY, width = state.width, height = state.height) {
  const nextPixels = createEmptyPixels(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sourceX = x - offsetX;
      const sourceY = y - offsetY;
      if (sourceX < 0 || sourceY < 0 || sourceX >= width || sourceY >= height) continue;
      nextPixels[y][x] = sourcePixels[sourceY]?.[sourceX] || null;
    }
  }
  return nextPixels;
}

function normalizeColor(color) {
  return color === '#00000000' ? null : color;
}

function sanitizeAssetFileName(value, fallbackBase = 'asset') {
  const normalized = String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/\.json$/i, '');
  return `${slugify(normalized || fallbackBase)}.json`;
}

function sanitizeAssetDefinition(asset) {
  if (!asset || !Array.isArray(asset.pixels)) return null;
  const width = clamp(parseInt(asset.width, 10) || 0, 1, 30);
  const height = clamp(parseInt(asset.height, 10) || 0, 1, 30);
  if (!width || !height) return null;
  const fallbackBase = asset.name || asset.id || 'asset';

  const pixels = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => asset.pixels[y]?.[x] || null)
  );

  return {
    ...asset,
    id: typeof asset.id === 'string' && asset.id.trim() ? asset.id.trim() : `${slugify(asset.name || 'asset')}-${Date.now()}`,
    width,
    height,
    pixels,
    fileName: sanitizeAssetFileName(asset.fileName, asset.name || asset.id || fallbackBase)
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

function getTileDef(id) {
  return TILE_MAP.get(id) || null;
}

function getTileByColor(color) {
  return color ? TILE_BY_COLOR.get(color.toLowerCase()) || null : null;
}

function getTileTextureImage(tile) {
  const textureSource = tile?.textureDataUrl || tile?.texturePath;
  if (!textureSource) return null;
  if (tileTextureCache.has(textureSource)) return tileTextureCache.get(textureSource);

  const image = new Image();
  image.onload = () => {
    drawEditor();
    drawPreview();
    renderAssetTiles();
  };
  image.src = textureSource;
  tileTextureCache.set(textureSource, image);
  return image;
}

function drawTileTextureImage(targetCtx, tile, x, y, size) {
  const image = getTileTextureImage(tile);
  if (!image?.complete || !image.naturalWidth) return false;
  targetCtx.save();
  targetCtx.imageSmoothingEnabled = false;
  targetCtx.drawImage(image, x * size, y * size, size, size);
  targetCtx.restore();
  return true;
}

function updateStatus(extra = '') {
  setStatus(`
    Tool: <strong>${TOOL_DEFS.find(tool => tool.id === state.currentTool)?.label || '-'}</strong><br>
    Größe: <strong>${state.width} x ${state.height}</strong><br>
    Grid: <strong>${state.showGrid ? 'an' : 'aus'}</strong><br>
    Zoom: <strong>${Math.round(state.zoom * 100)}%</strong><br>
    ${extra}
  `);
}

function syncInputs() {
  assetWidthInput.value = state.width;
  assetHeightInput.value = state.height;
}

function resizeEditorCanvas() {
  canvas.width = state.width * state.cellSize;
  canvas.height = state.height * state.cellSize;
  canvas.style.width = `${canvas.width * state.zoom}px`;
  canvas.style.height = `${canvas.height * state.zoom}px`;
}

function clonePixelsSnapshot() {
  return state.pixels.map(row => [...row]);
}

function buildAssetDraftPayload() {
  return {
    version: 1,
    width: state.width,
    height: state.height,
    zoom: state.zoom,
    showGrid: state.showGrid,
    currentTool: state.currentTool,
    currentColor: state.currentColor,
    currentTileId: state.currentTileId,
    customColor: state.customColor,
    openTileCategories: Array.from(state.openTileCategories),
    assetId: state.assetId,
    assetFileName: state.assetFileName,
    name: assetNameInput.value,
    category: assetCategoryInput.value,
    pixels: clonePixelsSnapshot()
  };
}

function saveAssetDraft() {
  try {
    localStorage.setItem(ASSET_DRAFT_STORAGE_KEY, JSON.stringify(buildAssetDraftPayload()));
  } catch {
    // Ignore storage failures so editing can continue.
  }
}

function scheduleAssetDraftSave() {
  window.clearTimeout(draftSaveTimer);
  draftSaveTimer = window.setTimeout(() => {
    draftSaveTimer = null;
    saveAssetDraft();
  }, 120);
}

function loadAssetDraft() {
  try {
    const raw = localStorage.getItem(ASSET_DRAFT_STORAGE_KEY);
    if (!raw) return false;

    const draft = JSON.parse(raw);
    if (!draft || !Array.isArray(draft.pixels)) return false;

    state.width = clamp(parseInt(draft.width, 10) || state.width, 1, 30);
    state.height = clamp(parseInt(draft.height, 10) || state.height, 1, 30);
    state.zoom = clamp(Number(draft.zoom) || 1, 0.5, 4);
    state.showGrid = draft.showGrid !== false;
    state.currentTool = TOOL_DEFS.some(tool => tool.id === draft.currentTool) ? draft.currentTool : state.currentTool;
    state.currentColor = typeof draft.currentColor === 'string' ? draft.currentColor : state.currentColor;
    state.currentTileId = typeof draft.currentTileId === 'string' ? draft.currentTileId : null;
    state.customColor = typeof draft.customColor === 'string' ? draft.customColor : state.customColor;
    state.openTileCategories = new Set(
      Array.isArray(draft.openTileCategories) && draft.openTileCategories.length
        ? draft.openTileCategories
        : ['basic']
    );
    state.assetId = typeof draft.assetId === 'string' ? draft.assetId : null;
    state.assetFileName = typeof draft.assetFileName === 'string' ? sanitizeAssetFileName(draft.assetFileName) : null;
    state.pixels = Array.from({ length: state.height }, (_, y) =>
      Array.from({ length: state.width }, (_, x) => draft.pixels[y]?.[x] || null)
    );
    assetNameInput.value = typeof draft.name === 'string' ? draft.name : 'Tree Small';
    assetCategoryInput.value = typeof draft.category === 'string' ? draft.category : 'Nature';
    return true;
  } catch {
    return false;
  }
}

function applyAssetResize(newWidth, newHeight, options = {}) {
  const nextWidth = clamp(parseInt(newWidth, 10) || state.width, 1, 30);
  const nextHeight = clamp(parseInt(newHeight, 10) || state.height, 1, 30);
  const sourcePixels = options.sourcePixels || state.pixels;
  const nextPixels = createEmptyPixels(nextWidth, nextHeight);

  for (let y = 0; y < Math.min(sourcePixels.length, nextHeight); y++) {
    for (let x = 0; x < Math.min(sourcePixels[y]?.length || 0, nextWidth); x++) {
      nextPixels[y][x] = sourcePixels[y][x];
    }
  }

  state.width = nextWidth;
  state.height = nextHeight;
  state.pixels = nextPixels;
  syncInputs();
  resizeEditorCanvas();
  drawEditor();
  drawPreview();
  setStatus(options.statusMessage || `Raster angepasst: <strong>${state.width}x${state.height}</strong>`);
  scheduleAssetDraftSave();
}

function refreshSharedTiles() {
  window.DND_TILE_SHARED.refreshFromStorage();
  const validTile = state.currentTileId && TILE_MAP.has(state.currentTileId);
  if (!validTile) state.currentTileId = null;
  renderAssetTiles();
  drawEditor();
  drawPreview();
}

function hash2D(x, y, seed = 0) {
  const n = Math.sin((x + 1) * 127.1 + (y + 1) * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function shadeHex(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 255) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 255) + percent));
  const b = Math.min(255, Math.max(0, (num & 255) + percent));
  return `rgb(${r}, ${g}, ${b})`;
}

function hasSameTileColor(x, y, color) {
  return x >= 0 && y >= 0 && x < state.width && y < state.height && (state.pixels[y][x] || null) === color;
}

function drawPixelTexture(targetCtx, tileId, x, y, size, baseColor) {
  const pixelStep = Math.max(2, Math.floor(size / 6));
  const worldBaseX = Math.floor(x / 2) * 2;
  const worldBaseY = Math.floor(y / 2) * 2;
  const inTwoByTwo = hasSameTileColor(x + 1, y, baseColor) && hasSameTileColor(x, y + 1, baseColor) && hasSameTileColor(x + 1, y + 1, baseColor)
    || hasSameTileColor(x - 1, y, baseColor) && hasSameTileColor(x, y + 1, baseColor) && hasSameTileColor(x - 1, y + 1, baseColor)
    || hasSameTileColor(x + 1, y, baseColor) && hasSameTileColor(x, y - 1, baseColor) && hasSameTileColor(x + 1, y - 1, baseColor)
    || hasSameTileColor(x - 1, y, baseColor) && hasSameTileColor(x, y - 1, baseColor) && hasSameTileColor(x - 1, y - 1, baseColor);

  const patternOffsetX = inTwoByTwo ? (x - worldBaseX) * Math.floor(size / 2) : 0;
  const patternOffsetY = inTwoByTwo ? (y - worldBaseY) * Math.floor(size / 2) : 0;

  for (let py = 0; py < size; py += pixelStep) {
    for (let px = 0; px < size; px += pixelStep) {
      const wx = Math.floor((patternOffsetX + px) / pixelStep);
      const wy = Math.floor((patternOffsetY + py) / pixelStep);
      const noise = hash2D(wx + x * 3, wy + y * 5, tileId.length);
      let shade = 0;

      if (tileId === 'grass' || tileId === 'bush' || tileId === 'trees') shade = noise > 0.75 ? 18 : noise < 0.18 ? -18 : 0;
      else if (tileId === 'water') shade = noise > 0.7 ? 24 : noise < 0.2 ? -20 : 0;
      else if (tileId === 'wood' || tileId === 'fence' || tileId === 'treasure-chest' || tileId === 'bed' || tileId === 'barrel') shade = (wy % 3 === 0) ? 14 : noise < 0.15 ? -16 : 0;
      else if (tileId === 'roof') shade = (wy % 2 === 0) ? 18 : noise < 0.2 ? -18 : 0;
      else if (tileId === 'stone' || tileId === 'wall' || tileId === 'stone-floor' || tileId === 'brick-wall' || tileId === 'pillar' || tileId === 'prison-cell') shade = noise > 0.8 ? 16 : noise < 0.18 ? -22 : 0;
      else if (tileId === 'sand') shade = noise > 0.7 ? 12 : noise < 0.22 ? -10 : 0;
      else if (tileId === 'dirt' || tileId === 'earth' || tileId === 'trap') shade = noise > 0.75 ? 10 : noise < 0.2 ? -14 : 0;
      else if (tileId === 'lava') shade = noise > 0.72 ? 24 : noise < 0.25 ? -14 : 0;
      else if (tileId === 'floor' || tileId === 'stairs') shade = noise > 0.82 ? 10 : noise < 0.14 ? -10 : 0;
      else shade = noise > 0.8 ? 8 : noise < 0.18 ? -8 : 0;

      targetCtx.fillStyle = shadeHex(baseColor, shade);
      targetCtx.fillRect(x * size + px, y * size + py, Math.min(pixelStep, size - px), Math.min(pixelStep, size - py));
    }
  }
}

function drawTileOverlay(targetCtx, tileId, x, y, size) {
  if (tileId === 'door') {
    targetCtx.fillStyle = 'rgba(255,255,255,0.25)';
    targetCtx.fillRect(x * size + size * 0.2, y * size + size * 0.42, size * 0.6, size * 0.16);
  }
  if (tileId === 'window') {
    targetCtx.fillStyle = 'rgba(255,255,255,0.35)';
    targetCtx.fillRect(x * size + size * 0.18, y * size + size * 0.18, size * 0.64, size * 0.64);
    targetCtx.fillStyle = 'rgba(15,23,42,0.55)';
    targetCtx.fillRect(x * size + size * 0.47, y * size + size * 0.18, size * 0.06, size * 0.64);
    targetCtx.fillRect(x * size + size * 0.18, y * size + size * 0.47, size * 0.64, size * 0.06);
  }
  if (tileId === 'stairs') {
    targetCtx.fillStyle = 'rgba(255,255,255,0.22)';
    for (let i = 0; i < 5; i++) {
      const inset = i * (size * 0.08);
      targetCtx.fillRect(x * size + inset, y * size + size * 0.72 - inset, size - inset * 1.2, size * 0.06);
    }
  }
  if (tileId === 'fence') {
    targetCtx.fillStyle = 'rgba(255,255,255,0.28)';
    targetCtx.fillRect(x * size + size * 0.18, y * size + size * 0.28, size * 0.08, size * 0.44);
    targetCtx.fillRect(x * size + size * 0.46, y * size + size * 0.28, size * 0.08, size * 0.44);
    targetCtx.fillRect(x * size + size * 0.74, y * size + size * 0.28, size * 0.08, size * 0.44);
    targetCtx.fillRect(x * size + size * 0.16, y * size + size * 0.38, size * 0.68, size * 0.06);
    targetCtx.fillRect(x * size + size * 0.16, y * size + size * 0.58, size * 0.68, size * 0.06);
  }
  if (tileId === 'treasure-chest') {
    targetCtx.fillStyle = 'rgba(41,24,12,0.5)';
    targetCtx.fillRect(x * size + size * 0.18, y * size + size * 0.42, size * 0.64, size * 0.3);
    targetCtx.fillStyle = 'rgba(181,137,58,0.55)';
    targetCtx.fillRect(x * size + size * 0.18, y * size + size * 0.36, size * 0.64, size * 0.08);
    targetCtx.fillRect(x * size + size * 0.46, y * size + size * 0.36, size * 0.08, size * 0.36);
  }
  if (tileId === 'bed') {
    targetCtx.fillStyle = 'rgba(245,245,245,0.55)';
    targetCtx.fillRect(x * size + size * 0.18, y * size + size * 0.18, size * 0.22, size * 0.18);
    targetCtx.fillStyle = 'rgba(153,27,27,0.42)';
    targetCtx.fillRect(x * size + size * 0.18, y * size + size * 0.36, size * 0.62, size * 0.34);
    targetCtx.fillStyle = 'rgba(60,38,24,0.45)';
    targetCtx.fillRect(x * size + size * 0.16, y * size + size * 0.14, size * 0.68, size * 0.06);
    targetCtx.fillRect(x * size + size * 0.16, y * size + size * 0.72, size * 0.68, size * 0.06);
  }
  if (tileId === 'barrel') {
    targetCtx.fillStyle = 'rgba(60,38,24,0.18)';
    targetCtx.beginPath();
    targetCtx.ellipse(x * size + size * 0.5, y * size + size * 0.5, size * 0.28, size * 0.28, 0, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.strokeStyle = 'rgba(220,220,220,0.38)';
    targetCtx.lineWidth = Math.max(1, size * 0.05);
    targetCtx.beginPath();
    targetCtx.arc(x * size + size * 0.5, y * size + size * 0.5, size * 0.23, 0, Math.PI * 2);
    targetCtx.stroke();
    targetCtx.beginPath();
    targetCtx.moveTo(x * size + size * 0.34, y * size + size * 0.5);
    targetCtx.lineTo(x * size + size * 0.66, y * size + size * 0.5);
    targetCtx.stroke();
  }
  if (tileId === 'roof') {
    targetCtx.strokeStyle = 'rgba(255,245,235,0.28)';
    targetCtx.lineWidth = Math.max(1, size * 0.05);
    for (let row = 0.24; row <= 0.78; row += 0.18) {
      targetCtx.beginPath();
      targetCtx.moveTo(x * size + size * 0.12, y * size + size * row);
      targetCtx.lineTo(x * size + size * 0.88, y * size + size * row);
      targetCtx.stroke();
    }
    targetCtx.strokeStyle = 'rgba(120,53,15,0.32)';
    targetCtx.beginPath();
    targetCtx.moveTo(x * size + size * 0.5, y * size + size * 0.12);
    targetCtx.lineTo(x * size + size * 0.5, y * size + size * 0.88);
    targetCtx.stroke();
  }
  if (tileId === 'trap') {
    targetCtx.strokeStyle = 'rgba(255,255,255,0.42)';
    targetCtx.lineWidth = Math.max(1, size * 0.06);
    targetCtx.beginPath();
    targetCtx.moveTo(x * size + size * 0.22, y * size + size * 0.22);
    targetCtx.lineTo(x * size + size * 0.78, y * size + size * 0.78);
    targetCtx.moveTo(x * size + size * 0.78, y * size + size * 0.22);
    targetCtx.lineTo(x * size + size * 0.22, y * size + size * 0.78);
    targetCtx.stroke();
  }
  if (tileId === 'pillar') {
    targetCtx.fillStyle = 'rgba(255,255,255,0.25)';
    targetCtx.fillRect(x * size + size * 0.28, y * size + size * 0.18, size * 0.44, size * 0.64);
  }
  if (tileId === 'prison-cell') {
    targetCtx.strokeStyle = 'rgba(225,232,240,0.42)';
    targetCtx.lineWidth = Math.max(1, size * 0.05);
    for (let col = 0.2; col <= 0.8; col += 0.18) {
      targetCtx.beginPath();
      targetCtx.moveTo(x * size + size * col, y * size + size * 0.14);
      targetCtx.lineTo(x * size + size * col, y * size + size * 0.86);
      targetCtx.stroke();
    }
    targetCtx.fillStyle = 'rgba(15,23,42,0.42)';
    targetCtx.fillRect(x * size + size * 0.14, y * size + size * 0.18, size * 0.72, size * 0.1);
    targetCtx.fillRect(x * size + size * 0.14, y * size + size * 0.72, size * 0.72, size * 0.1);
  }
}

function drawTileTextureCell(targetCtx, tileId, color, x, y, size) {
  const tile = getTileDef(tileId);
  if (tile && drawTileTextureImage(targetCtx, tile, x, y, size)) return;

  targetCtx.save();
  if (tileId === 'barrel') {
    targetCtx.beginPath();
    targetCtx.ellipse(
      x * size + size * 0.5,
      y * size + size * 0.5,
      size * 0.28,
      size * 0.28,
      0,
      0,
      Math.PI * 2
    );
    targetCtx.clip();
  }
  targetCtx.fillStyle = color;
  targetCtx.fillRect(x * size, y * size, size, size);
  drawPixelTexture(targetCtx, tileId, x, y, size, color);
  targetCtx.restore();
  drawTileOverlay(targetCtx, tileId, x, y, size);
}

function createTileTexturePreview(tile, previewSize = 18) {
  const preview = document.createElement('canvas');
  preview.width = previewSize;
  preview.height = previewSize;
  const previewContext = preview.getContext('2d');
  previewContext.imageSmoothingEnabled = false;

  if (drawTileTextureImage(previewContext, tile, 0, 0, previewSize)) {
    preview.className = 'swatch swatch-canvas';
    return preview;
  }

  previewContext.save();
  if (tile.id === 'barrel') {
    previewContext.beginPath();
    previewContext.ellipse(
      previewSize * 0.5,
      previewSize * 0.5,
      previewSize * 0.28,
      previewSize * 0.28,
      0,
      0,
      Math.PI * 2
    );
    previewContext.clip();
  }
  previewContext.fillStyle = tile.color;
  previewContext.fillRect(0, 0, previewSize, previewSize);
  drawPixelTexture(previewContext, tile.id, 0, 0, previewSize, tile.color);
  previewContext.restore();
  drawTileOverlay(previewContext, tile.id, 0, 0, previewSize);
  preview.className = 'swatch swatch-canvas';
  return preview;
}

function drawEditor(preview = null) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0f0f0f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const color = state.pixels[y][x];
      if (!color) continue;
      const tile = getTileByColor(color);
      if (tile) drawTileTextureCell(ctx, tile.id, color, x, y, state.cellSize);
      else {
        ctx.fillStyle = color;
        ctx.fillRect(x * state.cellSize, y * state.cellSize, state.cellSize, state.cellSize);
      }
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

  if (state.showGrid) {
    ctx.save();
    ctx.globalCompositeOperation = 'difference';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.18;
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

    const crossSize = Math.max(3, Math.floor(state.cellSize * 0.18));
    ctx.globalAlpha = 0.55;
    for (let x = 0; x <= state.width; x += 2) {
      for (let y = 0; y <= state.height; y += 2) {
        const px = x * state.cellSize + 0.5;
        const py = y * state.cellSize + 0.5;
        ctx.beginPath();
        ctx.moveTo(px - crossSize, py);
        ctx.lineTo(px + crossSize, py);
        ctx.moveTo(px, py - crossSize);
        ctx.lineTo(px, py + crossSize);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function drawPreview() {
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  previewCtx.fillStyle = '#0f0f0f';
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
      const tile = getTileByColor(color);
      if (tile) {
        previewCtx.save();
        previewCtx.translate(offsetX, offsetY);
        drawTileTextureCell(previewCtx, tile.id, color, x, y, size);
        previewCtx.restore();
      } else {
        previewCtx.fillStyle = color;
        previewCtx.fillRect(offsetX + x * size, offsetY + y * size, size, size);
      }
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
      scheduleAssetDraftSave();
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
  updateStatus(`Farbe: <strong>${nextColor}</strong>`);
  scheduleAssetDraftSave();
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
      scheduleAssetDraftSave();
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
      btn.appendChild(createTileTexturePreview(tile));
      const label = document.createElement('span');
      label.textContent = tile.label;
      btn.appendChild(label);
      btn.addEventListener('click', () => {
        state.currentTileId = tile.id;
        state.openTileCategories.add(category.id);
        setCurrentColor(tile.color, {
          keepTileSelection: true,
          statusMessage: `Tile ausgewaehlt: <strong>${tile.label}</strong>`
        });
        renderAssetTiles();
        scheduleAssetDraftSave();
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
      scheduleAssetDraftSave();
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.assets.map(toSerializableAsset)));
}

function loadAssetsFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      .map(sanitizeAssetDefinition)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportAsset(asset = null) {
  const target = asset || buildCurrentAsset();
  downloadJson(getAssetFileName(target), toSerializableAsset(target));
  setStatus(`Asset exportiert: <strong>${target.name}</strong>`);
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'asset';
}

function getAssetFileName(asset) {
  return sanitizeAssetFileName(asset?.fileName, asset?.name || asset?.id || 'asset');
}

function toSerializableAsset(asset) {
  return {
    id: asset.id,
    name: asset.name,
    category: asset.category,
    width: asset.width,
    height: asset.height,
    pixels: asset.pixels.map(row => [...row]),
    updatedAt: asset.updatedAt || new Date().toISOString(),
    fileName: getAssetFileName(asset)
  };
}

function ensureUniqueAssetFileName(fileName, assetId) {
  const normalized = sanitizeAssetFileName(fileName);
  const baseName = normalized.replace(/\.json$/i, '');
  let candidate = normalized;
  let suffix = 2;

  while (state.assets.some(asset => asset.id !== assetId && getAssetFileName(asset) === candidate)) {
    candidate = `${baseName}-${suffix}.json`;
    suffix += 1;
  }

  return candidate;
}

function getRepoManifestPayload() {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    assets: state.assets.map(asset => ({
      id: asset.id,
      name: asset.name,
      category: asset.category,
      updatedAt: asset.updatedAt || null,
      path: `assets/${getAssetFileName(asset)}`
    }))
  };
}

async function loadAssetsFromRepo() {
  if (!window.isSecureContext || window.location.protocol === 'file:') return [];

  try {
    const manifestResponse = await fetch(`${REPO_ASSET_MANIFEST_PATH}?t=${Date.now()}`, { cache: 'no-store' });
    if (!manifestResponse.ok) return [];

    const manifest = await manifestResponse.json();
    const entries = Array.isArray(manifest?.assets) ? manifest.assets : [];
    const repoAssets = await Promise.all(entries.map(async entry => {
      const assetPath = typeof entry === 'string' ? entry : entry?.path;
      if (typeof assetPath !== 'string' || !assetPath.trim()) return null;

      try {
        const response = await fetch(`${assetPath}?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return null;
        const asset = sanitizeAssetDefinition(await response.json());
        if (!asset) return null;
        return {
          ...asset,
          fileName: sanitizeAssetFileName(entry?.fileName || asset.fileName || assetPath, asset.name || asset.id || 'asset')
        };
      } catch {
        return null;
      }
    }));

    return repoAssets.filter(Boolean);
  } catch {
    return [];
  }
}

function mergeAssets(repoAssets, localAssets) {
  const assetMap = new Map();

  [...repoAssets, ...localAssets].forEach(asset => {
    const current = assetMap.get(asset.id);
    if (!current) {
      assetMap.set(asset.id, asset);
      return;
    }

    const currentTime = Date.parse(current.updatedAt || 0) || 0;
    const nextTime = Date.parse(asset.updatedAt || 0) || 0;
    assetMap.set(asset.id, nextTime >= currentTime ? asset : current);
  });

  return Array.from(assetMap.values())
    .map(sanitizeAssetDefinition)
    .filter(Boolean)
    .sort((a, b) => (Date.parse(b.updatedAt || 0) || 0) - (Date.parse(a.updatedAt || 0) || 0));
}

async function refreshAssetLibrary(options = {}) {
  const repoAssets = await loadAssetsFromRepo();
  const localAssets = loadAssetsFromStorage();
  state.assets = mergeAssets(repoAssets, localAssets);

  if (options.persist !== false) saveAssets();
  renderAssetList();
  return repoAssets.length;
}

async function exportRepoFiles() {
  if (!state.assets.length) {
    setStatus('Keine Assets zum Repo-Export vorhanden');
    return;
  }

  const manifest = getRepoManifestPayload();

  if (window.showDirectoryPicker && window.isSecureContext) {
    try {
      const rootHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const assetDirHandle = rootHandle.name === 'assets'
        ? rootHandle
        : await rootHandle.getDirectoryHandle('assets', { create: true });

      for (const asset of state.assets) {
        const fileHandle = await assetDirHandle.getFileHandle(getAssetFileName(asset), { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(toSerializableAsset(asset), null, 2));
        await writable.close();
      }

      const manifestHandle = await assetDirHandle.getFileHandle('index.json', { create: true });
      const manifestWritable = await manifestHandle.createWritable();
      await manifestWritable.write(JSON.stringify(manifest, null, 2));
      await manifestWritable.close();

      setStatus('Repo-Dateien in den gewählten assets-Ordner geschrieben');
      return;
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setStatus('Direktes Schreiben nicht möglich, wechsle zu Download-Dateien');
      } else {
        setStatus('Repo-Export abgebrochen');
        return;
      }
    }
  }

  state.assets.forEach(asset => downloadJson(getAssetFileName(asset), toSerializableAsset(asset)));
  downloadJson('index.json', manifest);
  setStatus('Repo-Dateien als Downloads exportiert');
}

function buildCurrentAsset() {
  const name = assetNameInput.value.trim() || 'Unnamed Asset';
  const id = state.assetId || `${slugify(name)}-${Date.now()}`;
  const fileName = ensureUniqueAssetFileName(
    state.assetFileName || `${slugify(name)}.json`,
    id
  );

  return {
    id,
    name,
    category: assetCategoryInput.value.trim() || 'Misc',
    width: state.width,
    height: state.height,
    pixels: state.pixels.map(row => [...row]),
    updatedAt: new Date().toISOString(),
    fileName
  };
}

function saveCurrentAsset() {
  const asset = buildCurrentAsset();
  const existingIndex = state.assets.findIndex(entry => entry.id === asset.id);
  if (existingIndex === -1) state.assets.unshift(asset);
  else state.assets.splice(existingIndex, 1, asset);

  state.assetId = asset.id;
  state.assetFileName = asset.fileName;
  saveAssets();
  renderAssetList();
  setStatus(`Asset gespeichert: <strong>${asset.name}</strong>`);
  scheduleAssetDraftSave();
}

function loadAsset(assetId) {
  const asset = state.assets.find(entry => entry.id === assetId);
  if (!asset) return;

  state.assetId = asset.id;
  state.assetFileName = getAssetFileName(asset);
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
  scheduleAssetDraftSave();
}

function deleteAsset(assetId) {
  state.assets = state.assets.filter(asset => asset.id !== assetId);
  if (state.assetId === assetId) {
    state.assetId = null;
    state.assetFileName = null;
  }
  saveAssets();
  renderAssetList();
  setStatus('Asset gelöscht');
  scheduleAssetDraftSave();
}

function applyGridSize() {
  applyAssetResize(assetWidthInput.value, assetHeightInput.value);
}

function fitAssetToContent() {
  let minX = state.width;
  let minY = state.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (!state.pixels[y][x]) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX === -1) {
    state.width = 1;
    state.height = 1;
    state.pixels = createEmptyPixels(1, 1);
    syncInputs();
    resizeEditorCanvas();
    drawEditor();
    drawPreview();
    setStatus('Asset enthält keine Pixel und wurde auf 1x1 zurückgesetzt');
    scheduleAssetDraftSave();
    return;
  }

  const nextWidth = maxX - minX + 1;
  const nextHeight = maxY - minY + 1;
  const nextPixels = createEmptyPixels(nextWidth, nextHeight);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      nextPixels[y - minY][x - minX] = state.pixels[y][x];
    }
  }

  state.width = nextWidth;
  state.height = nextHeight;
  state.pixels = nextPixels;
  syncInputs();
  resizeEditorCanvas();
  drawEditor();
  drawPreview();
  setStatus(`Inhalt angepasst: <strong>${state.width}x${state.height}</strong>`);
  scheduleAssetDraftSave();
}

function resetEditor() {
  state.assetId = null;
  state.assetFileName = null;
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
  scheduleAssetDraftSave();
}

function getCellFromEvent(evt) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((evt.clientX - rect.left) / (state.cellSize * state.zoom));
  const y = Math.floor((evt.clientY - rect.top) / (state.cellSize * state.zoom));
  return {
    x: clamp(x, 0, state.width - 1),
    y: clamp(y, 0, state.height - 1)
  };
}

function getCellFromClient(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((clientX - rect.left) / (state.cellSize * state.zoom));
  const y = Math.floor((clientY - rect.top) / (state.cellSize * state.zoom));
  return {
    x: clamp(x, 0, state.width - 1),
    y: clamp(y, 0, state.height - 1)
  };
}

function getResizeHandleDirection(handle) {
  if (handle === assetResizeHandleRight) return 'right';
  if (handle === assetResizeHandleBottom) return 'bottom';
  return 'corner';
}

function startResizeDrag(direction, evt) {
  evt.preventDefault();
  evt.stopPropagation();
  state.resizeDrag = {
    direction,
    startClientX: evt.clientX,
    startClientY: evt.clientY,
    startWidth: state.width,
    startHeight: state.height,
    snapshot: clonePixelsSnapshot()
  };

  [assetResizeHandleRight, assetResizeHandleBottom, assetResizeHandleCorner].forEach(handle => {
    handle.classList.toggle('active', getResizeHandleDirection(handle) === direction);
  });
  document.body.style.userSelect = 'none';
}

function updateResizeDrag(evt) {
  if (!state.resizeDrag) return;
  const stepSize = state.cellSize * state.zoom;
  const deltaX = Math.round((evt.clientX - state.resizeDrag.startClientX) / stepSize);
  const deltaY = Math.round((evt.clientY - state.resizeDrag.startClientY) / stepSize);

  const nextWidth = state.resizeDrag.direction === 'bottom'
    ? state.resizeDrag.startWidth
    : state.resizeDrag.startWidth + deltaX;
  const nextHeight = state.resizeDrag.direction === 'right'
    ? state.resizeDrag.startHeight
    : state.resizeDrag.startHeight + deltaY;

  applyAssetResize(nextWidth, nextHeight, {
    sourcePixels: state.resizeDrag.snapshot,
    statusMessage: `Rastergröße: <strong>${clamp(nextWidth, 1, 30)} x ${clamp(nextHeight, 1, 30)}</strong>`
  });
}

function endResizeDrag() {
  if (!state.resizeDrag) return;
  state.resizeDrag = null;
  [assetResizeHandleRight, assetResizeHandleBottom, assetResizeHandleCorner].forEach(handle => handle.classList.remove('active'));
  document.body.style.userSelect = '';
  updateStatus('Rastergröße per Ziehen angepasst');
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
  scheduleAssetDraftSave();
}

function updateMoveDrag(x, y) {
  if (!state.moveDrag) return;
  const offsetX = x - state.moveDrag.startX;
  const offsetY = y - state.moveDrag.startY;
  if (offsetX === state.moveDrag.lastOffsetX && offsetY === state.moveDrag.lastOffsetY) return;
  state.moveDrag.lastOffsetX = offsetX;
  state.moveDrag.lastOffsetY = offsetY;
  state.pixels = shiftPixels(state.moveDrag.snapshot, offsetX, offsetY);
  drawEditor();
  drawPreview();
  updateStatus(`Verschiebung: <strong>${offsetX}, ${offsetY}</strong>`);
  scheduleAssetDraftSave();
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
        updatedAt: new Date().toISOString(),
        fileName: sanitizeAssetFileName(asset.fileName, asset.name || asset.id || 'asset')
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
  if (state.resizeDrag) return;
  const { x, y } = getCellFromEvent(evt);
  state.hoverCell = { x, y };

  if (state.currentTool === 'move') {
    state.isDrawing = true;
    state.dragStart = { x, y };
    state.moveDrag = {
      startX: x,
      startY: y,
      snapshot: clonePixelsSnapshot(),
      lastOffsetX: 0,
      lastOffsetY: 0
    };
    updateStatus('Verschiebung: <strong>0, 0</strong>');
    return;
  }

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
  if (state.resizeDrag) return;
  const { x, y } = getCellFromEvent(evt);
  state.hoverCell = { x, y };

  if (state.isDrawing && state.currentTool === 'move' && state.moveDrag) {
    updateMoveDrag(x, y);
    return;
  }

  if (state.isDrawing && (state.currentTool === 'paint' || state.currentTool === 'erase')) {
    applyToolAt(x, y);
    return;
  }

  if (state.isDrawing && (state.currentTool === 'rect' || state.currentTool === 'circle') && state.dragStart) {
    drawEditor({ tool: state.currentTool, start: state.dragStart, end: { x, y } });
  }
});

canvas.addEventListener('mouseleave', () => {
  state.hoverCell = null;
  if (!state.isDrawing) drawEditor();
  updateStatus();
});

window.addEventListener('mouseup', () => {
  if (state.resizeDrag) {
    endResizeDrag();
    return;
  }
  if (state.isDrawing && state.currentTool === 'move' && state.moveDrag) {
    updateStatus(`Inhalt verschoben: <strong>${state.moveDrag.lastOffsetX}, ${state.moveDrag.lastOffsetY}</strong>`);
    state.moveDrag = null;
    state.isDrawing = false;
    state.dragStart = null;
    return;
  }
  if (state.isDrawing && state.dragStart && state.hoverCell && (state.currentTool === 'rect' || state.currentTool === 'circle')) {
    applyShape(state.dragStart.x, state.dragStart.y, state.hoverCell.x, state.hoverCell.y, state.currentTool);
    drawEditor();
    drawPreview();
    scheduleAssetDraftSave();
  }
  state.isDrawing = false;
  state.dragStart = null;
});

window.addEventListener('mousemove', evt => {
  if (state.isDrawing && state.currentTool === 'move' && state.moveDrag) {
    const { x, y } = getCellFromClient(evt.clientX, evt.clientY);
    state.hoverCell = { x, y };
    updateMoveDrag(x, y);
  }
  updateResizeDrag(evt);
});

document.getElementById('applyGridBtn').addEventListener('click', applyGridSize);
document.getElementById('fitAssetBtn').addEventListener('click', fitAssetToContent);
document.getElementById('newAssetBtn').addEventListener('click', resetEditor);
document.getElementById('saveAssetBtn').addEventListener('click', saveCurrentAsset);
document.getElementById('exportAssetBtn').addEventListener('click', () => exportAsset());
document.getElementById('exportRepoBtn').addEventListener('click', () => {
  void exportRepoFiles();
});
assetImportInput.addEventListener('change', event => importAssetFile(event.target.files[0]));
assetNameInput.addEventListener('input', scheduleAssetDraftSave);
assetCategoryInput.addEventListener('input', scheduleAssetDraftSave);
rgbColorInput.addEventListener('input', () => {
  setCurrentColor(rgbColorInput.value);
  setStatus(`Farbe: <strong>${rgbColorInput.value}</strong>`);
  scheduleAssetDraftSave();
});
rgbRInput.addEventListener('input', applyRgbInputs);
rgbGInput.addEventListener('input', applyRgbInputs);
rgbBInput.addEventListener('input', applyRgbInputs);
document.getElementById('toggleAssetGridBtn').addEventListener('click', (event) => {
  state.showGrid = !state.showGrid;
  event.target.classList.toggle('active', state.showGrid);
  event.target.textContent = state.showGrid ? 'Grid an' : 'Grid aus';
  drawEditor();
  updateStatus();
  scheduleAssetDraftSave();
});
document.getElementById('assetZoomInBtn').addEventListener('click', () => {
  state.zoom = clamp(Number((state.zoom + 0.25).toFixed(2)), 0.5, 4);
  resizeEditorCanvas();
  updateStatus();
  scheduleAssetDraftSave();
});
document.getElementById('assetZoomOutBtn').addEventListener('click', () => {
  state.zoom = clamp(Number((state.zoom - 0.25).toFixed(2)), 0.5, 4);
  resizeEditorCanvas();
  updateStatus();
  scheduleAssetDraftSave();
});
document.getElementById('assetZoomResetBtn').addEventListener('click', () => {
  state.zoom = 1;
  resizeEditorCanvas();
  updateStatus();
  scheduleAssetDraftSave();
});

[assetResizeHandleRight, assetResizeHandleBottom, assetResizeHandleCorner].forEach(handle => {
  handle.addEventListener('mousedown', evt => {
    startResizeDrag(getResizeHandleDirection(handle), evt);
  });
});

window.addEventListener('keydown', (event) => {
  if (event.target.tagName === 'INPUT') return;
  if (event.key === '1') state.currentTool = 'paint';
  if (event.key === '2') state.currentTool = 'erase';
  if (event.key === '3') state.currentTool = 'fill';
  if (event.key === '4') state.currentTool = 'rect';
  if (event.key === '5') state.currentTool = 'circle';
  if (event.key === '6') state.currentTool = 'picker';
  if (event.key === '7') state.currentTool = 'move';
  if (event.key.toLowerCase() === 'g') {
    document.getElementById('toggleAssetGridBtn').click();
    return;
  }
  if (event.key === '+') state.zoom = clamp(Number((state.zoom + 0.25).toFixed(2)), 0.5, 4);
  if (event.key === '-') state.zoom = clamp(Number((state.zoom - 0.25).toFixed(2)), 0.5, 4);
  renderTools();
  resizeEditorCanvas();
  drawEditor();
  updateStatus();
  scheduleAssetDraftSave();
});

window.addEventListener('pagehide', saveAssetDraft);
window.addEventListener('beforeunload', saveAssetDraft);
window.addEventListener('focus', refreshSharedTiles);
window.addEventListener('storage', (event) => {
  if (event.key !== window.DND_TILE_SHARED.CUSTOM_TILE_STORAGE_KEY) return;
  refreshSharedTiles();
});

async function init() {
  const repoAssetCount = await refreshAssetLibrary({ persist: true });
  const hasDraft = loadAssetDraft();
  if (!hasDraft) {
    state.pixels = createEmptyPixels(state.width, state.height);
  }
  syncInputs();
  const toggleAssetGridBtn = document.getElementById('toggleAssetGridBtn');
  toggleAssetGridBtn.classList.toggle('active', state.showGrid);
  toggleAssetGridBtn.textContent = state.showGrid ? 'Grid an' : 'Grid aus';
  renderPalette();
  renderAssetTiles();
  syncColorInputs();
  renderTools();
  renderAssetList();
  resizeEditorCanvas();
  drawEditor();
  drawPreview();
  if (hasDraft) updateStatus('Letzten Asset-Entwurf wiederhergestellt');
  else if (repoAssetCount) updateStatus(`Repo-Bibliothek geladen: <strong>${repoAssetCount}</strong> Assets`);
  else updateStatus('Rasterbasierter Asset-Editor bereit');
  if (!hasDraft) saveAssetDraft();
}

void init();
