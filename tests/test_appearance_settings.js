const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../ui/appearance-settings.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../ui/astra-theme.css"), "utf8");
assert.equal(css.split("{").length, css.split("}").length);
const html = fs.readFileSync(path.join(__dirname, "../ui/index.html"), "utf8");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(ids.length, new Set(ids).size);
for (const name of ["Tiny5.ttf", "Caveat.ttf"]) {
  const font = fs.readFileSync(path.join(__dirname, "../ui/fonts", name));
  assert.equal(font.readUInt32BE(0), 0x00010000);
  assert.ok(font.length > 10000);
}
function setup(stored, failStorage = false, backend = undefined) {
  const elements = {};
  const properties = {};
  const content = { handlers: {}, scrollTop: 0, clientHeight: 500, scrollHeight: 2400,
    getBoundingClientRect: () => ({ top: 0 }),
    scrollTo({ top }) { this.scrollTop = Math.min(top, this.scrollHeight - this.clientHeight); },
    addEventListener(event, handler) { this.handlers[event] = handler; } };
  const sections = ["settings-meow", "settings-windows", "settings-fonts", "settings-export"]
    .map((id, index) => ({ id, style: { setProperty() {} }, getBoundingClientRect: () => ({ top: index * 600 - content.scrollTop }) }));
  elements["settings-content"] = content;
  const make = () => ({ handlers: {}, attributes: {},
    addEventListener(event, handler) { this.handlers[event] = handler; },
    setAttribute(key, value) { this.attributes[key] = value; } });
  const buttons = sections.map(section => Object.assign(make(), { dataset: { settingsTarget: section.id } }));
  let saved;
  vm.runInNewContext(source, {
    astra: backend && { callBackend: backend },
    document: {
      getElementById: id => elements[id] ||= make(),
      documentElement: { style: { setProperty(key, value) { properties[key] = value; } } },
      querySelectorAll: selector => selector === "[data-settings-target]" ? buttons : sections
    },
    localStorage: {
      getItem() { if (failStorage) throw Error(); return stored; },
      setItem(key, value) { if (failStorage) throw Error(); saved = JSON.parse(value); }
    },
    requestAnimationFrame: callback => callback(), window: { dispatchEvent() {}, addEventListener() {} }, Event: class {}
  });
  return { elements, properties, sections, buttons, content, saved: () => saved };
}
const custom = setup(JSON.stringify({ secondaryColor: "#123456", buttonColor: "#abcdef", buttonOpacity: 45 }));
assert.equal(custom.properties["--apa-secondary"], "#123456");
assert.equal(custom.properties["--apa-button"], "rgba(171, 205, 239, 0.45)");
custom.elements["appearance-buttonOpacity"].value = "0";
custom.elements["appearance-buttonOpacity"].handlers.input();
assert.equal(custom.saved().buttonOpacity, 0);
assert.equal(custom.properties["--apa-button"], "rgba(171, 205, 239, 0)");
const customRestored = setup(JSON.stringify(custom.saved()));
assert.equal(customRestored.properties["--apa-secondary"], "#123456");
custom.elements["appearance-reset-windows"].handlers.click();
assert.equal(custom.saved().buttonOpacity, 8);
assert.equal(custom.saved().secondaryColor, "#2c2c30");
const invalidColors = setup(JSON.stringify({ secondaryColor: "bad", buttonColor: "#fff", buttonOpacity: 500 }));
assert.equal(invalidColors.properties["--apa-secondary"], "#2c2c30");
assert.equal(invalidColors.properties["--apa-button"], "rgba(255, 255, 255, 1)");
const ui = setup("{broken");
assert.match(ui.properties["--apa-font"], /APA Pixel/);
assert.equal(ui.properties["--apa-radius"], "22px");
ui.elements["appearance-opacity"].value = "40";
ui.elements["appearance-opacity"].handlers.input();
assert.equal(ui.saved().opacity, 40);
assert.equal(ui.properties["--apa-surface"], "rgba(65, 22, 34, 0.4)");
ui.elements["appearance-glass"].checked = true;
ui.elements["appearance-glass"].handlers.change();
assert.equal(ui.properties["--apa-blur"], "10px");
assert.equal(ui.elements["appearance-blur"].disabled, false);
ui.elements["appearance-font"].value = "hand";
ui.elements["appearance-font"].handlers.change();
assert.match(ui.properties["--apa-font"], /APA Hand/);
const restored = setup(JSON.stringify(ui.saved()));
assert.match(restored.properties["--apa-font"], /APA Hand/);
ui.buttons[1].handlers.click();
assert.equal(ui.sections[1].hidden, false);
assert.ok(ui.sections.every(section => section.hidden === false));
assert.equal(ui.content.scrollTop, 576);
assert.equal(ui.buttons[1].attributes["aria-current"], "location");
ui.content.scrollTop = 1250;
ui.content.handlers.scroll();
assert.equal(ui.buttons[2].attributes["aria-current"], "location");
ui.buttons[3].handlers.click();
assert.equal(ui.content.scrollTop, 1776);
assert.equal(ui.buttons[3].attributes["aria-current"], "location");
ui.content.scrollTop = 1900;
ui.content.handlers.scroll();
assert.equal(ui.buttons[3].attributes["aria-current"], "location");
ui.buttons[0].handlers.click();
assert.equal(ui.content.scrollTop, 0);
assert.equal(ui.buttons[0].attributes["aria-current"], "location");
for (const match of html.matchAll(/<[^>]+data-settings-section[^>]*>/g)) {
  assert.doesNotMatch(match[0], /\bhidden\b/);
}
ui.elements["appearance-reset-windows"].handlers.click();
assert.equal(ui.saved().opacity, 90);
assert.equal(ui.saved().font, "hand");
ui.elements["appearance-reset-fonts"].handlers.click();
assert.equal(ui.saved().font, "pixel");
const invalid = setup(JSON.stringify({ radius: 999, opacity: -50, font: "__proto__", color: "invalid" }));
assert.equal(invalid.properties["--apa-radius"], "36px");
assert.equal(invalid.properties["--apa-surface"], "rgba(65, 22, 34, 0.1)");
assert.equal(invalid.properties["--apa-text"], "#f3e9eb");
const selectionTheme = setup(JSON.stringify({ secondaryColor: "#326598", controlColor: "#ab1234" }));
assert.equal(selectionTheme.properties["--apa-accent"], "#326598");
assert.equal(selectionTheme.properties["--apa-control-color"], "#ab1234");
selectionTheme.elements["appearance-secondaryColor"].value = "#578abc";
selectionTheme.elements["appearance-secondaryColor"].handlers.input();
assert.equal(selectionTheme.properties["--apa-accent"], "#578abc");
assert.equal(selectionTheme.saved().secondaryColor, "#578abc");
const blocked = setup(null, true);
blocked.elements["appearance-reset-fonts"].handlers.click();
assert.match(blocked.elements["appearance-status"].textContent, /хранилище недоступно/);
console.log("PASS: appearance controls, storage reload/failure, validation, resets and navigation");

(async () => {
  let file = { opacity: 35, radius: 8, blur: 6, glass: true, font: "hand", color: "#112233" };
  const backend = async (method, params) => {
    if (method === "load_appearance") return { settings: file };
    file = JSON.parse(JSON.stringify(params.settings));
    return { ok: true };
  };
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const first = setup(null, true, backend);
  await flush();
  assert.equal(first.properties["--apa-radius"], "8px");
  first.elements["appearance-opacity"].value = "65";
  first.elements["appearance-opacity"].handlers.input();
  first.elements["appearance-opacity"].value = "75";
  first.elements["appearance-opacity"].handlers.input();
  await flush();
  assert.equal(file.opacity, 75);
  assert.match(first.elements["appearance-status"].textContent, /сохранено в файл/);
  const second = setup(null, true, backend);
  await flush();
  assert.equal(second.properties["--apa-surface"], "rgba(65, 22, 34, 0.75)");
  let finishLoad;
  const racing = setup(null, true, (method) => method === "load_appearance"
    ? new Promise(resolve => { finishLoad = resolve; }) : Promise.resolve({ ok: true }));
  racing.elements["appearance-radius"].value = "12";
  racing.elements["appearance-radius"].handlers.input();
  finishLoad({ settings: file });
  await flush();
  assert.equal(racing.properties["--apa-radius"], "12px");
  const failing = setup(null, true, async () => { throw Error("offline"); });
  await flush();
  failing.elements["appearance-reset-fonts"].handlers.click();
  await flush();
  assert.match(failing.elements["appearance-status"].textContent, /Не удалось сохранить/);
  console.log("PASS: backend persistence without localStorage, ordered saves, load race and failure");
})().catch(error => { console.error(error); process.exitCode = 1; });