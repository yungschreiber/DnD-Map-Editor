    const TILE_TYPES = [
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

    const TOOLS = [
      { id: 'paint', label: 'Pinsel' },
      { id: 'erase', label: 'Radierer' },
      { id: 'fill', label: 'Fill' },
      { id: 'rect', label: 'Rechteck' },
      { id: 'circle', label: 'Kreis' },
      { id: 'text', label: 'Text' }
    ];

    const canvas = document.getElementById('mapCanvas');
    const ctx = canvas.getContext('2d');
    const statusBox = document.getElementById('statusBox');
    const tileButtons = document.getElementById('tileButtons');
    const toolButtons = document.getElementById('toolButtons');
    const layerList = document.getElementById('layerList');

    const state = {
      mapWidth: 30,
      mapHeight: 20,
      tileSize: 24,
      zoom: 1,
      showGrid: true,
      selectedTile: 'floor',
      selectedTool: 'paint',
      isDrawing: false,
      dragStart: null,
      hoverCell: null,
      layers: [],
      activeLayerId: null,
      nextLayerId: 2,
      history: [],
      redoStack: [],
      draggedLayerId: null,
      dropTargetLayerId: null
    };

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
        textItems: []
      };
    }

    function getActiveLayer() {
      return state.layers.find(layer => layer.id === state.activeLayerId) || state.layers[0];
    }

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function getTileDef(id) {
      return TILE_TYPES.find(t => t.id === id) || TILE_TYPES[0];
    }

    function resizeCanvas() {
      canvas.width = state.mapWidth * state.tileSize;
      canvas.height = state.mapHeight * state.tileSize;
      canvas.style.width = `${canvas.width * state.zoom}px`;
      canvas.style.height = `${canvas.height * state.zoom}px`;
    }

    function updateStatus(extra = '') {
      const tile = getTileDef(state.selectedTile);
      const activeLayer = getActiveLayer();
      statusBox.innerHTML = `
        Tool: <strong>${TOOLS.find(t => t.id === state.selectedTool)?.label}</strong><br>
        Tile: <strong>${tile.label}</strong><br>
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

          if (tileId === 'grass') shade = noise > 0.75 ? 18 : noise < 0.18 ? -18 : 0;
          else if (tileId === 'water') shade = noise > 0.7 ? 24 : noise < 0.2 ? -20 : 0;
          else if (tileId === 'wood') shade = (wy % 3 === 0) ? 14 : noise < 0.15 ? -16 : 0;
          else if (tileId === 'stone' || tileId === 'wall') shade = noise > 0.8 ? 16 : noise < 0.18 ? -22 : 0;
          else if (tileId === 'sand') shade = noise > 0.7 ? 12 : noise < 0.22 ? -10 : 0;
          else if (tileId === 'dirt') shade = noise > 0.75 ? 10 : noise < 0.2 ? -14 : 0;
          else if (tileId === 'lava') shade = noise > 0.72 ? 24 : noise < 0.25 ? -14 : 0;
          else if (tileId === 'floor') shade = noise > 0.82 ? 10 : noise < 0.14 ? -10 : 0;
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
      state.layers.forEach(layer => {
        if (!layer.visible) return;
        layer.textItems.forEach(item => {
          ctx.font = `${item.size}px Inter, system-ui, sans-serif`;
          ctx.fillStyle = item.color || '#ffffff';
          ctx.fillText(item.text, item.x * state.tileSize + 2, item.y * state.tileSize + 2);
        });
      });
      ctx.restore();
    }

    function drawMap(preview = null) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      state.layers.forEach(layer => drawLayerTiles(layer));

      if (preview && (preview.tool === 'rect' || preview.tool === 'circle')) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = getTileDef(state.selectedTile).color;
        applyShapeToGrid(preview.start.x, preview.start.y, preview.end.x, preview.end.y, preview.tool, (x, y) => {
          ctx.fillRect(x * state.tileSize, y * state.tileSize, state.tileSize, state.tileSize);
        });
        ctx.restore();
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
          textItems: layer.textItems.map(item => ({ ...item }))
        }))
      };
    }

    function pushHistory() {
      state.history.push(cloneStateSnapshot());
      if (state.history.length > 100) state.history.shift();
      state.redoStack = [];
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
        textItems: layer.textItems.map(item => ({ ...item }))
      }));
      document.getElementById('mapWidth').value = state.mapWidth;
      document.getElementById('mapHeight').value = state.mapHeight;
      document.getElementById('tileSize').value = state.tileSize;
      resizeCanvas();
      renderLayerList();
      drawMap();
      updateStatus();
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
      TILE_TYPES.forEach(tile => {
        const btn = document.createElement('button');
        btn.className = 'tile-btn' + (state.selectedTile === tile.id ? ' active' : '');
        btn.innerHTML = `<span class="swatch" style="background:${tile.color}"></span><span>${tile.label}</span>`;
        btn.addEventListener('click', () => {
          state.selectedTile = tile.id;
          renderTileButtons();
          updateStatus();
        });
        tileButtons.appendChild(btn);
      });
    }

    function renderToolButtons() {
      toolButtons.innerHTML = '';
      TOOLS.forEach(tool => {
        const btn = document.createElement('button');
        btn.textContent = tool.label;
        btn.className = state.selectedTool === tool.id ? 'active' : '';
        btn.addEventListener('click', () => {
          state.selectedTool = tool.id;
          renderToolButtons();
          updateStatus();
        });
        toolButtons.appendChild(btn);
      });
    }

    function renderLayerList() {
      layerList.innerHTML = '';
      state.layers.forEach((layer, index) => {
        const item = document.createElement('div');
        item.className = 'layer-item' +
          (layer.id === state.activeLayerId ? ' active' : '') +
          (layer.id === state.dropTargetLayerId ? ' drop-target' : '');
        item.draggable = true;

        item.addEventListener('click', () => {
          state.activeLayerId = layer.id;
          renderLayerList();
          updateStatus();
        });

        item.addEventListener('dragstart', (event) => {
          state.draggedLayerId = layer.id;
          event.dataTransfer.effectAllowed = 'move';
          item.classList.add('dragging');
        });

        item.addEventListener('dragend', () => {
          state.draggedLayerId = null;
          state.dropTargetLayerId = null;
          renderLayerList();
        });

        item.addEventListener('dragover', (event) => {
          event.preventDefault();
          if (state.draggedLayerId !== layer.id) {
            state.dropTargetLayerId = layer.id;
            renderLayerList();
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

        const nameEl = document.createElement('div');
        nameEl.className = 'layer-name';
        nameEl.textContent = layer.name;
        nameEl.title = 'Doppelklick zum Umbenennen';
        nameEl.addEventListener('dblclick', (event) => {
          event.stopPropagation();
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

          input.addEventListener('click', e => e.stopPropagation());
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') finishRename(true);
            if (e.key === 'Escape') finishRename(false);
          });
          input.addEventListener('blur', () => finishRename(true));

          titleWrap.replaceChild(input, nameEl);
          input.focus();
          input.select();
        });

        titleWrap.appendChild(dragHandle);
        titleWrap.appendChild(nameEl);

        const meta = document.createElement('div');
        meta.className = 'layer-meta';
        meta.textContent = `${layer.visible ? 'sichtbar' : 'versteckt'} · ${index + 1}`;

        left.appendChild(titleWrap);
        left.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'layer-actions';

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'icon-btn';
        toggleBtn.type = 'button';
        toggleBtn.textContent = layer.visible ? '👁' : '🚫';
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
        deleteBtn.textContent = '🗑';
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

        actions.appendChild(toggleBtn);
        actions.appendChild(deleteBtn);
        item.appendChild(left);
        item.appendChild(actions);
        layerList.appendChild(item);
      });
    }

    function setTile(x, y, tileId) {
      const layer = getActiveLayer();
      if (!layer || x < 0 || y < 0 || x >= state.mapWidth || y >= state.mapHeight) return;
      layer.tiles[y][x] = tileId;
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
      const layer = getActiveLayer();
      if (!layer) return;
      const text = document.getElementById('textInput').value.trim() || 'Text';
      const size = clamp(parseInt(document.getElementById('textSizeInput').value, 10) || 18, 8, 72);
      layer.textItems.push({ x, y, text, size, color: '#ffffff' });
    }

    function floodFill(startX, startY, replacement) {
      const layer = getActiveLayer();
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
      if (state.selectedTool === 'paint') setTile(x, y, state.selectedTile);
      else if (state.selectedTool === 'erase') setTile(x, y, 'void');
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
        textItems: []
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
      const newWidth = clamp(parseInt(document.getElementById('mapWidth').value, 10) || 30, 4, 200);
      const newHeight = clamp(parseInt(document.getElementById('mapHeight').value, 10) || 20, 4, 200);
      const newTileSize = clamp(parseInt(document.getElementById('tileSize').value, 10) || 24, 12, 64);

      state.layers.forEach(layer => {
        const newTiles = createEmptyTiles(newWidth, newHeight, 'void');
        for (let y = 0; y < Math.min(state.mapHeight, newHeight); y++) {
          for (let x = 0; x < Math.min(state.mapWidth, newWidth); x++) {
            newTiles[y][x] = layer.tiles[y][x];
          }
        }
        layer.tiles = newTiles;
      });

      state.mapWidth = newWidth;
      state.mapHeight = newHeight;
      state.tileSize = newTileSize;
      resizeCanvas();
      drawMap();
      updateStatus();
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
              textItems: Array.isArray(layer.textItems) ? layer.textItems : []
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
              textItems: Array.isArray(data.textItems) ? data.textItems : []
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
        } catch (err) {
          alert('Datei konnte nicht geladen werden: ' + err.message);
        }
      };
      reader.readAsText(file);
    }

    canvas.addEventListener('mousedown', (evt) => {
      const { x, y } = getGridPos(evt);
      state.hoverCell = { x, y };

      if (state.selectedTool === 'rect' || state.selectedTool === 'circle') {
        state.isDrawing = true;
        state.dragStart = { x, y };
        drawMap({ tool: state.selectedTool, start: state.dragStart, end: { x, y } });
        return;
      }

      pushHistory();
      state.isDrawing = true;
      applyTool(x, y);
      if (state.selectedTool === 'fill' || state.selectedTool === 'text') state.isDrawing = false;
    });

    canvas.addEventListener('mousemove', (evt) => {
      const { x, y } = getGridPos(evt);
      state.hoverCell = { x, y };
      if (state.isDrawing && (state.selectedTool === 'paint' || state.selectedTool === 'erase')) {
        applyTool(x, y);
      } else if (state.isDrawing && (state.selectedTool === 'rect' || state.selectedTool === 'circle') && state.dragStart) {
        drawMap({ tool: state.selectedTool, start: state.dragStart, end: { x, y } });
        updateStatus(`Cursor: <strong>${x}, ${y}</strong>`);
      } else {
        updateStatus(`Cursor: <strong>${x}, ${y}</strong>`);
      }
    });

    window.addEventListener('mouseup', () => {
      if (state.isDrawing && state.dragStart && state.hoverCell && (state.selectedTool === 'rect' || state.selectedTool === 'circle')) {
        pushHistory();
        applyShape(state.dragStart.x, state.dragStart.y, state.hoverCell.x, state.hoverCell.y, state.selectedTool);
        drawMap();
      }
      state.isDrawing = false;
      state.dragStart = null;
    });

    document.getElementById('addLayerBtn').addEventListener('click', addLayer);
    document.getElementById('undoBtn').addEventListener('click', undo);
    document.getElementById('redoBtn').addEventListener('click', redo);
    document.getElementById('newMapBtn').addEventListener('click', resetMap);
    document.getElementById('resizeMapBtn').addEventListener('click', resizeMapPreserve);
    document.getElementById('saveJsonBtn').addEventListener('click', saveJson);
    document.getElementById('exportPngBtn').addEventListener('click', exportPng);
    document.getElementById('jsonFileInput').addEventListener('change', (e) => loadJsonFile(e.target.files[0]));

    document.getElementById('toggleGridBtn').addEventListener('click', (e) => {
      state.showGrid = !state.showGrid;
      e.target.classList.toggle('active', state.showGrid);
      e.target.textContent = state.showGrid ? 'Grid an' : 'Grid aus';
      drawMap();
      updateStatus();
    });

    document.getElementById('zoomInBtn').addEventListener('click', () => {
      state.zoom = clamp(Number((state.zoom + 0.25).toFixed(2)), 0.5, 4);
      resizeCanvas();
      updateStatus();
    });

    document.getElementById('zoomOutBtn').addEventListener('click', () => {
      state.zoom = clamp(Number((state.zoom - 0.25).toFixed(2)), 0.5, 4);
      resizeCanvas();
      updateStatus();
    });

    document.getElementById('zoomResetBtn').addEventListener('click', () => {
      state.zoom = 1;
      resizeCanvas();
      updateStatus();
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
      if (e.key.toLowerCase() === 'g') {
        document.getElementById('toggleGridBtn').click();
        return;
      }
      if (e.key === '+') state.zoom = clamp(Number((state.zoom + 0.25).toFixed(2)), 0.5, 4);
      if (e.key === '-') state.zoom = clamp(Number((state.zoom - 0.25).toFixed(2)), 0.5, 4);
      renderToolButtons();
      resizeCanvas();
      updateStatus();
    });

    function init() {
      state.layers = [{
        id: 1,
        name: 'Layer 1',
        visible: true,
        tiles: createEmptyTiles(state.mapWidth, state.mapHeight, 'void'),
        textItems: []
      }];
      state.activeLayerId = 1;
      renderToolButtons();
      renderTileButtons();
      renderLayerList();
      resizeCanvas();
      drawMap();
      updateStatus();
    }

    init();