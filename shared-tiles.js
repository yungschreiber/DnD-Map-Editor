(function () {
  const CUSTOM_TILE_STORAGE_KEY = 'dnd-map-editor-custom-tiles';

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

  const BUILTIN_TILE_CATEGORIES = [
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
      id: 'props',
      label: 'PROPS',
      tiles: [
        { id: 'treasure-chest', label: 'Treasure Chest', color: '#8b5a2b' },
        { id: 'bed', label: 'Bed', color: '#7b5c44' },
        { id: 'barrel', label: 'Barrel', color: '#8a6238', texturePath: 'tile-texture-sources/barrel_top.png' }
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
        { id: 'pillar', label: 'Pillar', color: '#94a3b8' },
        { id: 'prison-cell', label: 'Prison Cell', color: '#6f7c88' }
      ]
    }
  ];

  function cloneCategory(category) {
    return {
      id: category.id,
      label: category.label,
      tiles: category.tiles.map(tile => ({ ...tile }))
    };
  }

  function loadCustomTileCategories() {
    try {
      const raw = localStorage.getItem(CUSTOM_TILE_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const categories = Array.isArray(parsed?.categories) ? parsed.categories : [];
      return categories
        .filter(category => category && typeof category.id === 'string' && Array.isArray(category.tiles))
        .map(category => ({
          id: category.id,
          label: typeof category.label === 'string' && category.label.trim() ? category.label.trim() : category.id.toUpperCase(),
          tiles: category.tiles
            .filter(tile => tile && typeof tile.id === 'string' && typeof tile.label === 'string' && typeof tile.color === 'string')
            .map(tile => ({ ...tile }))
        }));
    } catch {
      return [];
    }
  }

  function buildMergedCategories() {
    const categoryMap = new Map(BUILTIN_TILE_CATEGORIES.map(category => [category.id, cloneCategory(category)]));

    loadCustomTileCategories().forEach(category => {
      const target = categoryMap.get(category.id);
      if (target) {
        category.tiles.forEach(tile => {
          const existingIndex = target.tiles.findIndex(entry => entry.id === tile.id);
          if (existingIndex === -1) target.tiles.push({ ...tile });
          else target.tiles.splice(existingIndex, 1, { ...tile });
        });
        return;
      }

      categoryMap.set(category.id, cloneCategory(category));
    });

    return Array.from(categoryMap.values());
  }

  function mutateSharedData(targetCategories, targetTypes, targetTypesWithVoid, targetMap, targetMapWithVoid, targetByColor) {
    const mergedCategories = buildMergedCategories();
    const mergedTypes = mergedCategories.flatMap(category =>
      category.tiles.map(tile => ({ ...tile, categoryId: category.id, categoryLabel: category.label }))
    );
    const mergedTypesWithVoid = [
      ...mergedTypes,
      { id: 'void', label: 'Leer', color: '#111827', categoryId: 'system', categoryLabel: 'System' }
    ];

    targetCategories.splice(0, targetCategories.length, ...mergedCategories);
    targetTypes.splice(0, targetTypes.length, ...mergedTypes);
    targetTypesWithVoid.splice(0, targetTypesWithVoid.length, ...mergedTypesWithVoid);

    targetMap.clear();
    mergedTypes.forEach(tile => targetMap.set(tile.id, tile));

    targetMapWithVoid.clear();
    mergedTypesWithVoid.forEach(tile => targetMapWithVoid.set(tile.id, tile));

    targetByColor.clear();
    mergedTypes.forEach(tile => targetByColor.set(tile.color.toLowerCase(), tile));
  }

  const TILE_CATEGORIES = [];
  const TILE_TYPES = [];
  const TILE_TYPES_WITH_VOID = [];
  const TILE_MAP = new Map();
  const TILE_MAP_WITH_VOID = new Map();
  const TILE_BY_COLOR = new Map();

  const shared = {
    PALETTE,
    TILE_CATEGORIES,
    TILE_TYPES,
    TILE_TYPES_WITH_VOID,
    TILE_MAP,
    TILE_MAP_WITH_VOID,
    TILE_BY_COLOR,
    CUSTOM_TILE_STORAGE_KEY,
    refreshFromStorage() {
      mutateSharedData(TILE_CATEGORIES, TILE_TYPES, TILE_TYPES_WITH_VOID, TILE_MAP, TILE_MAP_WITH_VOID, TILE_BY_COLOR);
    }
  };

  shared.refreshFromStorage();
  window.DND_TILE_SHARED = shared;
})();
