// Run: node tests/test_animation_sprite_import.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class Element {
  constructor(type) {
    this.type = type;
    this.style = {};
    this.children = [];
    this.handlers = {};
    this.open = false;
  }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); }
  setAttribute() {}
  addEventListener(name, callback) { this.handlers[name] = callback; }
  click() { return this.handlers.click?.(); }
  showModal() { this.open = true; }
  close() { this.open = false; }
}

class RasterCanvas extends Element {
  constructor() { super("canvas"); }
  getContext() {
    this.pixels = new Uint32Array(this.width * this.height);
    return {
      drawImage: (source, sx, sy, sw, sh, dx, dy, dw, dh) => {
        assert.equal(sw, dw, "No rescaling");
        assert.equal(sh, dh, "No rescaling");
        for (let y = 0; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            this.pixels[(dy + y) * this.width + dx + x] =
              source.pixels[(sy + y) * source.naturalWidth + sx + x];
          }
        }
      }
    };
  }
}

const source = fs.readFileSync(path.join(__dirname, "../ui/animation-panels.js"), "utf8");
const formats = vm.runInNewContext(source.match(/const formats = (\[[\s\S]*?\]);/)[1]);
assert.equal(formats.find(item => item.count === 9).columns, 3);
assert.equal(formats.find(item => item.count === 9).rows, 3);
assert.equal(formats.find(item => item.count === 16).columns, 4);
assert.equal(formats.find(item => item.count === 16).rows, 4);
assert.equal(formats.find(item => item.count === 20).columns, 5);
assert.equal(formats.find(item => item.count === 20).rows, 4);
assert.equal(formats.find(item => item.count === 21).columns, 7);
assert.equal(formats.find(item => item.count === 21).rows, 3);
const section = source.slice(
  source.indexOf("  function splitAstraSpriteSheet("),
  source.indexOf('  const spriteExportButton = document.createElement("button");')
);
assert.ok(section.length > 0);

function sheet(format, size = 8) {
  const naturalWidth = format.columns * size;
  const naturalHeight = format.rows * size;
  const pixels = new Uint32Array(naturalWidth * naturalHeight);
  for (let y = 0; y < naturalHeight; y++) {
    for (let x = 0; x < naturalWidth; x++) {
      const frame = Math.floor(y / size) * format.columns + Math.floor(x / size);
      // Distinct frame, pixel positions and alpha, including transparent pixels.
      pixels[y * naturalWidth + x] =
        ((x % size === 0 ? 0 : 128) << 24) | ((frame + 1) << 16) | ((y % size) << 8) | (x % size);
    }
  }
  return { naturalWidth, naturalHeight, pixels };
}

function setup() {
  let active = true;
  const observers = [];
  const body = new Element("body");
  const menu = new Element("menu");
  const old = [{ original: true }];
  const context = {
    formats, Uint8Array,
    document: { body, createElement: type => type === "canvas" ? new RasterCanvas() : new Element(type) },
    filesChoices: menu,
    tabAnimation: { classList: { contains: () => active } },
    MutationObserver: class {
      constructor(callback) { observers.push(callback); }
      observe() {}
    },
    frames: old,
    chosenFrame: 2,
    chosenFormat: "custom",
    animationId: "old-id",
    animationName: "Old animation",
    fps: 17,
    selectionMove: {},
    undoHistory: [1], redoHistory: [2],
    frameList: { scrollLeft: 10 },
    projectNameElement: { textContent: "Old" },
    status: { textContent: "" },
    newId: () => "new-id",
    pausePlayback() {}, stopDrawing() {},
    restoreSnapshot(snapshot) { context.restored = snapshot; },
    updateHistoryButtons() {}, renderFormats() {}, renderFrames() {},
    readFileAsDataUrl: async () => "image-data",
    loadImage: async () => sheet(formats[2])
  };
  vm.createContext(context);
  vm.runInContext(section, context);
  return {
    context, old, body, menu,
    setActive(value) { active = value; observers.forEach(callback => callback()); }
  };
}

function pngFile(name = "Walk.png") {
  return {
    name, size: 100,
    slice: () => ({ arrayBuffer: async () => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer })
  };
}

async function main() {
  let checks = 0;
  const { context } = setup();
  for (const format of formats) {
    const image = sheet(format);
    const frames = context.splitAstraSpriteSheet(image, format);
    assert.equal(frames.length, format.count);
    for (let index = 0; index < frames.length; index++) {
      const frame = frames[index];
      assert.equal(frame.size, 8);
      assert.equal(frame.layers.length, 1);
      assert.equal(frame.layers[0].opacity, 100);
      assert.equal(frame.layers[0].visible, true);
      const canvas = frame.layers[0].canvas;
      assert.equal(canvas.width, 24);
      assert.equal(canvas.height, 24);
      for (let y = 0; y < 24; y++) {
        for (let x = 0; x < 24; x++) {
          const expected = x >= 8 && x < 16 && y >= 8 && y < 16
            ? image.pixels[(Math.floor(index / format.columns) * 8 + y - 8) * image.naturalWidth +
                (index % format.columns) * 8 + x - 8]
            : 0;
          assert.equal(canvas.pixels[y * 24 + x], expected);
        }
      }
    }
    assert.notEqual(frames[0].layers[0].canvas, frames[1].layers[0].canvas);
    checks++;
  }
  for (const size of [16, 32, 64, 128, 256, 512]) {
    assert.equal(context.splitAstraSpriteSheet(sheet(formats[0], size), formats[0])[0].size, size);
  }
  checks++;
  for (const [width, height] of [[0, 16], [25, 16], [24, 17], [24, 32], [21, 14], [3078, 2052]]) {
    assert.throws(() => context.splitAstraSpriteSheet({ naturalWidth: width, naturalHeight: height }, formats[2]));
  }
  assert.throws(() => context.splitAstraSpriteSheet(sheet(formats[2]), "custom"));
  checks++;

  const valid = setup();
  await valid.context.importAstraSpriteSheet(pngFile(), formats[2]);
  assert.equal(valid.context.frames.length, 6);
  assert.equal(valid.context.chosenFormat, formats[2]);
  assert.equal(valid.context.chosenFrame, 0);
  assert.equal(valid.context.animationId, "new-id");
  assert.equal(valid.context.animationName, "Walk");
  assert.equal(valid.context.fps, 17);
  assert.equal(valid.context.restored, valid.context.frames[0]);
  assert.equal(valid.context.undoHistory.length, 0);
  assert.equal(valid.context.redoHistory.length, 0);
  assert.equal(valid.context.selectionMove, null);
  assert.match(valid.context.status.textContent, /Импортировано 6 кадров/);
  checks++;

  for (const failure of ["extension", "size", "signature", "decode", "grid", "tab"]) {
    const { context: c, old, setActive } = setup();
    const file = pngFile();
    if (failure === "extension") file.name = "test.jpg";
    if (failure === "size") file.size = 21 * 1024 * 1024;
    if (failure === "signature") file.slice = () => ({ arrayBuffer: async () => new ArrayBuffer(8) });
    if (failure === "decode") c.loadImage = async () => { throw new Error("decode failed"); };
    if (failure === "grid") c.loadImage = async () => ({ naturalWidth: 25, naturalHeight: 16 });
    if (failure === "tab") c.loadImage = async () => { setActive(false); return sheet(formats[2]); };
    await assert.rejects(c.importAstraSpriteSheet(file, formats[2]));
    assert.equal(c.frames, old);
    assert.equal(c.animationId, "old-id");
    assert.equal(c.animationName, "Old animation");
    assert.equal(c.undoHistory.length, 1);
    checks++;
  }

  const ui = setup();
  const button = ui.menu.children[0];
  const input = ui.body.children.find(element => element.type === "file");
  const dialog = ui.body.children.find(element => element.type === "dialog");
  const options = dialog.children[3];
  assert.equal(options.children.length, 11);
  assert.equal(button.hidden, false);
  await button.click();
  assert.equal(dialog.open, true);
  assert.match(dialog.children[2].textContent, /Несохранённые изменения будут потеряны/);
  await dialog.children[4].click();
  assert.equal(dialog.open, false);
  assert.equal(ui.context.frames, ui.old);
  await button.click();
  await options.children[2].click();
  assert.equal(dialog.open, false);
  input.files = [pngFile()];
  await input.handlers.change();
  assert.equal(ui.context.frames.length, 6);
  assert.equal(button.disabled, false);
  assert.equal(input.value, "");
  ui.setActive(false);
  assert.equal(button.hidden, true);
  checks++;
  console.log(`PASS: ${checks} sprite import checks (layouts, pixels/alpha, sizes, state, failures, menu)`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });