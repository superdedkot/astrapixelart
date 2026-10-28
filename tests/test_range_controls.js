const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const handlers = {};
let tick;
function range(min, max, value) {
  const properties = {};
  return { min, max, value, matches: () => true,
    style: { getPropertyValue: key => properties[key], setProperty: (key, value) => { properties[key] = value; } } };
}
const brush = range("1", "50", "1");
const opacity = range("0", "100", "100");
const zoom = range("25", "800", "100");
const inputs = [brush, opacity, zoom];
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../ui/range-controls.js"), "utf8"), {
  document: { querySelectorAll: () => inputs, addEventListener: (name, handler) => { handlers[name] = handler; } },
  window: { setInterval: callback => { tick = callback; } }
});
const progress = input => input.style.getPropertyValue("--range-progress");
assert.equal(progress(brush), "0%");
assert.equal(progress(opacity), "100%");
assert.ok(parseFloat(progress(zoom)) > 9);
brush.value = "50";
handlers.input({ target: brush });
assert.equal(progress(brush), "100%");
opacity.value = "30";
tick();
assert.equal(progress(opacity), "30%");
const onion = range("0", "100", "30");
inputs.push(onion);
tick();
assert.equal(progress(onion), "30%");
onion.value = "200";
handlers.change();
assert.equal(progress(onion), "100%");
console.log("PASS: slider initial values, input, programmatic updates, dynamic controls and limits");