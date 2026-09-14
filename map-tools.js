// Grid operations shared by the editor and its regression checks.
(() => {
  function hitAsset(layers, x, y) {
    for (const layer of layers) {
      if (!layer.visible) continue;
      for (let index = (layer.assetItems || []).length - 1; index >= 0; index--) {
        const item = layer.assetItems[index];
        if (item.asset.pixels[y - item.y]?.[x - item.x]) return { layerId: layer.id, index };
      }
    }
    return null;
  }

  function line(x0, y0, x1, y1, visit) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    while (true) {
      visit(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const twice = error * 2;
      if (twice >= dy) { error += dy; x0 += sx; }
      if (twice <= dx) { error += dx; y0 += sy; }
    }
  }

  function room(x0, y0, x1, y1, floor, wall, visit) {
    const left = Math.min(x0, x1), right = Math.max(x0, x1);
    const top = Math.min(y0, y1), bottom = Math.max(y0, y1);
    if (right - left < 2 || bottom - top < 2) return false;
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        visit(x, y, x === left || x === right || y === top || y === bottom ? wall : floor);
      }
    }
    return true;
  }

  function validateProjectTiles(tiles) {
    if (tiles === undefined) return [];
    if (!Array.isArray(tiles) || tiles.length > 512) throw new Error('Ungültige Projekt-Tiles');
    const ids = new Set();
    return tiles.map(tile => {
      if (!tile || typeof tile.id !== 'string' || !tile.id || tile.id === 'void' || ids.has(tile.id)
        || typeof tile.label !== 'string' || !/^#[0-9a-f]{6}$/i.test(tile.color)
        || (tile.textureDataUrl !== undefined && !/^data:image\/(png|webp);base64,[a-z0-9+/=]+$/i.test(tile.textureDataUrl))) {
        throw new Error('Ungültige Tile-Definition im Projekt');
      }
      ids.add(tile.id);
      return { id: tile.id, label: tile.label, color: tile.color,
        ...(tile.textureDataUrl ? { textureDataUrl: tile.textureDataUrl } : {}) };
    });
  }

  window.DND_MAP_TOOLS = { hitAsset, line, room, validateProjectTiles };
})();
