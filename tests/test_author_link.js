const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../ui/author-link.js"), "utf8");
async function test(fail) {
  let click, prevented = false;
  const status = { setAttribute() {} };
  const link = { parentElement: { after() {} }, addEventListener(type, handler) { click = handler; } };
  vm.runInNewContext(source, {
    document: { querySelector: () => link, createElement: () => status },
    astra: { async callBackend(method, params) {
      assert.equal(method, "open_author_telegram");
      assert.equal(Object.keys(params).length, 0);
      if (fail) throw Error("offline");
    } }
  });
  await click({ preventDefault() { prevented = true; } });
  assert.ok(prevented);
  assert.match(status.textContent, fail ? /https:\/\/t.me\/super_ded_kot/ : /передана браузеру/);
}
(async () => {
  await test(false);
  await test(true);
  console.log("PASS: author link backend routing and visible failure");
})().catch(error => { console.error(error); process.exitCode = 1; });