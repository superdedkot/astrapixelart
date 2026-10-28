const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const elements = {};
function element() {
  return { value: "100", handlers: {}, dataset: {}, classList: { toggle() {} },
    addEventListener(name, handler) { this.handlers[name] = handler; },
    insertBefore() {}, insertAdjacentElement() {}, appendChild() {}, setAttribute() {},
    style: { setProperty() {}, getPropertyValue() {} },
    querySelector(id) { return elements[id] ||= element(); } };
}
let source = { width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4) };
for (const [x, y] of [[3, 3], [4, 3], [3, 4], [4, 4]]) source.data.set([255, 0, 0, 255], (y * 8 + x) * 4);
let undo = 0, saves = 0, written;
const context = {
  document: { getElementById: id => elements[id] ||= element(), createElement: element, addEventListener() {} },
  canvas: element(), status: {}, tool: "pen", selectionMask: null, selectionMove: null,
  selectedLayer: { visible: true, canvas: { width: 8, height: 8, getContext: () => ({
    getImageData: () => source, putImageData: image => { written = image; } }) } },
  chooseTool: name => { context.tool = name; }, stopDrawing() {},
  rememberAction: () => undo++, scheduleSave: () => saves++, redraw() {}, renderLayers() {}, drawSelectionOutline() {},
  ImageData: class { constructor(data, width, height) { Object.assign(this, { data, width, height }); } }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../ui/deformation.js"), "utf8"), context);
const scale = context.scaleLayerPixels;
const count = image => image.data.filter((v, i) => i % 4 === 3 && v).length;
assert.equal(count(scale(source, 2, 2)), 16);
assert.equal(count(scale(source, 2, 1)), 8);
assert.equal(count(scale(source, 0.5, 0.5)), 1);
assert.equal(count(source), 4);
assert.equal(scale(source, 8, 8).clipped, true);
assert.throws(() => scale(source, 0, 1));
assert.equal(scale({ ...source, data: new Uint8ClampedArray(source.data.length) }, 2, 2), null);
// Open via the tool button (created separately from ID lookup).
context.tool = "deform";
elements["#deformation-x"].value = "200";
elements["#deformation-x"].handlers.input();
assert.equal(elements["#deformation-y"].value, "200");
elements["#deformation-link"].handlers.click();
elements["#deformation-x"].value = "300";
elements["#deformation-x"].handlers.input();
assert.equal(elements["#deformation-y"].value, "200");
elements["#deformation-apply"].handlers.click();
assert.equal(count(written), 24);
assert.equal(undo, 1);
assert.equal(saves, 1);
context.selectedLayer.visible = false;
elements["#deformation-apply"].handlers.click();
assert.equal(undo, 1);
console.log("PASS: proportional/independent scaling, nearest pixels, clipping, empty layer, axis link, history and hidden layer");