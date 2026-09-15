(() => {
  const terrain = window.DND_TERRAIN;
  const STORAGE_KEY = 'dnd-map-editor-procedural-v1';
  const byId = id => document.getElementById(id);
  const canvas = byId('terrainCanvas');
  const renderer = window.DND_TERRAIN_RENDERER.create(canvas);
  const viewport = byId('workspace');
  const status = byId('terrainStatus');
  const hint = byId('terrainSettingsHint');
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
  }
  function describe() {
    status.textContent = brushActive
      ? `Gelände langsam anheben · Höhenlimit: +${brushHeight.value} % über Wasser · Rechte Maustaste: Ansicht verschieben`
      : 'Q / E: drehen · Mittlere Maustaste + Ziehen: neigen · Strg + Mausrad: zoomen';
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
  function markPending() {
    controls.forEach(({ input, output }) => { output.value = `${input.value} %`; });
    hint.textContent = current && JSON.stringify(readSettings()) === JSON.stringify(current.settings)
      ? 'Generieren ersetzt das Gelände. Mit Rückgängig kannst du es zurückholen.'
      : 'Einstellungen bereit. „Generieren“ erzeugt die Landschaft neu.';
  }
  function render() { renderer.render(current); }
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
      if (!restored) Object.assign(renderer.camera, { x: 47.5, y: 47.5 });
      fitCanvas(); render();
      syncCameraControls();
      if (before) pushHistory(before);
      writeSettings(world.settings);
      byId('terrainTitle').textContent = world.mode === 'ocean' ? 'Deine Wasserwelt' : world.settings.seed;
      markPending(); describe(); persist();
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
  function updateCursor(event) {
    if (!brushActive || busy || (gesture && gesture.kind !== 'raise')) { cursor.hidden = true; return; }
    const point = canvasPoint(event);
    cursor.hidden = point.x < 0 || point.y < 0 || point.x >= canvas.width || point.y >= canvas.height;
    const rect = canvas.getBoundingClientRect(), radius = Number(brushSize.value);
    const basis = renderer.basis();
    cursor.style.width = `${radius * 2 * basis.scale * rect.width / canvas.width}px`;
    cursor.style.height = `${radius * 2 * basis.scale * basis.rise * rect.height / canvas.height}px`;
    cursor.style.left = `${event.clientX}px`; cursor.style.top = `${event.clientY}px`;
  }
  function applyBrush(from, to, seconds) {
    const ceiling = current.settings.water / 100 + Number(brushHeight.value) / 100;
    const changed = terrain.raiseTimed(current, from, to, Number(brushSize.value), seconds, Number(brushStrength.value), ceiling);
    gesture.changed ||= changed;
    return changed;
  }
  function flushBrush(time) {
    if (!gesture || gesture.kind !== 'raise') return false;
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
    if (!gesture || gesture.kind !== 'raise') return;
    const elapsed = Math.max(0, (time - gesture.time) / 1000);
    if (elapsed >= 1 / 30) {
      flushBrush(time);
    }
    frame = requestAnimationFrame(tick);
  }
  function endGesture(event) {
    if (!gesture || (event?.pointerId !== undefined && event.pointerId !== gesture.id)) return;
    cancelAnimationFrame(frame); frame = 0;
    if (gesture.kind === 'raise') flushBrush(performance.now());
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
    const kind = event.button === 1 ? 'orbit' : brushActive && event.button === 0 ? 'raise' : 'pan';
    if (kind === 'raise') stopRotation();
    // Freeze the picking surface for a stroke. A growing mountain must not move
    // the brush's ground anchor toward the camera while the mouse stays still.
    const picking = renderer.getPicking();
    gesture = { id: event.pointerId, kind, before: kind === 'raise' ? snapshot() : null,
      picking, last: renderer.pick(point.x, point.y, picking), pending: [], changed: false,
      screen: point, clientY: event.clientY, camera: { ...renderer.camera }, time: performance.now() };
    try { canvas.setPointerCapture(event.pointerId); } catch { /* Synthetic browser test events have no active native pointer. */ }
    if (kind === 'raise') {
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
  canvas.addEventListener('pointerleave', () => { cursor.hidden = true; });
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('auxclick', event => { if (event.button === 1) event.preventDefault(); });
  window.addEventListener('pointerup', endGesture);
  window.addEventListener('blur', () => { stopRotation(); endGesture(); cursor.hidden = true; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopRotation(); endGesture(); } });
  window.addEventListener('pagehide', () => { stopRotation(); endGesture(); persist(); });
  viewport.addEventListener('scroll', () => { cursor.hidden = true; });

  brushButton.addEventListener('click', () => {
    endGesture(); brushActive = !brushActive;
    brushButton.setAttribute('aria-pressed', String(brushActive));
    brushButton.classList.toggle('active', brushActive);
    canvas.classList.toggle('sculpting', brushActive);
    cursor.hidden = true; describe();
  });
  for (const [input, output, suffix] of [[brushSize, byId('brushSizeValue'), ''], [brushStrength, byId('brushStrengthValue'), ' %']]) {
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
    writeSettings(current.settings); byId('terrainTitle').textContent = current.mode === 'ocean' ? 'Deine Wasserwelt' : current.settings.seed;
    render(); markPending(); syncButtons(); syncCameraControls(); describe(); persist();
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
    if (isEditing(event.target)) return;
    const key = event.key.toLowerCase();
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
  seedInput.addEventListener('input', markPending);
  controls.forEach(({ input }) => input.addEventListener('input', markPending));
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
    canvas.toBlob(blob => {
      if (!blob) { status.textContent = 'PNG konnte nicht erstellt werden.'; return; }
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `procedural-${filename}.png`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = `Ansicht als PNG exportiert · ${dimensions} Pixel`;
    }, 'image/png');
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
