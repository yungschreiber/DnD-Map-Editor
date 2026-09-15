(() => {
  const terrain = window.DND_TERRAIN;
  const STORAGE_KEY = 'dnd-map-editor-procedural-v1';
  const byId = id => document.getElementById(id);
  const canvas = byId('terrainCanvas');
  const renderer = window.DND_TERRAIN_RENDERER.create(canvas);
  const viewport = byId('workspace');
  const status = byId('terrainStatus');
  const seedInput = byId('terrainSeed');
  const zoomInput = byId('terrainZoom');
  const pitchInput = byId('terrainPitch');
  const rotateLeft = byId('rotateTerrainLeftBtn');
  const rotateRight = byId('rotateTerrainRightBtn');
  const resetView = byId('resetTerrainViewBtn');
  const exportButton = byId('exportTerrainBtn');
  const generateButton = byId('generateTerrainBtn');
  const newButton = byId('newTerrainBtn');
  const oceanButton = byId('oceanTerrainBtn');
  const brushButton = byId('raiseTerrainBtn');
  const undoButton = byId('undoTerrainBtn');
  const redoButton = byId('redoTerrainBtn');
  const brushSize = byId('terrainBrushSize');
  const brushStrength = byId('terrainBrushStrength');
  const brushHeight = byId('terrainBrushHeight');
  const forestSize = byId('forestBrushSize');
  const forestDensity = byId('forestBrushDensity');
  const waterSize = byId('waterBrushSize');
  const waterDepth = byId('waterBrushDepth');
  const waterMode = byId('waterBrushMode');
  const buildingMode = byId('buildingMode');
  const deleteBuildingButton = byId('deleteBuildingBtn');
  let buildingRotation = 0, selectedBuildingId = null, buildingPreview = null, buildingPoint = null;
  const terrainTools = {
    height: { button: brushButton, panel: byId('heightToolPanel'), label: 'Berghöhe', size: brushSize, available: true },
    forest: { button: byId('forestTerrainBtn'), panel: byId('forestToolPanel'), label: 'Wald', size: forestSize, available: true },
    water: { button: byId('waterTerrainBtn'), panel: byId('waterToolPanel'), label: 'Wasser', size: waterSize, available: true },
    building: { button: byId('buildingTerrainBtn'), panel: byId('buildingToolPanel'), label: 'Gebäude', available: true }
  };
  let selectedTool = 'height';
  const cursor = byId('terrainBrushCursor');
  const controls = ['water', 'relief', 'forest'].map(name => ({ name,
    input: byId(`terrain${name[0].toUpperCase()}${name.slice(1)}`), output: byId(`${name}Value`) }));
  let current = null, busy = false, brushActive = false, gesture = null;
  let frame = 0, resizeTimer = 0;
  let rotationFrame = 0, rotationTime = 0;
  const rotationKeys = new Set();
  const history = [], redo = [];

  function snapshot() {
    return { world: terrain.serialize(current), camera: { ...renderer.camera } };
  }
  function pushHistory(before) {
    history.push(before);
    if (history.length > 30) history.shift();
    redo.length = 0;
    syncButtons();
  }
  function syncButtons() {
    undoButton.disabled = busy || !!gesture || !history.length;
    redoButton.disabled = busy || !!gesture || !redo.length;
    [generateButton, newButton, oceanButton, exportButton, brushButton, zoomInput, pitchInput, rotateLeft, rotateRight, resetView].forEach(button => { button.disabled = busy || !current; });
    Object.values(terrainTools).forEach(tool => { tool.button.disabled = busy || !current; });
    syncBuildingControls();
  }
  function describe() {
    status.textContent = brushActive ? `${terrainTools[selectedTool].label} aktiv` : 'Bereit';
    canvas.setAttribute('aria-label', `Bearbeitbare isometrische Landschaft „${current.settings.seed}“`);
  }
  function persist() {
    if (!current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...terrain.serialize(current), camera: renderer.camera }));
    } catch {
      status.textContent = 'Änderung sichtbar, aber der Browserspeicher konnte sie nicht sichern.';
    }
  }
  function readSettings() {
    return terrain.normalizeSettings({ seed: seedInput.value,
      ...Object.fromEntries(controls.map(({ name, input }) => [name, Number(input.value)])) });
  }
  function writeSettings(settings) {
    seedInput.value = settings.seed;
    controls.forEach(({ name, input, output }) => { input.value = settings[name]; output.value = `${settings[name]} %`; });
    brushHeight.max = Math.min(100, Math.round(140 - settings.water));
    brushHeight.value = Math.min(Number(brushHeight.value), Number(brushHeight.max));
    syncBrushHeight();
  }
  function syncTerrainOutputs() {
    controls.forEach(({ input, output }) => { output.value = `${input.value} %`; });
  }
  function render() {
    buildingPreview = buildingPoint = null;
    renderer.render(current);
    renderer.renderOverlay(null, selectedBuildingId);
    syncBuildingControls();
  }
  function buildingsActive() { return brushActive && selectedTool === 'building'; }
  function syncBuildingControls() {
    const selected = current?.buildings.find(building => building.id === selectedBuildingId);
    deleteBuildingButton.disabled = busy || !buildingsActive() || !selected;
    byId('rotateBuildingLeftBtn').disabled = byId('rotateBuildingRightBtn').disabled = busy || !current || !buildingsActive();
    byId('buildingRotation').value = `${selected?.rotation ?? buildingRotation}°`;
    const count = current?.buildings.length || 0;
    byId('buildingCount').value = `${count} ${count === 1 ? 'Haus' : 'Häuser'}`;
    for (const [button, symbol, key, direction] of [[rotateLeft, '↶', 'Q', 'links'], [rotateRight, '↷', 'E', 'rechts']]) {
      button.textContent = buildingsActive() ? symbol : key === 'Q' ? '↶ Q' : 'E ↷';
      button.title = `Ansicht nach ${direction} drehen${buildingsActive() ? '' : ` (${key})`}`;
      button.setAttribute('aria-label', button.title);
    }
  }
  function buildingMessage(message, invalid = false) {
    byId('buildingStatus').textContent = message;
    byId('buildingStatus').dataset.invalid = String(invalid);
  }
  function clearBuildingPreview() {
    buildingPreview = buildingPoint = null;
    renderer.renderOverlay(null, selectedBuildingId);
  }
  function previewBuilding(point) {
    buildingPoint = point;
    const hit = renderer.pickBuilding(point.x, point.y);
    const ground = renderer.pick(point.x, point.y);
    buildingPreview = buildingMode.value === 'place' && !hit && ground
      ? terrain.buildingPlacement(current, ground, buildingRotation) : null;
    renderer.renderOverlay(buildingPreview, selectedBuildingId);
    if (hit) buildingMessage('Haus anklicken zum Auswählen.');
    else if (buildingPreview) buildingMessage(buildingPreview.valid ? 'Klicken, um das Haus zu bauen.' : buildingPreview.reason, !buildingPreview.valid);
    else buildingMessage(selectedBuildingId ? 'Haus ausgewählt · Q/E dreht · Entf löscht.' : 'Ein Haus anklicken oder „Haus bauen“ wählen.');
  }
  function clickBuilding(point) {
    stopRotation();
    const hit = renderer.pickBuilding(point.x, point.y);
    if (hit || buildingMode.value === 'select') {
      selectedBuildingId = hit;
      if (hit) buildingMode.value = 'select';
      clearBuildingPreview(); syncBuildingControls();
      buildingMessage(hit ? 'Haus ausgewählt · Q/E dreht · Entf löscht.' : 'Kein Haus ausgewählt.');
      return;
    }
    previewBuilding(point);
    if (!buildingPreview?.valid) return;
    const before = snapshot();
    if (!terrain.placeBuilding(current, buildingPreview.building, buildingRotation)) return;
    selectedBuildingId = null;
    pushHistory(before); render(); persist();
    buildingMessage('Haus gebaut. Eine weitere freie Stelle wählen.');
  }
  function rotateHouse(delta) {
    if (busy || !current || !buildingsActive()) return;
    if (selectedBuildingId) {
      const building = current.buildings.find(building => building.id === selectedBuildingId);
      if (!building) return;
      const before = snapshot();
      const result = terrain.rotateBuilding(current, selectedBuildingId, building.rotation + delta);
      if (!result.valid) { buildingMessage(result.reason, true); return; }
      pushHistory(before); render(); persist();
      buildingMessage('Ausgewähltes Haus gedreht.');
    } else {
      buildingRotation = (buildingRotation + delta + 360) % 360;
      if (buildingPoint) previewBuilding(buildingPoint);
    }
    syncBuildingControls();
  }
  function deleteHouse() {
    if (busy || !current || !buildingsActive() || !selectedBuildingId) return;
    const before = snapshot();
    if (!terrain.removeBuilding(current, selectedBuildingId)) return;
    selectedBuildingId = null;
    pushHistory(before); render(); persist();
    buildingMessage('Haus gelöscht.');
  }
  buildingMode.addEventListener('change', () => {
    selectedBuildingId = null; clearBuildingPreview(); syncBuildingControls();
    buildingMessage(buildingMode.value === 'place' ? 'Bewege den Zeiger über eine freie Baufläche.' : 'Ein Haus anklicken.');
  });
  byId('rotateBuildingLeftBtn').addEventListener('click', () => rotateHouse(-90));
  byId('rotateBuildingRightBtn').addEventListener('click', () => rotateHouse(90));
  deleteBuildingButton.addEventListener('click', deleteHouse);
  function syncCameraControls() {
    const zoom = renderer.camera.zoom, pitch = renderer.camera.pitch;
    const setSelection = (input, value, customId, label) => {
      const option = Array.from(input.options).find(option => option.value !== 'custom' && Math.abs(Number(option.value) - value) < .0001);
      const custom = byId(customId);
      custom.hidden = !!option;
      custom.textContent = label;
      input.value = option ? option.value : 'custom';
    };
    setSelection(zoomInput, zoom, 'terrainCustomZoom', `${Math.round(zoom * 100)} %`);
    setSelection(pitchInput, pitch, 'terrainCustomPitch', `${Math.round(pitch)}° Neigung`);
    byId('terrainRotation').textContent = `${Math.round(renderer.camera.yaw)}°`;
  }
  function fitCanvas() {
    if (gesture) endGesture();
    canvas.style.width = '100%'; canvas.style.height = '100%';
    if (viewport.clientWidth && viewport.clientHeight) {
      const height = Math.max(128, Math.min(1536, Math.round(768 * viewport.clientHeight / viewport.clientWidth)));
      if (canvas.height !== height) { canvas.height = height; if (current) render(); }
    }
  }

  async function generate(mode = 'island', restored = null) {
    if (busy) return;
    stopRotation();
    endGesture();
    const before = current ? snapshot() : null;
    busy = true; syncButtons();
    seedInput.disabled = true;
    controls.forEach(({ input }) => { input.disabled = true; });
    viewport.setAttribute('aria-busy', 'true');
    status.textContent = 'Landschaft wird erzeugt …';
    await new Promise(resolve => setTimeout(resolve, 25));
    try {
      const world = restored || terrain.generate(readSettings());
      if (!restored && mode === 'ocean') {
        world.mode = 'ocean'; world.height.fill(0); terrain.refreshDetails(world);
      }
      current = world;
      selectedBuildingId = null;
      if (!restored) Object.assign(renderer.camera, { x: 47.5, y: 47.5 });
      fitCanvas(); render();
      syncCameraControls();
      if (before) pushHistory(before);
      writeSettings(world.settings);
      byId('terrainTitle').textContent = world.mode === 'ocean' ? 'Deine Wasserwelt' : world.settings.seed;
      syncTerrainOutputs(); describe(); persist();
    } catch (error) {
      status.textContent = 'Die Landschaft konnte nicht erzeugt werden. Bitte erneut versuchen.';
      console.error(error);
    } finally {
      busy = false; syncButtons();
      // Generation remains available even if an initial render failed.
      generateButton.disabled = newButton.disabled = oceanButton.disabled = false;
      seedInput.disabled = false;
      controls.forEach(({ input }) => { input.disabled = false; });
      viewport.setAttribute('aria-busy', 'false');
    }
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height };
  }
  function isBrushGesture() { return gesture && ['raise', 'forest', 'water'].includes(gesture.kind); }
  function updateCursor(event) {
    if (buildingsActive()) {
      cursor.hidden = true;
      if (!busy && !gesture) previewBuilding(canvasPoint(event));
      return;
    }
    if (!brushActive || busy || (gesture && !isBrushGesture())) { cursor.hidden = true; return; }
    const point = canvasPoint(event);
    cursor.hidden = point.x < 0 || point.y < 0 || point.x >= canvas.width || point.y >= canvas.height;
    const rect = canvas.getBoundingClientRect(), radius = Number(terrainTools[selectedTool].size.value);
    const basis = renderer.basis();
    cursor.style.width = `${radius * 2 * basis.scale * rect.width / canvas.width}px`;
    cursor.style.height = `${radius * 2 * basis.scale * basis.rise * rect.height / canvas.height}px`;
    cursor.style.left = `${event.clientX}px`; cursor.style.top = `${event.clientY}px`;
  }
  function applyBrush(from, to, seconds) {
    const ceiling = current.settings.water / 100 + Number(brushHeight.value) / 100;
    const changed = gesture.kind === 'forest'
      ? terrain.paintForest(current, from, to, Number(forestSize.value), Number(forestDensity.value))
      : gesture.kind === 'water'
      ? terrain.paintWater(current, from, to, Number(waterSize.value), Number(waterDepth.value), gesture.waterStroke)
      : terrain.raiseTimed(current, from, to, Number(brushSize.value), seconds, Number(brushStrength.value), ceiling);
    gesture.changed ||= changed;
    return changed;
  }
  function flushBrush(time) {
    if (!isBrushGesture()) return false;
    let changed = false;
    const points = gesture.pending.splice(0);
    points.push({ point: points.length ? points[points.length - 1].point : gesture.last, time });
    for (const sample of points) {
      const elapsed = Math.min(.1, Math.max(0, (sample.time - gesture.time) / 1000));
      if (sample.point) changed = applyBrush(gesture.last || sample.point, sample.point, elapsed) || changed;
      gesture.last = sample.point;
      gesture.time = Math.max(gesture.time, sample.time);
    }
    if (changed) { terrain.refreshDetails(current); render(); }
    return changed;
  }
  function tick(time) {
    frame = 0;
    if (!isBrushGesture()) return;
    const elapsed = Math.max(0, (time - gesture.time) / 1000);
    if (elapsed >= 1 / 30) {
      flushBrush(time);
    }
    frame = requestAnimationFrame(tick);
  }
  function endGesture(event) {
    if (!gesture || (event?.pointerId !== undefined && event.pointerId !== gesture.id)) return;
    cancelAnimationFrame(frame); frame = 0;
    if (isBrushGesture()) flushBrush(performance.now());
    const ended = gesture;
    gesture = null;
    if (canvas.hasPointerCapture?.(ended.id)) canvas.releasePointerCapture(ended.id);
    if (ended.changed) pushHistory(ended.before);
    canvas.classList.remove('panning');
    syncButtons(); syncCameraControls(); describe(); persist();
  }
  canvas.addEventListener('pointerdown', event => {
    if (busy || !current || gesture || ![0, 1, 2].includes(event.button)) return;
    event.preventDefault(); canvas.focus({ preventScroll: true });
    const point = canvasPoint(event);
    if (point.x < 0 || point.y < 0 || point.x >= canvas.width || point.y >= canvas.height) return;
    if (buildingsActive() && event.button === 0) { clickBuilding(point); return; }
    clearBuildingPreview();
    const kind = event.button === 1 ? 'orbit' : brushActive && event.button === 0 ? (selectedTool === 'height' ? 'raise' : selectedTool) : 'pan';
    if (['raise', 'forest', 'water'].includes(kind)) stopRotation();
    // Freeze the picking surface for a stroke. A growing mountain must not move
    // the brush's ground anchor toward the camera while the mouse stays still.
    const picking = renderer.getPicking();
    gesture = { id: event.pointerId, kind, before: ['raise', 'forest', 'water'].includes(kind) ? snapshot() : null,
      picking, last: renderer.pick(point.x, point.y, picking), pending: [], changed: false,
      screen: point, clientY: event.clientY, camera: { ...renderer.camera }, time: performance.now() };
    if (kind === 'water') gesture.waterStroke = terrain.beginWaterStroke(current, gesture.last, Number(waterDepth.value), waterMode.value);
    try { canvas.setPointerCapture(event.pointerId); } catch { /* Synthetic browser test events have no active native pointer. */ }
    if (isBrushGesture()) {
      if (kind === 'forest' || kind === 'water') flushBrush(performance.now());
      frame = requestAnimationFrame(tick);
    } else canvas.classList.add('panning');
    syncButtons(); updateCursor(event);
  });
  canvas.addEventListener('pointermove', event => {
    updateCursor(event);
    if (!gesture || event.pointerId !== gesture.id) return;
    if (event.buttons === 0) { endGesture(event); return; }
    event.preventDefault();
    const point = canvasPoint(event);
    if (gesture.kind === 'pan') {
      const delta = renderer.screenDelta(point.x - gesture.screen.x, point.y - gesture.screen.y);
      renderer.camera.x = Math.max(-999000, Math.min(999000, renderer.camera.x - delta.x));
      renderer.camera.y = Math.max(-999000, Math.min(999000, renderer.camera.y - delta.y));
      gesture.screen = point;
      render();
    } else if (gesture.kind === 'orbit') {
      renderer.setCamera({ ...renderer.camera, pitch: gesture.camera.pitch + (gesture.clientY - event.clientY) * .25 });
      render(); syncCameraControls();
    } else {
      const samples = event.getCoalescedEvents?.();
      for (const sample of samples?.length ? samples : [event]) {
        const p = canvasPoint(sample);
        gesture.pending.push({ point: renderer.pick(p.x, p.y, gesture.picking), time: Math.min(performance.now(), sample.timeStamp) });
      }
    }
  });
  canvas.addEventListener('pointerup', endGesture);
  canvas.addEventListener('pointercancel', endGesture);
  canvas.addEventListener('lostpointercapture', endGesture);
  canvas.addEventListener('pointerleave', () => { cursor.hidden = true; clearBuildingPreview(); });
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('auxclick', event => { if (event.button === 1) event.preventDefault(); });
  window.addEventListener('pointerup', endGesture);
  window.addEventListener('blur', () => { stopRotation(); endGesture(); cursor.hidden = true; clearBuildingPreview(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopRotation(); endGesture(); } });
  window.addEventListener('pagehide', () => { stopRotation(); endGesture(); persist(); });
  viewport.addEventListener('scroll', () => { cursor.hidden = true; });

  function deactivateTool() {
    stopRotation();
    endGesture();
    brushActive = false;
    selectedBuildingId = null;
    clearBuildingPreview();
    cursor.hidden = true;
    canvas.classList.remove('sculpting');
    Object.values(terrainTools).forEach(tool => {
      tool.button.setAttribute('aria-pressed', 'false');
      tool.button.classList.remove('active');
    });
    syncButtons();
    if (current && !busy) describe();
    buildingMessage('Werkzeug beendet. Zum Bauen „Gebäude“ erneut aktivieren.');
  }

  Object.entries(terrainTools).forEach(([name, tool]) => {
    tool.button.addEventListener('click', () => {
      endGesture();
      stopRotation(); selectedBuildingId = null; clearBuildingPreview();
      brushActive = tool.available && (selectedTool !== name || !brushActive);
      selectedTool = name;
      Object.entries(terrainTools).forEach(([key, entry]) => {
        const selected = key === name;
        entry.panel.hidden = !selected;
        entry.button.setAttribute('aria-expanded', String(selected));
        entry.button.setAttribute('aria-pressed', String(selected && (brushActive || !entry.available)));
        entry.button.classList.toggle('active', selected && (brushActive || !entry.available));
      });
      canvas.classList.toggle('sculpting', brushActive);
      cursor.dataset.tool = name;
      cursor.hidden = true; describe(); syncBuildingControls();
      if (name === 'building') buildingMessage('Bewege den Zeiger über eine freie Baufläche oder wähle ein Haus aus.');
    });
  });
  for (const [input, output, suffix] of [[brushSize, byId('brushSizeValue'), ''], [brushStrength, byId('brushStrengthValue'), ' %'],
    [forestSize, byId('forestBrushSizeValue'), ''], [forestDensity, byId('forestBrushDensityValue'), ' %'],
    [waterSize, byId('waterBrushSizeValue'), ''], [waterDepth, byId('waterBrushDepthValue'), ' %']]) {
    input.addEventListener('input', () => { output.value = input.value + suffix; });
  }
  function syncBrushHeight() {
    byId('brushHeightValue').value = `+${brushHeight.value} %`;
    document.querySelectorAll('[data-brush-height]').forEach(button => {
      const active = button.dataset.brushHeight === brushHeight.value;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (current) describe();
  }
  brushHeight.addEventListener('input', syncBrushHeight);
  document.querySelectorAll('[data-brush-height]').forEach(button => {
    button.addEventListener('click', () => { brushHeight.value = button.dataset.brushHeight; syncBrushHeight(); });
  });
  function travel(source, target) {
    if (busy || gesture || !source.length) return;
    stopRotation();
    const next = source.pop(); target.push(snapshot());
    current = terrain.restore(next.world); renderer.setCamera(next.camera);
    selectedBuildingId = null;
    writeSettings(current.settings); byId('terrainTitle').textContent = current.mode === 'ocean' ? 'Deine Wasserwelt' : current.settings.seed;
    render(); syncTerrainOutputs(); syncButtons(); syncCameraControls(); describe(); persist();
  }
  undoButton.addEventListener('click', () => travel(history, redo));
  redoButton.addEventListener('click', () => travel(redo, history));
  function isEditing(target) {
    return target.isContentEditable || target.closest?.('input, select, textarea');
  }
  function advanceRotation(time) {
    const elapsed = Math.min(.1, Math.max(0, (time - rotationTime) / 1000));
    rotationTime = time;
    const direction = Number(rotationKeys.has('e')) - Number(rotationKeys.has('q'));
    if (!direction || !elapsed || !current || busy) return;
    renderer.setCamera({ ...renderer.camera, yaw: renderer.camera.yaw + direction * elapsed * 60 });
    render(); syncCameraControls();
  }
  function rotateHeld(time) {
    rotationFrame = 0;
    if (!rotationKeys.size) return;
    if (document.hidden || isEditing(document.activeElement)) { stopRotation(); return; }
    advanceRotation(time);
    rotationFrame = requestAnimationFrame(rotateHeld);
  }
  function stopRotation() {
    if (!rotationKeys.size) return;
    rotationKeys.clear();
    cancelAnimationFrame(rotationFrame); rotationFrame = 0;
    persist();
  }
  document.addEventListener('focusin', event => { if (isEditing(event.target)) stopRotation(); });
  document.addEventListener('keyup', event => {
    const key = event.key.toLowerCase();
    if (!rotationKeys.has(key)) return;
    advanceRotation(performance.now());
    rotationKeys.delete(key);
    if (!rotationKeys.size) {
      cancelAnimationFrame(rotationFrame); rotationFrame = 0;
      persist();
    }
  });
  document.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (key === 'escape' && (brushActive || gesture || rotationKeys.size || selectedBuildingId)) {
      event.preventDefault();
      deactivateTool();
      return;
    }
    if (isEditing(event.target)) return;
    if (buildingsActive() && !event.ctrlKey && !event.metaKey && !event.altKey && ['q', 'e', 'delete', 'backspace'].includes(key)) {
      event.preventDefault();
      if (event.repeat) return;
      if (key === 'q' || key === 'e') rotateHouse(key === 'q' ? -90 : 90);
      else deleteHouse();
      return;
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && ['q', 'e'].includes(key)) {
      event.preventDefault();
      if (event.repeat || rotationKeys.has(key) || !current || busy) return;
      if (rotationKeys.size) advanceRotation(performance.now());
      else {
        endGesture(); cursor.hidden = true;
        rotationTime = performance.now();
        rotationFrame = requestAnimationFrame(rotateHeld);
      }
      rotationKeys.add(key);
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) stopRotation();
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? travel(redo, history) : travel(history, redo); }
    if (event.key.toLowerCase() === 'y') { event.preventDefault(); travel(redo, history); }
  });
  byId('terrainForm').addEventListener('submit', event => { event.preventDefault(); void generate(); });
  oceanButton.addEventListener('click', () => { void generate('ocean'); });
  newButton.addEventListener('click', () => {
    const values = new Uint32Array(2); crypto.getRandomValues(values);
    seedInput.value = `Insel-${Array.from(values, n => n.toString(36)).join('-')}`;
    void generate();
  });
  controls.forEach(({ input }) => input.addEventListener('input', syncTerrainOutputs));
  function changeCamera(change) {
    if (!current || busy) return;
    endGesture(); cursor.hidden = true;
    change(); render(); syncCameraControls(); describe(); persist();
  }
  function rotateCamera(degrees) {
    changeCamera(() => renderer.setCamera({ ...renderer.camera, yaw: renderer.camera.yaw + degrees }));
  }
  rotateLeft.addEventListener('click', () => rotateCamera(-15));
  rotateRight.addEventListener('click', () => rotateCamera(15));
  pitchInput.addEventListener('change', () => {
    if (pitchInput.value !== 'custom') changeCamera(() => renderer.setCamera({ ...renderer.camera, pitch: Number(pitchInput.value) }));
  });
  zoomInput.addEventListener('change', () => {
    if (zoomInput.value !== 'custom') changeCamera(() => renderer.zoomAt(current, Number(zoomInput.value), canvas.width / 2, canvas.height / 2));
  });
  resetView.addEventListener('click', () => {
    stopRotation();
    changeCamera(() => renderer.setCamera({ ...renderer.camera, yaw: 45, pitch: 30, zoom: 1 }));
  });
  canvas.addEventListener('wheel', event => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const point = canvasPoint(event);
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
    const delta = Math.max(-240, Math.min(240, event.deltaY * unit));
    changeCamera(() => renderer.zoomAt(current, renderer.camera.zoom * Math.exp(-delta * .0015), point.x, point.y));
  }, { passive: false });
  new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(fitCanvas, 30); }).observe(viewport);
  exportButton.addEventListener('click', () => {
    if (!current || busy) return;
    endGesture();
    const filename = current.settings.seed.replace(/[^a-z0-9_-]/gi, '-').slice(0, 60) || 'landschaft';
    const dimensions = `${canvas.width} × ${canvas.height}`;
    renderer.renderOverlay();
    canvas.toBlob(blob => {
      if (!blob) { status.textContent = 'PNG konnte nicht erstellt werden.'; return; }
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `procedural-${filename}.png`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = `Ansicht als PNG exportiert · ${dimensions} Pixel`;
    }, 'image/png');
    renderer.renderOverlay(buildingPreview, selectedBuildingId);
  });

  let initial = null;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      initial = terrain.restore(saved);
      renderer.setCamera(saved.camera);
    }
  } catch { /* Old or corrupt storage falls back to a fresh island. */ }
  writeSettings(initial?.settings || terrain.DEFAULTS);
  void generate('island', initial);
})();
