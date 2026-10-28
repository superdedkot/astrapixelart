const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../ui/export-settings.js"), "utf8");
const elements = {};
let folder = "C:\\Exports";
let cancel = false;
let fail = false;
let polls = 0;
vm.runInNewContext(source, {
  Option: function(text, value) { this.text = text; this.value = value; },
  setTimeout: callback => callback(),
  document: { getElementById: id => elements[id] ||= {
    handlers: {}, addEventListener(event, handler) { this.handlers[event] = handler; },
    replaceChildren(...items) { this.items = items; this.value = items[0]?.value || ""; }
  } },
  astra: { async callBackend(method, params) {
    if (fail) throw Error("offline");
    if (method === "list_export_directories") return {
      directory: params.directory || "C:\\Home", parent: "C:\\", drives: ["C:\\"],
      folders: [{name: "Chosen", path: "C:\\Chosen"}]
    };
    if (method === "choose_export_directory" && cancel) return { cancelled: true };
    if (method === "set_export_directory") folder = params.directory || "C:\\Downloads";
    if (method === "choose_export_directory") return { pending: true };
    if (method === "poll_export_directory") {
      if (++polls < 3) return { pending: true };
      folder = "C:\\Chosen";
    }
    return { directory: folder };
  } }
});
(async () => {
  const flush = () => new Promise(resolve => setImmediate(resolve));
  await flush();
  assert.equal(elements["export-directory"].value, folder);
  await elements["export-browse"].handlers.click();
  assert.equal(elements["export-picker"].hidden, false);
  await elements["export-open-folder"].handlers.click();
  assert.equal(elements["export-picker-path"].textContent, "C:\\Chosen");
  await elements["export-select-folder"].handlers.click();
  assert.equal(elements["export-directory"].value, "C:\\Chosen");
  cancel = true;
  await elements["export-browse"].handlers.click();
  elements["export-cancel"].handlers.click();
  assert.match(elements["export-settings-status"].textContent, /отменён/);
  assert.equal(elements["export-directory"].value, "C:\\Chosen");
  elements["export-directory"].value = "C:\\Manual";
  await elements["export-apply"].handlers.click();
  assert.equal(folder, "C:\\Manual");
  await elements["export-reset"].handlers.click();
  assert.equal(folder, "C:\\Downloads");
  fail = true;
  await elements["export-apply"].handlers.click();
  assert.match(elements["export-settings-status"].textContent, /offline/);
  assert.equal(elements["export-browse"].disabled, false);
  console.log("PASS: export folder load, browse, cancel, manual path, reset and errors");
})().catch(error => { console.error(error); process.exitCode = 1; });