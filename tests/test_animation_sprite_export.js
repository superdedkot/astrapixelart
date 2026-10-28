// Run: node tests/test_animation_sprite_export.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../ui/animation-panels.js"), "utf8");
const formats = vm.runInNewContext(source.match(/const formats = (\[[\s\S]*?\]);/)[1]);
const section = source.slice(source.indexOf("  async function exportAstraSpriteSheet()"),
  source.indexOf('  spriteExportButton.addEventListener("click"'));

async function main() {
  for (const count of [1, 7, 13, 300, 9, 16, 20, 21]) {
    const fixed = [9, 16, 20, 21].includes(count);
    const layout = fixed ? formats.find(item => item.count === count) : "custom";
    const size = 8;
    const draws = [];
    let sheet, saved;
    const context = {
      tabAnimation: { classList: { contains: () => true } },
      chosenFormat: layout, canvas: { width: size },
      frames: Array.from({ length: count }, (_, index) => ({ size,
        layers: [{ visible: true, opacity: 100, canvas: { width: 24, height: 24, index } }] })),
      window: { animationPlayback: { pause() {} } },
      initializeFrames() {}, captureFrame() {}, status: {},
      document: { createElement() {
        sheet = { getContext: () => ({ drawImage: (...args) => draws.push(args) }),
          toDataURL: () => "data:image/png;base64,fixture" };
        return sheet;
      } },
      astra: { async callBackend(method, params) {
        saved = { method, params }; return { path: "fixture.png" };
      } }
    };
    vm.runInNewContext(section, context);
    await context.exportAstraSpriteSheet();
    const columns = fixed ? layout.columns : count;
    assert.equal(sheet.width, columns * size);
    assert.equal(sheet.height, fixed ? layout.rows * size : size);
    assert.equal(draws.length, count);
    draws.forEach((args, index) => {
      assert.equal(args[0].index, index);
      assert.deepEqual(args.slice(1), [size, size, size, size,
        index % columns * size, Math.floor(index / columns) * size, size, size]);
    });
    assert.equal(saved.method, "save_png");
    assert.equal(saved.params.data_url, "data:image/png;base64,fixture");
    assert.equal(context.frames.length, count);
  }
  console.log("PASS: PNG export layouts 3x3, 4x4, 5x4, 7x3 and custom 1/7/13/300 frames in one row; order and crop preserved");
}
main().catch(error => { console.error(error); process.exitCode = 1; });