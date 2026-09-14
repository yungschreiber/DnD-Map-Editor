// Original grid assets: each character represents one map cell, '.' is transparent.
(() => {
  const colors = {
    w: '#795638', W: '#b48a56', d: '#49392d', s: '#66716e', S: '#a4aca0',
    g: '#3f6244', G: '#76945b', b: '#526e8b', B: '#a5c4cf',
    r: '#754d52', R: '#b57d70', f: '#d89346', F: '#f1ce7c', k: '#333d38'
  };
  const definitions = [
    ['dining-table', 'Tavernentisch', 'Einrichtung', ['dWWd', 'wWWw']],
    ['bench', 'Holzbank', 'Einrichtung', ['WWW', 'd.d']],
    ['bed', 'Bett', 'Einrichtung', ['dBBd', 'wbbw', 'wbbw', 'dWWd']],
    ['bookshelf', 'Bücherregal', 'Einrichtung', ['WWWW', 'rbgR', 'dddd']],
    ['crate', 'Vorratskiste', 'Einrichtung', ['WdW', 'dWd', 'WdW']],
    ['rug', 'Gewebter Teppich', 'Einrichtung', ['RRRR', 'RrrR', 'RRRR']],
    ['altar', 'Steinaltar', 'Dungeon', ['.SS.', 'SrrS', 'ssss']],
    ['sarcophagus', 'Sarkophag', 'Dungeon', ['.SS.', 'SssS', 'SsSS', 'SssS', '.ss.']],
    ['tree', 'Eiche', 'Natur', ['.GG.', 'GggG', 'GggG', '.wd.']],
    ['boulders', 'Felsgruppe', 'Natur', ['.Ss.', 'SssS', '.s.s']],
    ['campfire', 'Lagerfeuer', 'Lager', ['.ss.', 'sFFs', 'sfFs', '.dd.']],
    ['fountain', 'Brunnen', 'Dorf', ['.SS.', 'SbBS', 'SBbS', '.ss.']]
  ];
  window.DND_STARTER_ASSETS = definitions.map(([id, name, category, rows]) => ({
    id: `starter-${id}`, name, category, width: rows[0].length, height: rows.length,
    pixels: rows.map(row => Array.from(row, cell => colors[cell] || null)),
    updatedAt: '2026-01-01T00:00:00.000Z', fileName: `starter-${id}.json`
  }));
})();
