// Run: node tests/test_animation_apng.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

async function main() {
  const source = fs.readFileSync(
    path.join(__dirname, "../ui/animation-panels.js"), "utf8"
  );
  const section = source.slice(
    source.indexOf('  const gifButton = document.createElement("button");'),
    source.indexOf('  const mp4Button = document.createElement("button");')
  );
  assert.ok(section.length > 0);
  let active = true;
  let backendError = false;
  const buttons = [];
  const observers = [];
  const calls = [];
  const draws = [];
  const status = { textContent: "" };
  const layer = { visible: true, opacity: 50, canvas: { width: 12, height: 12 } };
  const context = {
    tabAnimation: { classList: { contains: () => active } },
    filesChoices: { appendChild: button => buttons.push(button) },
    MutationObserver: class {
      constructor(callback) { observers.push(callback); }
      observe() {}
    },
    document: {
      createElement(type) {
        if (type === "button") {
          return { addEventListener(event, callback) { this.click = callback; } };
        }
        const output = {
          drawImage(...args) { draws.push({ args, alpha: this.globalAlpha }); }
        };
        return {
          getContext: () => output,
          toDataURL: format => { assert.equal(format, "image/png"); return "png-frame"; }
        };
      }
    },
    canvas: { width: 4 },
    frames: [{ size: 4, layers: [layer] }],
    fps: 12,
    pausePlayback() {},
    initializeFrames() {},
    captureFrame() {},
    status,
    astra: {
      async callBackend(method, params) {
        calls.push({ method, params });
        if (backendError) throw new Error("test error");
        return { path: "test-export", frames: 1 };
      }
    }
  };
  vm.runInNewContext(section, context);
  assert.deepEqual(buttons.map(button => button.textContent), ["Экспорт GIF", "Экспорт APNG"]);
  const [gif, apng] = buttons;
  assert.equal(apng.hidden, false);
  active = false;
  observers.forEach(callback => callback());
  assert.equal(apng.hidden, true);
  active = true;
  observers.forEach(callback => callback());
  await apng.click();
  assert.equal(calls[0].method, "export_apng");
  assert.equal(calls[0].params.fps, 12);
  assert.equal(calls[0].params.frames[0], "png-frame");
  assert.deepEqual(draws[0].args.slice(1), [4, 4, 4, 4, 0, 0, 4, 4]);
  assert.equal(draws[0].alpha, 0.5);
  assert.match(status.textContent, /APNG сохранён/);
  assert.equal(apng.disabled, false);
  await gif.click();
  assert.equal(calls[1].method, "export_gif");
  backendError = true;
  await apng.click();
  assert.match(status.textContent, /Не удалось экспортировать APNG: test error/);
  assert.equal(apng.disabled, false);
  console.log("PASS: APNG/GIF routing, visibility, center crop, opacity, error recovery");
}

main().catch(error => { console.error(error); process.exitCode = 1; });