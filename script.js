    const LEGACY_TILE_TYPES = [
      { id: 'floor', label: 'Boden', color: '#6b7280' },
      { id: 'wall', label: 'Wand', color: '#374151' },
      { id: 'water', label: 'Wasser', color: '#2563eb' },
      { id: 'grass', label: 'Gras', color: '#16a34a' },
      { id: 'door', label: 'Tür', color: '#a16207' },
      { id: 'window', label: 'Fenster', color: '#60a5fa' },
      { id: 'stairs', label: 'Treppen', color: '#9ca3af' },
      { id: 'wood', label: 'Holz', color: '#8b5a2b' },
      { id: 'sand', label: 'Sand', color: '#d4b36a' },
      { id: 'dirt', label: 'Erde', color: '#7c4a2d' },
      { id: 'lava', label: 'Lava', color: '#dc2626' },
      { id: 'stone', label: 'Stein', color: '#94a3b8' },
      { id: 'void', label: 'Leer', color: '#111827' }
    ];

    const ASSET_STORAGE_KEY = 'dnd-map-editor-assets';
    const MAP_DRAFT_STORAGE_KEY = 'dnd-map-editor-map-draft';
    const REPO_ASSET_MANIFEST_PATH = 'assets/index.json';

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

    const TILE_TYPES = TILE_CATEGORIES.flatMap(category =>
      category.tiles.map(tile => ({ ...tile, categoryId: category.id, categoryLabel: category.label }))
    );
    TILE_TYPES.push({ id: 'void', label: 'Leer', color: '#111827', categoryId: 'system', categoryLabel: 'System' });
    const TILE_MAP = new Map(TILE_TYPES.map(tile => [tile.id, tile]));

    const TOOLS = [
      { id: 'paint', label: 'Pinsel' },
      { id: 'erase', label: 'Radierer' },
      { id: 'fill', label: 'Fill' },
      { id: 'rect', label: 'Rechteck' },
      { id: 'circle', label: 'Kreis' },
      { id: 'text', label: 'Text' }
    ];

    const BUTTON_ICONS = {
      paint: '✦',
      erase: '×',
      fill: '■',
      rect: '▭',
      circle: '◯',
      text: 'T',
      select: '◇',
      rename: '✎',
      visible: '◉',
      hidden: '◎',
      delete: '✕'
    };

    BUTTON_ICONS.paint = '✦';
    BUTTON_ICONS.erase = '×';
    BUTTON_ICONS.fill = '■';
    BUTTON_ICONS.rect = '▭';
    BUTTON_ICONS.circle = '◯';
    BUTTON_ICONS.select = '◇';
    BUTTON_ICONS.rename = '✎';
    BUTTON_ICONS.visible = '◉';
    BUTTON_ICONS.hidden = '◎';
    BUTTON_ICONS.delete = '✕';

    const canvas = document.getElementById('mapCanvas');
    const mapStage = document.getElementById('mapStage');
    const resizeHandleRight = document.getElementById('resizeHandleRight');
    const resizeHandleBottom = document.getElementById('resizeHandleBottom');
    const resizeHandleCorner = document.getElementById('resizeHandleCorner');
    const ctx = canvas.getContext('2d');
    const statusBox = document.getElementById('statusBox');
    const tileButtons = document.getElementById('tileButtons');
    const toolButtons = document.getElementById('toolButtons');
    const layerList = document.getElementById('layerList');
    const assetLibraryList = document.getElementById('assetLibraryList');

    const state = {
      mapWidth: 30,
      mapHeight: 20,
      tileSize: 24,
      zoom: 1,
      showGrid: true,
      selectedTile: 'stone',
      selectedTool: 'paint',
      selectedAssetId: null,
      selectedAssetRotation: 0,
      isDrawing: false,
      dragStart: null,
      hoverCell: null,
      layers: [],
      assetLibrary: [],
      activeLayerId: null,
      nextLayerId: 2,
      history: [],
      redoStack: [],
      draggedLayerId: null,
      dropTargetLayerId: null,
      openTileCategories: new Set(['basic']),
      resizeDrag: null
    };

    let draftSaveTimer = null;

    function createEmptyAssetItems() {
      return [];
    }

    function createEmptyTiles(width, height, fill = 'void') {
      return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
    }

    function createLayer(name = 'Layer') {
      const id = state.nextLayerId++;
      return {
        id,
        name: `${name} ${id - 1}`,
        visible: true,
        tiles: createEmptyTiles(state.mapWidth, state.mapHeight, 'void'),
        textItems: [],
        assetItems: createEmptyAssetItems()
      };
    }

    function getActiveLayer() {
      return state.layers.find(layer => layer.id === state.activeLayerId) || state.layers[0];
    }

    function getEditableActiveLayer() {
      const layer = getActiveLayer();
      return layer && layer.visible ? layer : null;
    }

    function getSelectedAsset() {
      return state.assetLibrary.find(asset => asset.id === state.selectedAssetId) || null;
    }

    function sanitizeAssetDefinition(asset) {
      if (!asset || !Array.isArray(asset.pixels)) return null;
      const width = clamp(parseInt(asset.width, 10) || 0, 1, 64);
      const height = clamp(parseInt(asset.height, 10) || 0, 1, 64);
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

    function loadLocalAssetLibrary() {
      try {
        return JSON.parse(localStorage.getItem(ASSET_STORAGE_KEY) || '[]')
          .map(sanitizeAssetDefinition)
          .filter(Boolean);
      } catch {
        return [];
      }
    }

    async function loadRepoAssetLibrary() {
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
            return sanitizeAssetDefinition(await response.json());
          } catch {
            return null;
          }
        }));

        return repoAssets.filter(Boolean);
      } catch {
        return [];
      }
    }

    function mergeAssetLibraries(repoAssets, localAssets) {
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

    function normalizeRotation(rotation) {
      return ((rotation % 4) + 4) % 4;
    }

    function rotateAsset(asset, rotation = 0) {
      if (!asset) return null;
      const normalized = normalizeRotation(rotation);
      if (normalized === 0) {
        return {
          ...asset,
          width: asset.width,
          height: asset.height,
          pixels: asset.pixels.map(row => [...row])
        };
      }

      const source = asset.pixels.map(row => [...row]);
      if (normalized === 1) {
        return {
          ...asset,
          width: asset.height,
          height: asset.width,
          pixels: Array.from({ length: asset.width }, (_, y) =>
            Array.from({ length: asset.height }, (_, x) => source[asset.height - 1 - x][y] || null))
        };
      }

      if (normalized === 2) {
        return {
          ...asset,
          width: asset.width,
          height: asset.height,
          pixels: Array.from({ length: asset.height }, (_, y) =>
            Array.from({ length: asset.width }, (_, x) => source[asset.height - 1 - y][asset.width - 1 - x] || null))
        };
      }

      return {
        ...asset,
        width: asset.height,
        height: asset.width,
        pixels: Array.from({ length: asset.width }, (_, y) =>
          Array.from({ length: asset.height }, (_, x) => source[x][asset.width - 1 - y] || null))
      };
    }

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function getTileDef(id) {
      return TILE_MAP.get(id) || TILE_TYPES[0];
    }

    function resizeCanvas() {
      canvas.width = state.mapWidth * state.tileSize;
      canvas.height = state.mapHeight * state.tileSize;
      canvas.style.width = `${canvas.width * state.zoom}px`;
      canvas.style.height = `${canvas.height * state.zoom}px`;
      mapStage.style.width = `${canvas.width * state.zoom + 18}px`;
      mapStage.style.height = `${canvas.height * state.zoom + 18}px`;
    }

    function updateStatus(extra = '') {
      const tile = getTileDef(state.selectedTile);
      const activeLayer = getActiveLayer();
      const selectedAsset = getSelectedAsset();
      statusBox.innerHTML = `
        Tool: <strong>${TOOLS.find(t => t.id === state.selectedTool)?.label}</strong><br>
        Tile: <strong>${tile.label}</strong><br>
        Kategorie: <strong>${tile.categoryLabel}</strong><br>
        Asset: <strong>${selectedAsset ? selectedAsset.name : '-'}</strong><br>
        Platzierung: <strong>${selectedAsset && state.selectedTool === 'paint' ? 'Asset-Stempel' : 'Tile'}</strong><br>
        Rotation: <strong>${selectedAsset ? state.selectedAssetRotation * 90 : 0}°</strong><br>
        Layer: <strong>${activeLayer?.name || '-'}</strong><br>
        Größe: <strong>${state.mapWidth} × ${state.mapHeight}</strong><br>
        Tile Size: <strong>${state.tileSize}px</strong><br>
        Zoom: <strong>${Math.round(state.zoom * 100)}%</strong><br>
        ${extra}
      `;
    }

    function drawGrid() {
      if (!state.showGrid) return;
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= state.mapWidth; x++) {
        ctx.beginPath();
        ctx.moveTo(x * state.tileSize + 0.5, 0);
        ctx.lineTo(x * state.tileSize + 0.5, state.mapHeight * state.tileSize);
        ctx.stroke();
      }
      for (let y = 0; y <= state.mapHeight; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * state.tileSize + 0.5);
        ctx.lineTo(state.mapWidth * state.tileSize, y * state.tileSize + 0.5);
        ctx.stroke();
      }

      const crossSize = Math.max(3, Math.floor(state.tileSize * 0.18));
      ctx.strokeStyle = 'rgba(255,255,255,0.42)';
      for (let x = 0; x <= state.mapWidth; x += 2) {
        for (let y = 0; y <= state.mapHeight; y += 2) {
          const px = x * state.tileSize + 0.5;
          const py = y * state.tileSize + 0.5;
          ctx.beginPath();
          ctx.moveTo(px - crossSize, py);
          ctx.lineTo(px + crossSize, py);
          ctx.moveTo(px, py - crossSize);
          ctx.lineTo(px, py + crossSize);
          ctx.stroke();
        }
      }
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

    function hasSameTileInLayer(layer, x, y, tileId) {
      return x >= 0 && y >= 0 && x < state.mapWidth && y < state.mapHeight && layer.tiles[y][x] === tileId;
    }

    function drawPixelTexture(layer, tileId, x, y, size, baseColor) {
      const px = Math.max(2, Math.floor(size / 6));
      const worldBaseX = Math.floor(x / 2) * 2;
      const worldBaseY = Math.floor(y / 2) * 2;
      const inTwoByTwo = hasSameTileInLayer(layer, x + 1, y, tileId) && hasSameTileInLayer(layer, x, y + 1, tileId) && hasSameTileInLayer(layer, x + 1, y + 1, tileId)
        || hasSameTileInLayer(layer, x - 1, y, tileId) && hasSameTileInLayer(layer, x, y + 1, tileId) && hasSameTileInLayer(layer, x - 1, y + 1, tileId)
        || hasSameTileInLayer(layer, x + 1, y, tileId) && hasSameTileInLayer(layer, x, y - 1, tileId) && hasSameTileInLayer(layer, x + 1, y - 1, tileId)
        || hasSameTileInLayer(layer, x - 1, y, tileId) && hasSameTileInLayer(layer, x, y - 1, tileId) && hasSameTileInLayer(layer, x - 1, y - 1, tileId);

      const patternOffsetX = inTwoByTwo ? (x - worldBaseX) * Math.floor(size / 2) : 0;
      const patternOffsetY = inTwoByTwo ? (y - worldBaseY) * Math.floor(size / 2) : 0;

      for (let py = 0; py < size; py += px) {
        for (let pxl = 0; pxl < size; pxl += px) {
          const wx = Math.floor((patternOffsetX + pxl) / px);
          const wy = Math.floor((patternOffsetY + py) / px);
          const noise = hash2D(wx + x * 3, wy + y * 5, tileId.length);
          let shade = 0;

          if (tileId === 'grass' || tileId === 'bush' || tileId === 'trees') shade = noise > 0.75 ? 18 : noise < 0.18 ? -18 : 0;
          else if (tileId === 'water') shade = noise > 0.7 ? 24 : noise < 0.2 ? -20 : 0;
          else if (tileId === 'wood' || tileId === 'fence') shade = (wy % 3 === 0) ? 14 : noise < 0.15 ? -16 : 0;
          else if (tileId === 'roof') shade = (wy % 2 === 0) ? 18 : noise < 0.2 ? -18 : 0;
          else if (tileId === 'stone' || tileId === 'wall' || tileId === 'stone-floor' || tileId === 'brick-wall' || tileId === 'pillar') shade = noise > 0.8 ? 16 : noise < 0.18 ? -22 : 0;
          else if (tileId === 'sand') shade = noise > 0.7 ? 12 : noise < 0.22 ? -10 : 0;
          else if (tileId === 'dirt' || tileId === 'earth' || tileId === 'trap') shade = noise > 0.75 ? 10 : noise < 0.2 ? -14 : 0;
          else if (tileId === 'lava') shade = noise > 0.72 ? 24 : noise < 0.25 ? -14 : 0;
          else if (tileId === 'floor' || tileId === 'stairs') shade = noise > 0.82 ? 10 : noise < 0.14 ? -10 : 0;
          else shade = noise > 0.8 ? 8 : noise < 0.18 ? -8 : 0;

          ctx.fillStyle = shadeHex(baseColor, shade);
          ctx.fillRect(x * size + pxl, y * size + py, Math.min(px, size - pxl), Math.min(px, size - py));
        }
      }
    }

    function drawTileOverlay(tileId, x, y, size) {
      if (tileId === 'door') {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x * size + size * 0.2, y * size + size * 0.42, size * 0.6, size * 0.16);
      }
      if (tileId === 'window') {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x * size + size * 0.18, y * size + size * 0.18, size * 0.64, size * 0.64);
        ctx.fillStyle = 'rgba(15,23,42,0.55)';
        ctx.fillRect(x * size + size * 0.47, y * size + size * 0.18, size * 0.06, size * 0.64);
        ctx.fillRect(x * size + size * 0.18, y * size + size * 0.47, size * 0.64, size * 0.06);
      }
      if (tileId === 'stairs') {
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        for (let i = 0; i < 5; i++) {
          const inset = i * (size * 0.08);
          ctx.fillRect(x * size + inset, y * size + size * 0.72 - inset, size - inset * 1.2, size * 0.06);
        }
      }
      if (tileId === 'trees') {
        ctx.fillStyle = 'rgba(34,197,94,0.35)';
        ctx.beginPath();
        ctx.arc(x * size + size * 0.5, y * size + size * 0.38, size * 0.24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(101,67,33,0.45)';
        ctx.fillRect(x * size + size * 0.44, y * size + size * 0.5, size * 0.12, size * 0.22);
      }
      if (tileId === 'bush') {
        ctx.fillStyle = 'rgba(34,197,94,0.3)';
        ctx.beginPath();
        ctx.arc(x * size + size * 0.38, y * size + size * 0.58, size * 0.16, 0, Math.PI * 2);
        ctx.arc(x * size + size * 0.62, y * size + size * 0.58, size * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
      if (tileId === 'fence') {
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillRect(x * size + size * 0.18, y * size + size * 0.28, size * 0.08, size * 0.44);
        ctx.fillRect(x * size + size * 0.46, y * size + size * 0.28, size * 0.08, size * 0.44);
        ctx.fillRect(x * size + size * 0.74, y * size + size * 0.28, size * 0.08, size * 0.44);
        ctx.fillRect(x * size + size * 0.16, y * size + size * 0.38, size * 0.68, size * 0.06);
        ctx.fillRect(x * size + size * 0.16, y * size + size * 0.58, size * 0.68, size * 0.06);
      }
      if (tileId === 'roof') {
        ctx.strokeStyle = 'rgba(255,245,235,0.28)';
        ctx.lineWidth = Math.max(1, size * 0.05);
        for (let row = 0.24; row <= 0.78; row += 0.18) {
          ctx.beginPath();
          ctx.moveTo(x * size + size * 0.12, y * size + size * row);
          ctx.lineTo(x * size + size * 0.88, y * size + size * row);
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(120,53,15,0.32)';
        ctx.beginPath();
        ctx.moveTo(x * size + size * 0.5, y * size + size * 0.12);
        ctx.lineTo(x * size + size * 0.5, y * size + size * 0.88);
        ctx.stroke();
      }
      if (tileId === 'trap') {
        ctx.strokeStyle = 'rgba(255,255,255,0.42)';
        ctx.lineWidth = Math.max(1, size * 0.06);
        ctx.beginPath();
        ctx.moveTo(x * size + size * 0.22, y * size + size * 0.22);
        ctx.lineTo(x * size + size * 0.78, y * size + size * 0.78);
        ctx.moveTo(x * size + size * 0.78, y * size + size * 0.22);
        ctx.lineTo(x * size + size * 0.22, y * size + size * 0.78);
        ctx.stroke();
      }
      if (tileId === 'pillar') {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x * size + size * 0.28, y * size + size * 0.18, size * 0.44, size * 0.64);
      }
    }

    function drawLayerTiles(layer) {
      if (!layer.visible) return;
      for (let y = 0; y < state.mapHeight; y++) {
        for (let x = 0; x < state.mapWidth; x++) {
          const tileId = layer.tiles[y][x];
          if (tileId === 'void') continue;
          const tile = getTileDef(tileId);
          ctx.fillStyle = tile.color;
          ctx.fillRect(x * state.tileSize, y * state.tileSize, state.tileSize, state.tileSize);
          drawPixelTexture(layer, tileId, x, y, state.tileSize, tile.color);
          drawTileOverlay(tileId, x, y, state.tileSize);
        }
      }
    }

    function drawTextItems() {
      ctx.save();
      ctx.textBaseline = 'top';
      [...state.layers].reverse().forEach(layer => {
        if (!layer.visible) return;
        layer.textItems.forEach(item => {
          ctx.font = `${item.size}px Inter, system-ui, sans-serif`;
          ctx.fillStyle = item.color || '#ffffff';
          ctx.fillText(item.text, item.x * state.tileSize + 2, item.y * state.tileSize + 2);
        });
      });
      ctx.restore();
    }

    function drawAssetPixels(asset, originX, originY, options = {}) {
      if (!asset) return;
      const alpha = options.alpha ?? 1;
      const showOutline = options.showOutline !== false;

      ctx.save();
      ctx.globalAlpha = alpha;

      asset.pixels.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          if (!cell) return;
          const targetX = originX + colIndex;
          const targetY = originY + rowIndex;
          if (targetX < 0 || targetY < 0 || targetX >= state.mapWidth || targetY >= state.mapHeight) return;
          ctx.fillStyle = cell;
          ctx.fillRect(targetX * state.tileSize, targetY * state.tileSize, state.tileSize, state.tileSize);
        });
      });

      if (showOutline) {
        const clippedWidth = Math.max(0, Math.min(asset.width, state.mapWidth - originX));
        const clippedHeight = Math.max(0, Math.min(asset.height, state.mapHeight - originY));
        if (clippedWidth > 0 && clippedHeight > 0) {
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 1;
          ctx.strokeRect(
            originX * state.tileSize + 0.5,
            originY * state.tileSize + 0.5,
            clippedWidth * state.tileSize - 1,
            clippedHeight * state.tileSize - 1
          );
        }
      }

      ctx.restore();
    }

    function drawLayerAssets(layer) {
      if (!layer.visible || !Array.isArray(layer.assetItems)) return;
      layer.assetItems.forEach(item => {
        drawAssetPixels(item.asset, item.x, item.y, { alpha: 1, showOutline: false });
      });
    }

    function getAssetAnchorPosition(cursorX, cursorY, asset) {
      if (!asset) return { x: cursorX, y: cursorY };
      return {
        x: cursorX - Math.floor(asset.width / 2),
        y: cursorY - Math.floor(asset.height / 2)
      };
    }

    function drawMap(preview = null) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      [...state.layers].reverse().forEach(layer => {
        drawLayerTiles(layer);
        drawLayerAssets(layer);
      });

      if (preview && (preview.tool === 'rect' || preview.tool === 'circle')) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = getTileDef(state.selectedTile).color;
        applyShapeToGrid(preview.start.x, preview.start.y, preview.end.x, preview.end.y, preview.tool, (x, y) => {
          ctx.fillRect(x * state.tileSize, y * state.tileSize, state.tileSize, state.tileSize);
        });
        ctx.restore();
      }

      if (preview && preview.tool === 'asset' && preview.asset) {
        const rotatedAsset = rotateAsset(preview.asset, preview.rotation || 0);
        const anchor = getAssetAnchorPosition(preview.x, preview.y, rotatedAsset);
        drawAssetPixels(rotatedAsset, anchor.x, anchor.y, { alpha: 0.7, showOutline: true });
      }

      drawTextItems();
      drawGrid();
    }

    function cloneStateSnapshot() {
      return {
        mapWidth: state.mapWidth,
        mapHeight: state.mapHeight,
        tileSize: state.tileSize,
        activeLayerId: state.activeLayerId,
        nextLayerId: state.nextLayerId,
        layers: state.layers.map(layer => ({
          id: layer.id,
          name: layer.name,
          visible: layer.visible,
          tiles: layer.tiles.map(row => [...row]),
          textItems: layer.textItems.map(item => ({ ...item })),
          assetItems: (layer.assetItems || []).map(item => ({
            x: item.x,
            y: item.y,
            asset: {
              ...item.asset,
              pixels: item.asset.pixels.map(row => [...row])
            }
          }))
        }))
      };
    }

    function buildMapDraftPayload() {
      return {
        version: 1,
        mapWidth: state.mapWidth,
        mapHeight: state.mapHeight,
        tileSize: state.tileSize,
        zoom: state.zoom,
        showGrid: state.showGrid,
        selectedTile: state.selectedTile,
        selectedTool: state.selectedTool,
        selectedAssetId: state.selectedAssetId,
        selectedAssetRotation: state.selectedAssetRotation,
        activeLayerId: state.activeLayerId,
        nextLayerId: state.nextLayerId,
        openTileCategories: Array.from(state.openTileCategories),
        layers: cloneStateSnapshot().layers
      };
    }

    function saveMapDraft() {
      try {
        localStorage.setItem(MAP_DRAFT_STORAGE_KEY, JSON.stringify(buildMapDraftPayload()));
      } catch {
        // Ignore storage failures so editing can continue.
      }
    }

    function scheduleMapDraftSave() {
      window.clearTimeout(draftSaveTimer);
      draftSaveTimer = window.setTimeout(() => {
        draftSaveTimer = null;
        saveMapDraft();
      }, 120);
    }

    function loadMapDraft() {
      try {
        const raw = localStorage.getItem(MAP_DRAFT_STORAGE_KEY);
        if (!raw) return false;

        const draft = JSON.parse(raw);
        if (!draft || !Array.isArray(draft.layers) || !draft.layers.length) return false;

        state.mapWidth = clamp(parseInt(draft.mapWidth, 10) || state.mapWidth, 4, 200);
        state.mapHeight = clamp(parseInt(draft.mapHeight, 10) || state.mapHeight, 4, 200);
        state.tileSize = clamp(parseInt(draft.tileSize, 10) || state.tileSize, 12, 64);
        state.zoom = clamp(Number(draft.zoom) || 1, 0.5, 4);
        state.showGrid = draft.showGrid !== false;
        state.selectedTile = TILE_MAP.has(draft.selectedTile) ? draft.selectedTile : state.selectedTile;
        state.selectedTool = TOOLS.some(tool => tool.id === draft.selectedTool) ? draft.selectedTool : state.selectedTool;
        state.selectedAssetId = typeof draft.selectedAssetId === 'string' ? draft.selectedAssetId : null;
        state.selectedAssetRotation = normalizeRotation(parseInt(draft.selectedAssetRotation, 10) || 0);
        state.openTileCategories = new Set(
          Array.isArray(draft.openTileCategories) && draft.openTileCategories.length
            ? draft.openTileCategories
            : ['basic']
        );
        state.nextLayerId = Math.max(parseInt(draft.nextLayerId, 10) || 2, 2);
        state.layers = buildResizedLayers(
          draft.layers.map(layer => ({
            id: layer.id,
            name: layer.name || `Layer ${layer.id}`,
            visible: layer.visible !== false,
            tiles: Array.isArray(layer.tiles) ? layer.tiles : createEmptyTiles(state.mapWidth, state.mapHeight, 'void'),
            textItems: Array.isArray(layer.textItems) ? layer.textItems : [],
            assetItems: Array.isArray(layer.assetItems) ? layer.assetItems.map(item => ({
              x: item.x,
              y: item.y,
              asset: {
                ...item.asset,
                pixels: Array.isArray(item.asset?.pixels) ? item.asset.pixels.map(row => [...row]) : []
              }
            })) : []
          })),
          parseInt(draft.mapWidth, 10) || state.mapWidth,
          parseInt(draft.mapHeight, 10) || state.mapHeight,
          state.mapWidth,
          state.mapHeight
        );
        state.activeLayerId = state.layers.some(layer => layer.id === draft.activeLayerId)
          ? draft.activeLayerId
          : state.layers[0].id;
        state.history = [];
        state.redoStack = [];
        return true;
      } catch {
        return false;
      }
    }

    function syncMapInputs() {
      document.getElementById('mapWidth').value = state.mapWidth;
      document.getElementById('mapHeight').value = state.mapHeight;
      document.getElementById('tileSize').value = state.tileSize;
    }

    function buildResizedLayers(sourceLayers, sourceWidth, sourceHeight, newWidth, newHeight) {
      return sourceLayers.map(layer => {
        const newTiles = createEmptyTiles(newWidth, newHeight, 'void');
        for (let y = 0; y < Math.min(sourceHeight, newHeight); y++) {
          for (let x = 0; x < Math.min(sourceWidth, newWidth); x++) {
            newTiles[y][x] = layer.tiles[y][x];
          }
        }

        return {
          ...layer,
          tiles: newTiles,
          textItems: layer.textItems.map(item => ({ ...item })),
          assetItems: (layer.assetItems || [])
            .filter(item => item.x < newWidth && item.y < newHeight)
            .map(item => ({
              x: item.x,
              y: item.y,
              asset: {
                ...item.asset,
                pixels: item.asset.pixels.map(row => [...row])
              }
            }))
        };
      });
    }

    function applyMapResize(newWidth, newHeight, newTileSize = state.tileSize, options = {}) {
      const width = clamp(newWidth, 4, 200);
      const height = clamp(newHeight, 4, 200);
      const tileSize = clamp(newTileSize, 12, 64);
      const sourceSnapshot = options.sourceSnapshot || {
        mapWidth: state.mapWidth,
        mapHeight: state.mapHeight,
        layers: state.layers.map(layer => ({
          ...layer,
          tiles: layer.tiles.map(row => [...row]),
          textItems: layer.textItems.map(item => ({ ...item }))
        }))
      };

      state.layers = buildResizedLayers(
        sourceSnapshot.layers,
        sourceSnapshot.mapWidth,
        sourceSnapshot.mapHeight,
        width,
        height
      );
      state.mapWidth = width;
      state.mapHeight = height;
      state.tileSize = tileSize;
      syncMapInputs();
      resizeCanvas();
      drawMap();
      updateStatus(options.statusMessage || '');
    }

    function pushHistory() {
      state.history.push(cloneStateSnapshot());
      if (state.history.length > 100) state.history.shift();
      state.redoStack = [];
      scheduleMapDraftSave();
    }

    function restoreSnapshot(snapshot) {
      state.mapWidth = snapshot.mapWidth;
      state.mapHeight = snapshot.mapHeight;
      state.tileSize = snapshot.tileSize;
      state.activeLayerId = snapshot.activeLayerId;
      state.nextLayerId = snapshot.nextLayerId;
      state.layers = snapshot.layers.map(layer => ({
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        tiles: layer.tiles.map(row => [...row]),
        textItems: layer.textItems.map(item => ({ ...item })),
        assetItems: (layer.assetItems || []).map(item => ({
          x: item.x,
          y: item.y,
          asset: {
            ...item.asset,
            pixels: item.asset.pixels.map(row => [...row])
          }
        }))
      }));
      syncMapInputs();
      resizeCanvas();
      renderLayerList();
      drawMap();
      updateStatus();
      scheduleMapDraftSave();
    }

    function undo() {
      if (!state.history.length) return;
      state.redoStack.push(cloneStateSnapshot());
      restoreSnapshot(state.history.pop());
    }

    function redo() {
      if (!state.redoStack.length) return;
      state.history.push(cloneStateSnapshot());
      restoreSnapshot(state.redoStack.pop());
    }

    function renderTileButtons() {
      tileButtons.innerHTML = '';
      TILE_CATEGORIES.forEach(category => {
        const wrapper = document.createElement('details');
        wrapper.className = 'tile-category';
        if (state.openTileCategories.has(category.id) || category.tiles.some(tile => tile.id === state.selectedTile)) {
          wrapper.open = true;
        }

        wrapper.addEventListener('toggle', () => {
          if (wrapper.open) state.openTileCategories.add(category.id);
          else state.openTileCategories.delete(category.id);
          scheduleMapDraftSave();
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
          btn.className = 'tile-btn' + (state.selectedTile === tile.id ? ' active' : '');
          btn.innerHTML = `<span class="swatch" style="background:${tile.color}"></span><span>${tile.label}</span>`;
          btn.addEventListener('click', () => {
            state.selectedTile = tile.id;
            state.selectedAssetId = null;
            state.selectedAssetRotation = 0;
            state.openTileCategories.add(category.id);
            renderTileButtons();
            renderAssetLibrary();
            updateStatus();
            drawMap();
            scheduleMapDraftSave();
          });
          grid.appendChild(btn);
        });

        wrapper.appendChild(grid);
        tileButtons.appendChild(wrapper);
      });
    }

    function renderToolButtons() {
      toolButtons.innerHTML = '';
      TOOLS.forEach(tool => {
        const btn = document.createElement('button');
        btn.textContent = tool.label;
        btn.dataset.icon = BUTTON_ICONS[tool.id] || '•';
        btn.className = state.selectedTool === tool.id ? 'active' : '';
        btn.addEventListener('click', () => {
          state.selectedTool = tool.id;
          renderToolButtons();
          drawMap();
          updateStatus();
          scheduleMapDraftSave();
        });
        toolButtons.appendChild(btn);
      });
    }

    async function loadAssetLibrary() {
      const repoAssets = await loadRepoAssetLibrary();
      const localAssets = loadLocalAssetLibrary();
      state.assetLibrary = mergeAssetLibraries(repoAssets, localAssets);

      if (state.selectedAssetId && !state.assetLibrary.some(asset => asset.id === state.selectedAssetId)) {
        state.selectedAssetId = null;
        state.selectedAssetRotation = 0;
        scheduleMapDraftSave();
      }

      return repoAssets.length;
    }

    function createAssetPreview(asset, previewSize = 120) {
      const preview = document.createElement('canvas');
      preview.width = previewSize;
      preview.height = previewSize;
      const previewCtx = preview.getContext('2d');
      previewCtx.fillStyle = '#0b1220';
      previewCtx.fillRect(0, 0, preview.width, preview.height);

      const size = Math.max(6, Math.floor(Math.min(
        preview.width / Math.max(asset.width, 1),
        preview.height / Math.max(asset.height, 1)
      )));
      const offsetX = Math.floor((preview.width - asset.width * size) / 2);
      const offsetY = Math.floor((preview.height - asset.height * size) / 2);

      asset.pixels.forEach((row, y) => {
        row.forEach((cell, x) => {
          if (!cell) return;
          previewCtx.fillStyle = cell;
          previewCtx.fillRect(offsetX + x * size, offsetY + y * size, size, size);
        });
      });

      return preview;
    }

    function renderAssetLibrary() {
      assetLibraryList.innerHTML = '';

      if (!state.assetLibrary.length) {
        const empty = document.createElement('div');
        empty.className = 'hint';
        empty.textContent = 'Noch keine Assets vorhanden. Erstelle zuerst welche im Asset Editor.';
        assetLibraryList.appendChild(empty);
        return;
      }

      state.assetLibrary.forEach(asset => {
        const card = document.createElement('div');
        card.className = 'asset-card' + (asset.id === state.selectedAssetId ? ' active' : '');
        card.addEventListener('click', () => {
          state.selectedAssetId = asset.id;
          state.selectedAssetRotation = 0;
          state.selectedTool = 'paint';
          renderAssetLibrary();
          renderToolButtons();
          drawMap();
          updateStatus(`Asset ausgewählt: <strong>${asset.name}</strong>`);
          scheduleMapDraftSave();
        });

        const head = document.createElement('div');
        head.className = 'asset-card-head';

        const meta = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'asset-card-title';
        title.textContent = asset.name;
        const info = document.createElement('div');
        info.className = 'asset-card-meta';
        info.innerHTML = `${asset.category || 'Misc'}<br>${asset.width}x${asset.height} Zellen`;
        meta.appendChild(title);
        meta.appendChild(info);
        head.appendChild(meta);
        card.appendChild(head);

        card.appendChild(createAssetPreview(asset));

        const actions = document.createElement('div');
        actions.className = 'asset-card-actions';

        const selectBtn = document.createElement('button');
        selectBtn.type = 'button';
        selectBtn.dataset.icon = BUTTON_ICONS.select;
        selectBtn.textContent = asset.id === state.selectedAssetId ? 'Ausgewählt' : 'Auswählen';
        selectBtn.className = asset.id === state.selectedAssetId ? 'active' : '';
        selectBtn.addEventListener('click', () => {
          state.selectedAssetId = asset.id;
          state.selectedAssetRotation = 0;
          renderAssetLibrary();
          updateStatus(`Asset ausgewählt: <strong>${asset.name}</strong>`);
          scheduleMapDraftSave();
        });

        actions.appendChild(selectBtn);
        card.appendChild(actions);
        assetLibraryList.appendChild(card);
      });
    }

    function refreshLayerDropTarget() {
      layerList.querySelectorAll('.layer-item').forEach(item => {
        const layerId = Number(item.dataset.layerId);
        item.classList.toggle('drop-target', layerId === state.dropTargetLayerId);
      });
    }

    function renderLayerList() {
      layerList.innerHTML = '';
      state.layers.forEach((layer, index) => {
        const item = document.createElement('div');
        item.dataset.layerId = String(layer.id);
        item.className = 'layer-item' +
          (layer.id === state.activeLayerId ? ' active' : '') +
          (layer.id === state.dropTargetLayerId ? ' drop-target' : '');
        item.draggable = true;

        item.addEventListener('click', () => {
          state.activeLayerId = layer.id;
          renderLayerList();
          updateStatus();
          scheduleMapDraftSave();
        });

        item.addEventListener('dragstart', (event) => {
          state.draggedLayerId = layer.id;
          event.dataTransfer.effectAllowed = 'move';
          item.classList.add('dragging');
        });

        item.addEventListener('dragend', () => {
          state.draggedLayerId = null;
          state.dropTargetLayerId = null;
          refreshLayerDropTarget();
          item.classList.remove('dragging');
        });

        item.addEventListener('dragover', (event) => {
          event.preventDefault();
          if (state.draggedLayerId && state.draggedLayerId !== layer.id && state.dropTargetLayerId !== layer.id) {
            state.dropTargetLayerId = layer.id;
            refreshLayerDropTarget();
          }
        });

        item.addEventListener('dragleave', (event) => {
          if (!item.contains(event.relatedTarget) && state.dropTargetLayerId === layer.id) {
            state.dropTargetLayerId = null;
            refreshLayerDropTarget();
          }
        });

        item.addEventListener('drop', (event) => {
          event.preventDefault();
          const fromId = state.draggedLayerId;
          const toId = layer.id;
          if (!fromId || fromId === toId) return;

          const fromIndex = state.layers.findIndex(entry => entry.id === fromId);
          const toIndex = state.layers.findIndex(entry => entry.id === toId);
          if (fromIndex === -1 || toIndex === -1) return;

          pushHistory();
          const [moved] = state.layers.splice(fromIndex, 1);
          state.layers.splice(toIndex, 0, moved);
          state.draggedLayerId = null;
          state.dropTargetLayerId = null;
          renderLayerList();
          drawMap();
          updateStatus('Layer-Reihenfolge geändert');
        });

        const left = document.createElement('div');
        left.style.flex = '1';

        const titleWrap = document.createElement('div');
        titleWrap.className = 'layer-title-wrap';

        const dragHandle = document.createElement('span');
        dragHandle.className = 'drag-handle';
        dragHandle.textContent = '⋮⋮';
        dragHandle.title = 'Layer ziehen';
        
        //Rename Edit Start
        
        const nameEl = document.createElement('div');
        nameEl.className = 'layer-name';
        nameEl.textContent = layer.name;
        nameEl.title = 'Layer umbenennen';

        function startRename(event) {
        if (event) event.stopPropagation();

        const input = document.createElement('input');
        input.type = 'text';
        input.value = layer.name;
        input.className = 'layer-rename-input';

        const finishRename = (commit) => {
            if (commit) {
            const newName = input.value.trim();
            if (newName && newName !== layer.name) {
                pushHistory();
                layer.name = newName;
                updateStatus('Layer umbenannt');
            }
            }
            renderLayerList();
        };

        input.addEventListener('click', (e) => e.stopPropagation());
        input.addEventListener('mousedown', (e) => e.stopPropagation());
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') finishRename(true);
            if (e.key === 'Escape') finishRename(false);
        });
        input.addEventListener('blur', () => finishRename(true));

        titleWrap.replaceChild(input, nameEl);
        input.focus();
        input.select();
        }

        nameEl.addEventListener('dblclick', startRename);
        
        //Rename Edit end
        
        titleWrap.appendChild(dragHandle);
        titleWrap.appendChild(nameEl);

        const meta = document.createElement('div');
        meta.className = 'layer-meta';
        meta.textContent = `${layer.visible ? 'sichtbar' : 'versteckt'} · ${index + 1}`;

        left.appendChild(titleWrap);
        left.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'layer-actions';

        const renameBtn = document.createElement('button');
        renameBtn.className = 'icon-btn';
        renameBtn.type = 'button';
        renameBtn.dataset.icon = BUTTON_ICONS.rename;
        renameBtn.textContent = '';
        renameBtn.title = 'Layer umbenennen';
        renameBtn.addEventListener('click', startRename);

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'icon-btn';
        toggleBtn.type = 'button';
        toggleBtn.dataset.icon = layer.visible ? BUTTON_ICONS.visible : BUTTON_ICONS.hidden;
        toggleBtn.textContent = '';
        toggleBtn.title = layer.visible ? 'Layer ausblenden' : 'Layer einblenden';
        toggleBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          pushHistory();
          layer.visible = !layer.visible;
          renderLayerList();
          drawMap();
          updateStatus();
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'icon-btn danger';
        deleteBtn.type = 'button';
        deleteBtn.dataset.icon = BUTTON_ICONS.delete;
        deleteBtn.textContent = '';
        deleteBtn.title = 'Layer löschen';
        deleteBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          if (state.layers.length <= 1) {
            updateStatus('Mindestens ein Layer muss bestehen bleiben');
            return;
          }
          pushHistory();
          const layerIndex = state.layers.findIndex(entry => entry.id === layer.id);
          if (layerIndex === -1) return;
          state.layers.splice(layerIndex, 1);
          if (state.activeLayerId === layer.id) {
            const fallbackLayer = state.layers[Math.max(0, layerIndex - 1)] || state.layers[0];
            state.activeLayerId = fallbackLayer?.id || null;
          }
          renderLayerList();
          drawMap();
          updateStatus('Layer gelöscht');
        });

        actions.appendChild(renameBtn);
        actions.appendChild(toggleBtn);
        actions.appendChild(deleteBtn);
        item.appendChild(left);
        item.appendChild(actions);
        layerList.appendChild(item);
      });
    }

    function setTile(x, y, tileId) {
      const layer = getEditableActiveLayer();
      if (!layer || x < 0 || y < 0 || x >= state.mapWidth || y >= state.mapHeight) return;
      layer.tiles[y][x] = tileId;
    }

    function placeAsset(x, y, asset) {
      const layer = getEditableActiveLayer();
      if (!layer || !asset) return;
      if (!Array.isArray(layer.assetItems)) layer.assetItems = createEmptyAssetItems();
      const rotatedAsset = rotateAsset(asset, state.selectedAssetRotation);
      const anchor = getAssetAnchorPosition(x, y, rotatedAsset);
      layer.assetItems.push({
        x: anchor.x,
        y: anchor.y,
        asset: {
          ...rotatedAsset,
          pixels: rotatedAsset.pixels.map(row => [...row])
        }
      });
    }

    function eraseAt(x, y) {
      const layer = getEditableActiveLayer();
      if (!layer) return;
      setTile(x, y, 'void');

      if (!Array.isArray(layer.assetItems) || !layer.assetItems.length) return;
      layer.assetItems = layer.assetItems.filter(item => {
        const withinX = x >= item.x && x < item.x + item.asset.width;
        const withinY = y >= item.y && y < item.y + item.asset.height;
        if (!withinX || !withinY) return true;
        const assetPixel = item.asset.pixels[y - item.y]?.[x - item.x];
        return !assetPixel;
      });
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
      applyShapeToGrid(startX, startY, endX, endY, shape, (x, y) => setTile(x, y, state.selectedTile));
    }

    function addTextItem(x, y) {
      const layer = getEditableActiveLayer();
      if (!layer) return;
      const text = document.getElementById('textInput').value.trim() || 'Text';
      const size = clamp(parseInt(document.getElementById('textSizeInput').value, 10) || 18, 8, 72);
      layer.textItems.push({ x, y, text, size, color: '#ffffff' });
    }

    function floodFill(startX, startY, replacement) {
      const layer = getEditableActiveLayer();
      if (!layer) return;
      const target = layer.tiles[startY]?.[startX];
      if (!target || target === replacement) return;
      const stack = [[startX, startY]];
      while (stack.length) {
        const [x, y] = stack.pop();
        if (x < 0 || y < 0 || x >= state.mapWidth || y >= state.mapHeight) continue;
        if (layer.tiles[y][x] !== target) continue;
        layer.tiles[y][x] = replacement;
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
    }

    function getGridPos(evt) {
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((evt.clientX - rect.left) / (state.tileSize * state.zoom));
      const y = Math.floor((evt.clientY - rect.top) / (state.tileSize * state.zoom));
      return { x: clamp(x, 0, state.mapWidth - 1), y: clamp(y, 0, state.mapHeight - 1) };
    }

    function applyTool(x, y) {
      const layer = getEditableActiveLayer();
      if (!layer) {
        updateStatus('Aktiver Layer ist ausgeblendet und kann nicht bearbeitet werden');
        return;
      }
      const selectedAsset = getSelectedAsset();
      if (state.selectedTool === 'paint' && selectedAsset) placeAsset(x, y, selectedAsset);
      else if (state.selectedTool === 'paint') setTile(x, y, state.selectedTile);
      else if (state.selectedTool === 'erase') eraseAt(x, y);
      else if (state.selectedTool === 'fill') floodFill(x, y, state.selectedTile);
      else if (state.selectedTool === 'text') addTextItem(x, y);
      drawMap();
      updateStatus(`Cursor: <strong>${x}, ${y}</strong>`);
    }

    function addLayer() {
      pushHistory();
      const layer = createLayer('Layer');
      state.layers.push(layer);
      state.activeLayerId = layer.id;
      renderLayerList();
      drawMap();
      updateStatus('Neues leeres Layer hinzugefügt');
    }

    function resetMap() {
      pushHistory();
      state.layers = [{
        id: 1,
        name: 'Layer 1',
        visible: true,
        tiles: createEmptyTiles(state.mapWidth, state.mapHeight, 'void'),
        textItems: [],
        assetItems: createEmptyAssetItems()
      }];
      state.activeLayerId = 1;
      state.nextLayerId = 2;
      resizeCanvas();
      renderLayerList();
      drawMap();
      updateStatus();
    }

    function resizeMapPreserve() {
      pushHistory();
      const newWidth = parseInt(document.getElementById('mapWidth').value, 10) || 30;
      const newHeight = parseInt(document.getElementById('mapHeight').value, 10) || 20;
      const newTileSize = parseInt(document.getElementById('tileSize').value, 10) || 24;
      applyMapResize(newWidth, newHeight, newTileSize);
      scheduleMapDraftSave();
    }

    function saveJson() {
      const payload = {
        version: 3,
        mapWidth: state.mapWidth,
        mapHeight: state.mapHeight,
        tileSize: state.tileSize,
        activeLayerId: state.activeLayerId,
        nextLayerId: state.nextLayerId,
        layers: state.layers
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dnd-map.json';
      a.click();
      URL.revokeObjectURL(url);
    }

    function exportPng() {
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'dnd-map.png';
      a.click();
    }

    function loadJsonFile(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (Array.isArray(data.layers)) {
            state.mapWidth = data.mapWidth;
            state.mapHeight = data.mapHeight;
            state.tileSize = data.tileSize || 24;
            state.activeLayerId = data.activeLayerId || data.layers[0]?.id || 1;
            state.nextLayerId = data.nextLayerId || (Math.max(...data.layers.map(l => l.id), 1) + 1);
            state.layers = data.layers.map(layer => ({
              id: layer.id,
              name: layer.name || `Layer ${layer.id}`,
              visible: layer.visible !== false,
              tiles: layer.tiles,
              textItems: Array.isArray(layer.textItems) ? layer.textItems : [],
              assetItems: Array.isArray(layer.assetItems) ? layer.assetItems.map(item => ({
                x: item.x,
                y: item.y,
                asset: {
                  ...item.asset,
                  pixels: Array.isArray(item.asset?.pixels) ? item.asset.pixels.map(row => [...row]) : []
                }
              })) : []
            }));
          } else if (Array.isArray(data.tiles)) {
            state.mapWidth = data.mapWidth;
            state.mapHeight = data.mapHeight;
            state.tileSize = data.tileSize || 24;
            state.layers = [{
              id: 1,
              name: 'Layer 1',
              visible: true,
              tiles: data.tiles,
              textItems: Array.isArray(data.textItems) ? data.textItems : [],
              assetItems: []
            }];
            state.activeLayerId = 1;
            state.nextLayerId = 2;
          } else {
            throw new Error('Ungültige Layer-Daten');
          }

          document.getElementById('mapWidth').value = state.mapWidth;
          document.getElementById('mapHeight').value = state.mapHeight;
          document.getElementById('tileSize').value = state.tileSize;
          resizeCanvas();
          renderLayerList();
          drawMap();
          updateStatus('JSON geladen');
          scheduleMapDraftSave();
        } catch (err) {
          alert('Datei konnte nicht geladen werden: ' + err.message);
        }
      };
      reader.readAsText(file);
    }

    function getResizeHandleDirection(handle) {
      if (handle === resizeHandleRight) return 'right';
      if (handle === resizeHandleBottom) return 'bottom';
      return 'corner';
    }

    function startResizeDrag(direction, evt) {
      evt.preventDefault();
      evt.stopPropagation();
      pushHistory();
      state.resizeDrag = {
        direction,
        startClientX: evt.clientX,
        startClientY: evt.clientY,
        startWidth: state.mapWidth,
        startHeight: state.mapHeight,
        snapshot: cloneStateSnapshot()
      };

      [resizeHandleRight, resizeHandleBottom, resizeHandleCorner].forEach(handle => {
        handle.classList.toggle('active', getResizeHandleDirection(handle) === direction);
      });
      document.body.style.userSelect = 'none';
    }

    function updateResizeDrag(evt) {
      if (!state.resizeDrag) return;
      const stepSize = state.tileSize * state.zoom;
      const deltaX = Math.round((evt.clientX - state.resizeDrag.startClientX) / stepSize);
      const deltaY = Math.round((evt.clientY - state.resizeDrag.startClientY) / stepSize);

      const nextWidth = state.resizeDrag.direction === 'bottom'
        ? state.resizeDrag.startWidth
        : state.resizeDrag.startWidth + deltaX;
      const nextHeight = state.resizeDrag.direction === 'right'
        ? state.resizeDrag.startHeight
        : state.resizeDrag.startHeight + deltaY;

      applyMapResize(
        nextWidth,
        nextHeight,
        state.tileSize,
        {
          sourceSnapshot: state.resizeDrag.snapshot,
          statusMessage: `Map-Größe: <strong>${clamp(nextWidth, 4, 200)} × ${clamp(nextHeight, 4, 200)}</strong>`
        }
      );
    }

    function endResizeDrag() {
      if (!state.resizeDrag) return;
      state.resizeDrag = null;
      [resizeHandleRight, resizeHandleBottom, resizeHandleCorner].forEach(handle => handle.classList.remove('active'));
      document.body.style.userSelect = '';
      updateStatus('Map-Größe per Ziehen angepasst');
      scheduleMapDraftSave();
    }

    canvas.addEventListener('mousedown', (evt) => {
      const { x, y } = getGridPos(evt);
      state.hoverCell = { x, y };
      const editableLayer = getEditableActiveLayer();

      if (!editableLayer) {
        state.isDrawing = false;
        state.dragStart = null;
        drawMap();
        updateStatus('Aktiver Layer ist ausgeblendet und kann nicht bearbeitet werden');
        return;
      }

      if (state.selectedTool === 'rect' || state.selectedTool === 'circle') {
        state.isDrawing = true;
        state.dragStart = { x, y };
        drawMap({ tool: state.selectedTool, start: state.dragStart, end: { x, y } });
        return;
      }

      pushHistory();
      state.isDrawing = state.selectedTool === 'paint' && !getSelectedAsset();
      applyTool(x, y);
      if (state.selectedTool === 'fill' || state.selectedTool === 'text') state.isDrawing = false;
    });

    canvas.addEventListener('mousemove', (evt) => {
      if (state.resizeDrag) return;
      const { x, y } = getGridPos(evt);
      state.hoverCell = { x, y };
      const editableLayer = getEditableActiveLayer();

      if (!editableLayer) {
        if (!state.isDrawing) drawMap();
        updateStatus('Aktiver Layer ist ausgeblendet und kann nicht bearbeitet werden');
        return;
      }

      if (state.isDrawing && (state.selectedTool === 'paint' || state.selectedTool === 'erase')) {
        applyTool(x, y);
      } else if (state.isDrawing && (state.selectedTool === 'rect' || state.selectedTool === 'circle') && state.dragStart) {
        drawMap({ tool: state.selectedTool, start: state.dragStart, end: { x, y } });
        updateStatus(`Cursor: <strong>${x}, ${y}</strong>`);
      } else if (state.selectedTool === 'paint' && getSelectedAsset()) {
        drawMap({ tool: 'asset', asset: getSelectedAsset(), x, y, rotation: state.selectedAssetRotation });
        updateStatus(`Cursor: <strong>${x}, ${y}</strong>`);
      } else {
        updateStatus(`Cursor: <strong>${x}, ${y}</strong>`);
      }
    });

    canvas.addEventListener('mouseleave', () => {
      state.hoverCell = null;
      if (!state.isDrawing) drawMap();
      updateStatus();
    });

    window.addEventListener('mouseup', () => {
      if (state.resizeDrag) {
        endResizeDrag();
        return;
      }
      if (state.isDrawing && state.dragStart && state.hoverCell && (state.selectedTool === 'rect' || state.selectedTool === 'circle')) {
        pushHistory();
        applyShape(state.dragStart.x, state.dragStart.y, state.hoverCell.x, state.hoverCell.y, state.selectedTool);
        drawMap();
        scheduleMapDraftSave();
      }
      state.isDrawing = false;
      state.dragStart = null;
    });

    window.addEventListener('mousemove', (evt) => {
      updateResizeDrag(evt);
    });

    window.addEventListener('focus', () => {
      void loadAssetLibrary().then(() => {
        renderAssetLibrary();
        updateStatus();
      });
    });

    window.addEventListener('storage', (event) => {
      if (event.key !== ASSET_STORAGE_KEY) return;
      void loadAssetLibrary().then(() => {
        renderAssetLibrary();
        updateStatus('Asset-Bibliothek aktualisiert');
      });
    });

    [resizeHandleRight, resizeHandleBottom, resizeHandleCorner].forEach(handle => {
      handle.addEventListener('mousedown', (evt) => {
        startResizeDrag(getResizeHandleDirection(handle), evt);
      });
    });

    document.getElementById('addLayerBtn').addEventListener('click', addLayer);
    document.getElementById('undoBtn').addEventListener('click', undo);
    document.getElementById('redoBtn').addEventListener('click', redo);
    document.getElementById('newMapBtn').addEventListener('click', resetMap);
    document.getElementById('refreshAssetsBtn').addEventListener('click', () => {
      void loadAssetLibrary().then(repoAssetCount => {
        renderAssetLibrary();
        updateStatus(repoAssetCount
          ? `Asset-Bibliothek aktualisiert: <strong>${repoAssetCount}</strong> Repo-Assets`
          : 'Asset-Bibliothek aktualisiert');
        scheduleMapDraftSave();
      });
    });
    document.getElementById('resizeMapBtn').addEventListener('click', resizeMapPreserve);
    document.getElementById('saveJsonBtn').addEventListener('click', saveJson);
    document.getElementById('exportPngBtn').addEventListener('click', exportPng);
    document.getElementById('jsonFileInput').addEventListener('change', (e) => loadJsonFile(e.target.files[0]));

    assetLibraryList.addEventListener('click', (event) => {
      const button = event.target.closest('.asset-card-actions button');
      if (!button) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const card = event.target.closest('.asset-card');
      const cards = Array.from(assetLibraryList.querySelectorAll('.asset-card'));
      const asset = state.assetLibrary[cards.indexOf(card)];
      if (!asset) return;

      state.selectedAssetId = state.selectedAssetId === asset.id ? null : asset.id;
      state.selectedAssetRotation = 0;
      state.selectedTool = 'paint';
      renderAssetLibrary();
      renderToolButtons();
      drawMap();
      updateStatus(state.selectedAssetId
        ? `Asset ausgewaehlt: <strong>${asset.name}</strong>`
        : 'Asset-Auswahl aufgehoben');
      scheduleMapDraftSave();
    }, true);

    document.getElementById('toggleGridBtn').addEventListener('click', (e) => {
      state.showGrid = !state.showGrid;
      e.target.classList.toggle('active', state.showGrid);
      e.target.textContent = state.showGrid ? 'Grid an' : 'Grid aus';
      drawMap();
      updateStatus();
      scheduleMapDraftSave();
    });

    document.getElementById('zoomInBtn').addEventListener('click', () => {
      state.zoom = clamp(Number((state.zoom + 0.25).toFixed(2)), 0.5, 4);
      resizeCanvas();
      updateStatus();
      scheduleMapDraftSave();
    });

    document.getElementById('zoomOutBtn').addEventListener('click', () => {
      state.zoom = clamp(Number((state.zoom - 0.25).toFixed(2)), 0.5, 4);
      resizeCanvas();
      updateStatus();
      scheduleMapDraftSave();
    });

    document.getElementById('zoomResetBtn').addEventListener('click', () => {
      state.zoom = 1;
      resizeCanvas();
      updateStatus();
      scheduleMapDraftSave();
    });

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === '1') state.selectedTool = 'paint';
      if (e.key === '2') state.selectedTool = 'erase';
      if (e.key === '3') state.selectedTool = 'fill';
      if (e.key === '4') state.selectedTool = 'rect';
      if (e.key === '5') state.selectedTool = 'circle';
      if (e.key === '6') state.selectedTool = 'text';
      if (e.key.toLowerCase() === 'q' && getSelectedAsset() && state.selectedTool === 'paint') {
        state.selectedAssetRotation = normalizeRotation(state.selectedAssetRotation - 1);
      }
      if (e.key.toLowerCase() === 'e' && getSelectedAsset() && state.selectedTool === 'paint') {
        state.selectedAssetRotation = normalizeRotation(state.selectedAssetRotation + 1);
      }
      if (e.key.toLowerCase() === 'g') {
        document.getElementById('toggleGridBtn').click();
        return;
      }
      if (e.key === '+') state.zoom = clamp(Number((state.zoom + 0.25).toFixed(2)), 0.5, 4);
      if (e.key === '-') state.zoom = clamp(Number((state.zoom - 0.25).toFixed(2)), 0.5, 4);
      renderToolButtons();
      resizeCanvas();
      drawMap();
      updateStatus();
      scheduleMapDraftSave();
    });

    window.addEventListener('pagehide', saveMapDraft);
    window.addEventListener('beforeunload', saveMapDraft);

    async function init() {
      const hasDraft = loadMapDraft();
      if (!hasDraft) {
        state.layers = [{
          id: 1,
          name: 'Layer 1',
          visible: true,
          tiles: createEmptyTiles(state.mapWidth, state.mapHeight, 'void'),
          textItems: [],
          assetItems: createEmptyAssetItems()
        }];
        state.activeLayerId = 1;
      }
      const repoAssetCount = await loadAssetLibrary();
      const toggleGridBtn = document.getElementById('toggleGridBtn');
      toggleGridBtn.classList.toggle('active', state.showGrid);
      toggleGridBtn.textContent = state.showGrid ? 'Grid an' : 'Grid aus';
      syncMapInputs();
      renderToolButtons();
      renderTileButtons();
      renderAssetLibrary();
      renderLayerList();
      resizeCanvas();
      drawMap();
      if (hasDraft) updateStatus('Letzten Map-Entwurf wiederhergestellt');
      else if (repoAssetCount) updateStatus(`Repo-Assets geladen: <strong>${repoAssetCount}</strong>`);
      else updateStatus();
      if (!hasDraft) saveMapDraft();
    }

    void init();
