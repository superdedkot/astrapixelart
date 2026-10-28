// Run: node tests/test_astra_library.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class Element {
  constructor() { this.children = []; this.handlers = {}; this.value = ""; this.hidden = false; }
  setAttribute() {}
  removeAttribute(name) { delete this[name]; }
  before(label) { this.label = label; }
  appendChild(child) { this.children.push(child); if (this.children.length === 1) this.value = child.value || ""; }
  replaceChildren() { this.children = []; this.value = ""; }
  get selectedOptions() { return this.children.filter(item => item.value === this.value); }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  click() { return this.handlers.click?.(); }
  getContext() { return { clearRect() {}, drawImage() {} }; }
  toDataURL() { return "data:image/png;base64,copy"; }
}

async function main() {
  const ids = ["page", "refresh", "message", "profiles", "clips", "preview", "preview-message", "play", "stop", "import", "title", "source", "sheet-toggle", "sheet-panel", "sheet-image", "sheet-zoom", "sheet-info"];
  const elements = Object.fromEntries(ids.map(id => [`astra2d-${id}`, new Element()]));
  let active = false;
  elements["tab-animation"] = { click() { active = true; }, classList: { contains: () => active } };
  let observer, tick, copied, available = false, request, confirmationTimeout;
  let failImport = false;
  let sheetWidth = 192, sheetHeight = 128;
  const clip = { key: "copy|clips|0", name: "dance", fps: 10 };
  const context = {
    document: { getElementById: id => elements[id], createElement: () => new Element() },
    Image: class { constructor() { this.naturalWidth = sheetWidth; this.naturalHeight = sheetHeight; } set src(value) { queueMicrotask(() => this.onload()); } },
    MutationObserver: class { constructor(callback) { observer = callback; } observe() {} },
    setInterval(callback) { tick = callback; return 1; }, clearInterval() { tick = null; },
    setTimeout(callback) { confirmationTimeout = callback; return 1; }, clearTimeout() { confirmationTimeout = null; },
    // No native confirm or crypto.randomUUID: embedded webviews need neither.
    window: { animationEditor: { loadSavedAnimation: async value => {
      if (failImport) throw new Error("Fixture decode failure");
      copied = value;
    } } },
    newId: () => "012345670123012301230123456789ab",
    status: { textContent: "" },
    performance: { now: () => 0 }, requestAnimationFrame: callback => callback(),
    astra: { async callBackend(method, params) {
      if (method === "list_astra_2d") return { source: "fixture", notice: "", profiles: [{ id: "pu", name: "pu", clips: [clip] }], packs: [{ id: "copy", name: "Copy", clips: [clip] }] };
      request = params;
      return available ? { available: true, dataUrl: "fixture", frame: 64, fps: 10, loops: true } : { available: false, message: "Встроенный PNG недоступен" };
    } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../ui/astra-library.js"), "utf8"), context);
  const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
  await elements["astra2d-refresh"].click(); await flush();
  assert.equal(elements["astra2d-play"].disabled, true);
  assert.equal(elements["astra2d-sheet-toggle"].disabled, true);
  assert.match(elements["astra2d-preview-message"].textContent, /недоступен/);
  available = true;
  const select = elements["astra2d-clips"].label.children[0];
  select.value = "copy";
  select.handlers.change(); await flush();
  assert.equal(request.packId, "copy");
  assert.equal(elements["astra2d-play"].disabled, false);
  assert.equal(elements["astra2d-import"].disabled, false);
  elements["astra2d-play"].click(); assert.equal(typeof tick, "function");
  tick();
  elements["astra2d-stop"].click(); assert.equal(tick, null);
  elements["astra2d-play"].click();
  elements["astra2d-sheet-toggle"].click();
  assert.equal(tick, null);
  assert.equal(elements["astra2d-sheet-panel"].hidden, false);
  assert.equal(elements["astra2d-preview"].hidden, true);
  assert.equal(elements["astra2d-sheet-image"].width, 192);
  assert.equal(elements["astra2d-sheet-image"].height, 128);
  assert.match(elements["astra2d-sheet-info"].textContent, /3 столбцов × 2 рядов/);
  elements["astra2d-sheet-zoom"].value = "4";
  elements["astra2d-sheet-zoom"].handlers.change();
  assert.equal(elements["astra2d-sheet-image"].width, 768);
  assert.equal(elements["astra2d-sheet-image"].height, 512);
  elements["astra2d-play"].click();
  assert.equal(elements["astra2d-sheet-panel"].hidden, true);
  assert.equal(elements["astra2d-preview"].hidden, false);
  elements["astra2d-stop"].click();
  await elements["astra2d-import"].click(); assert.equal(copied, undefined);
  assert.match(elements["astra2d-import"].textContent, /Нажми ещё раз/);
  confirmationTimeout();
  await elements["astra2d-import"].click(); assert.equal(copied, undefined);
  await elements["astra2d-import"].click();
  assert.equal(copied.frames.length, 6);
  assert.equal(copied.format, "custom");
  assert.equal(copied.size, 64);
  assert.equal(copied.fps, 10);
  assert.match(copied.id, /^[0-9a-f]{32}$/);
  assert.notEqual(copied.frames[0], copied.frames[1]);
  // A selection change invalidates confirmation for the previous clip.
  await elements["astra2d-import"].click();
  select.handlers.change(); await flush();
  copied = undefined;
  await elements["astra2d-import"].click(); assert.equal(copied, undefined);
  // Errors after switching tabs must be visible in the editor, too.
  failImport = true;
  elements["astra2d-page"].hidden = true;
  await elements["astra2d-import"].click();
  assert.match(context.status.textContent, /Fixture decode failure/);
  failImport = false;
  // Odd frame counts are not forced into the editor's preset formats.
  for (const count of [7, 13]) {
    sheetWidth = count * 64; sheetHeight = 64;
    select.handlers.change(); await flush();
    assert.equal(elements["astra2d-sheet-image"].width, count * 64);
    assert.match(elements["astra2d-sheet-info"].textContent, new RegExp(`${count} столбцов × 1 рядов`));
    assert.equal(elements["astra2d-sheet-panel"].hidden, true);
    await elements["astra2d-import"].click();
    await elements["astra2d-import"].click();
    assert.equal(copied.frames.length, count);
    assert.equal(copied.format, "custom");
  }
  elements["astra2d-page"].hidden = true; observer(); assert.equal(tick, null);
  console.log("Astra library UI: unavailable PNG, pack selection, playback/stop, confirmation and independent editable copy passed.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });