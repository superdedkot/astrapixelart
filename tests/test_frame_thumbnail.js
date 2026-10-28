// Run: node tests/test_frame_thumbnail.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../ui/animation-panels.js"), "utf8");
const start = source.indexOf("  function drawFrameThumbnail(");
const end = source.indexOf("  // Refresh only the active preview", start);
const scope = {};
vm.runInNewContext(source.slice(start, end), scope);
const draws = [];
const context = {
  clearRect(...args) { assert.deepEqual(args, [0, 0, 40, 40]); },
  drawImage(...args) { draws.push({ args, alpha: this.globalAlpha }); }
};
const bottom = { width: 24, height: 24 };
const top = { width: 8, height: 8 };
scope.drawFrameThumbnail({ size: 8, layers: [
  { canvas: top, visible: true, opacity: 50 },
  { canvas: {}, visible: false, opacity: 100 },
  { canvas: bottom, visible: true, opacity: 100 }
] }, { getContext: () => context });
assert.equal(draws.length, 2);
assert.equal(draws[0].args[0], bottom);
assert.deepEqual(draws[0].args.slice(1), [8, 8, 8, 8, 0, 0, 40, 40]);
assert.equal(draws[1].args[0], top);
assert.equal(draws[1].alpha, 0.5);
assert.equal(context.globalAlpha, 1);
assert.equal(context.imageSmoothingEnabled, false);
console.log("PASS: frame thumbnail crop, layer order, visibility and opacity");