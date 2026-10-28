const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../ui/animation-panels.js"), "utf8");
const start = source.indexOf("  function drawOnionFrame(");
const end = source.indexOf("  new MutationObserver(updateOnionSkin)", start);
const bufferDraws = [];
const overlays = [];
const bufferContext = { drawImage(...args) { bufferDraws.push({ args, alpha: this.globalAlpha }); } };
const overlayContext = { drawImage(...args) { overlays.push({ args, alpha: this.globalAlpha }); } };
const bottom = { width: 24, height: 24 };
const top = { width: 8, height: 8 };
const frame = { size: 8, layers: [
  { canvas: top, visible: true, opacity: 50 },
  { canvas: {}, visible: false, opacity: 100 },
  { canvas: bottom, visible: true, opacity: 100 }
] };
let active = true;
const scope = {
  canvas: { width: 8, height: 8 },
  onionBuffer: { getContext: () => bufferContext },
  onionCanvas: { getContext: () => overlayContext },
  tabAnimation: { classList: { contains: () => active } },
  onionEnabled: { checked: true }, onionPrevious: { checked: true },
  onionNext: { checked: true }, onionOpacity: { value: "30" },
  onionPlaying: false, frames: [frame, frame, frame], chosenFrame: 1
};
vm.runInNewContext(source.slice(start, end), scope);
scope.updateOnionSkin();
assert.equal(scope.onionCanvas.hidden, false);
assert.equal(overlays.length, 2);
assert.equal(overlays[0].alpha, 0.3);
assert.equal(bufferDraws.length, 4);
assert.equal(bufferDraws[0].args[0], bottom);
assert.deepEqual(bufferDraws[0].args.slice(1), [8, 8, 8, 8, 0, 0, 8, 8]);
assert.equal(bufferDraws[1].alpha, 0.5);
assert.equal(overlayContext.globalAlpha, 1);
function countOverlays() {
  overlays.length = 0;
  scope.updateOnionSkin();
  return overlays.length;
}
scope.chosenFrame = 0;
assert.equal(countOverlays(), 1);
scope.chosenFrame = 2;
assert.equal(countOverlays(), 1);
scope.chosenFrame = 1;
scope.onionNext.checked = false;
assert.equal(countOverlays(), 1);
scope.onionPrevious.checked = false;
assert.equal(countOverlays(), 0);
scope.onionPlaying = true;
assert.equal(countOverlays(), 0);
assert.equal(scope.onionCanvas.hidden, true);
scope.onionPlaying = false;
active = false;
assert.equal(countOverlays(), 0);
assert.equal(scope.onionCanvas.hidden, true);
active = true;
scope.onionEnabled.checked = false;
assert.equal(countOverlays(), 0);
assert.equal(scope.onionCanvas.hidden, true);
console.log("PASS: onion skin neighbors, edges, opacity, layer crop/order and playback/Art isolation");