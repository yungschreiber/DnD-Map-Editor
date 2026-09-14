(() => {
  const sidebar = document.querySelector('.sidebar, .asset-sidebar');
  const heading = document.querySelector('.workspace-heading');
  const mapInspector = document.querySelector('.rightbar');
  const assetInspector = document.querySelector('.asset-tiles');
  const library = document.querySelector('.assetbar, .asset-library');
  const inspector = document.createElement('aside');
  inspector.className = 'inspector';
  inspector.setAttribute('aria-label', 'Materialien und Ebenen');
  const sections = Array.from((mapInspector || assetInspector).children);
  const byTitle = title => sections.find(section => section.querySelector('h2')?.textContent === title);

  const view = byTitle('Ansicht');
  const gridButton = document.querySelector('#toggleGridBtn, #toggleAssetGridBtn, #toggleTileGridBtn');
  const toolbar = document.createElement('div');
  toolbar.className = 'workspace-tools';
  if (view) {
    toolbar.append(view.querySelector('.group'));
    view.remove();
  }
  toolbar.append(gridButton);
  heading.append(toolbar);
  document.querySelectorAll('[id$="ZoomOutBtn"], #zoomOutBtn').forEach(button => {
    button.setAttribute('aria-label', 'Verkleinern');
    button.title = 'Verkleinern (−)';
  });
  document.querySelectorAll('[id$="ZoomInBtn"], #zoomInBtn').forEach(button => {
    button.setAttribute('aria-label', 'Vergrößern');
    button.title = 'Vergrößern (+)';
  });

  const status = byTitle('Status');
  if (status) {
    const details = document.createElement('details');
    details.className = 'status-details';
    const summary = document.createElement('summary');
    summary.textContent = 'Editor-Status';
    details.append(summary, status.querySelector('.status, .asset-status'));
    sidebar.append(details);
  }

  const panels = mapInspector
    ? [['Tiles', [byTitle('Tiles')]], ['Assets', Array.from(library.children)], ['Layer', [byTitle('Layer'), byTitle('Text')]]]
    : byTitle('Tiles')
      ? [['Tiles', [byTitle('Tiles')]], ['Bibliothek', Array.from(library.children)]]
      : [['Eigene Tiles', Array.from(library.children)]];
  const tabs = document.createElement('div');
  tabs.className = 'inspector-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Materialien und Ebenen');
  inspector.append(tabs);
  const buttons = [];
  const panelElements = [];
  function selectTab(index, focus = false) {
    buttons.forEach((button, i) => {
      button.setAttribute('aria-selected', String(i === index));
      button.tabIndex = i === index ? 0 : -1;
      panelElements[i].hidden = i !== index;
    });
    if (focus) buttons[index].focus();
  }
  panels.forEach(([label, contents], index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `inspector-tab-${index}`;
    button.textContent = label;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', `inspector-panel-${index}`);
    const panel = document.createElement('div');
    panel.className = 'inspector-panel';
    panel.id = `inspector-panel-${index}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', button.id);
    panel.tabIndex = 0;
    panel.append(...contents.filter(Boolean));
    buttons.push(button);
    panelElements.push(panel);
    button.addEventListener('click', () => selectTab(index));
    button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % panels.length;
      if (event.key === 'ArrowLeft') next = (index + panels.length - 1) % panels.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = panels.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      selectTab(next, true);
    });
    tabs.append(button);
    inspector.append(panel);
  });
  selectTab(0);
  (mapInspector || assetInspector).replaceWith(inspector);
  library.remove();

  const list = inspector.querySelector('.asset-list');
  if (list) {
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'library-search';
    search.placeholder = 'Bibliothek durchsuchen …';
    search.setAttribute('aria-label', 'Bibliothek durchsuchen');
    const empty = document.createElement('p');
    empty.className = 'hint search-empty';
    empty.textContent = 'Keine passenden Einträge.';
    empty.hidden = true;
    empty.setAttribute('role', 'status');
    list.before(search, empty);
    const filter = () => {
      const query = search.value.trim().toLocaleLowerCase('de');
      const cards = Array.from(list.querySelectorAll('.asset-card'));
      cards.forEach(card => { card.hidden = !card.textContent.toLocaleLowerCase('de').includes(query); });
      empty.hidden = !query || cards.some(card => !card.hidden);
    };
    search.addEventListener('input', filter);
    new MutationObserver(filter).observe(list, { childList: true });
  }

  // Keep toggle semantics in sync when the editors rebuild their controls.
  document.querySelectorAll('.tool-grid, .asset-tool-grid, .palette-grid').forEach(group => {
    const sync = () => group.querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.classList.contains('active')));
    });
    new MutationObserver(sync).observe(group, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    sync();
  });
  const syncGrid = () => gridButton.setAttribute('aria-pressed', String(gridButton.classList.contains('active')));
  new MutationObserver(syncGrid).observe(gridButton, { attributes: true, attributeFilter: ['class'] });
  syncGrid();
})();
