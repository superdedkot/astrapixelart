// Run: node tests/test_animation_panels_toggle.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../ui/animation-panels.js"), "utf8");
const start = source.indexOf("  let bottomPanelsCollapsed = false;");
const end = source.indexOf('  const formatOptions = document.createElement("div");', start);
const panels = [{}, {}, {}];
let active = true;
let resizes = 0;
const classes = new Set();
const button = {
  attributes: {},
  setAttribute(name, value) { this.attributes[name] = value; },
  addEventListener(name, handler) { this[name] = handler; }
};
const scope = {
  panels,
  document: {
    createElement: () => button,
    body: { classList: { toggle(name, enabled) {
      if (enabled) classes.add(name); else classes.delete(name);
    } } }
  },
  workspace: { querySelector: () => ({ appendChild() {} }) },
  tabAnimation: { classList: { contains: () => active } },
  requestAnimationFrame: callback => callback(),
  window: { dispatchEvent() { resizes++; } },
  Event: class {}
};
vm.runInNewContext(source.slice(start, end), scope);
scope.syncBottomPanels(true);
assert.equal(button.hidden, false);
assert.equal(button.attributes["aria-expanded"], "true");
assert.ok(panels.every(panel => !panel.hidden));
button.click();
assert.ok(panels.every(panel => panel.hidden));
assert.ok(classes.has("animation-panels-collapsed"));
assert.equal(button.hidden, false);
assert.equal(button.textContent, "▴ Показать панели");
assert.equal(button.attributes["aria-expanded"], "false");
active = false;
scope.syncBottomPanels(false);
assert.equal(button.hidden, true);
assert.ok(!classes.has("animation-panels-collapsed"));
active = true;
scope.syncBottomPanels(true);
assert.equal(button.hidden, false);
assert.ok(panels.every(panel => panel.hidden));
button.click();
assert.ok(panels.every(panel => !panel.hidden));
assert.equal(button.attributes["aria-expanded"], "true");
assert.equal(resizes, 2);
assert.match(source, /animation-panels-collapsed \.workspace\s*\{\s*grid-template-rows: minmax\(0, 1fr\);/);
console.log("PASS: collapse, visible restore button, tab switching and canvas resize");