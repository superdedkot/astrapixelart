"use strict";
(() => {
  const input = document.getElementById("export-directory");
  const status = document.getElementById("export-settings-status");
  const buttons = ["browse", "apply", "reset"].map(name => document.getElementById(`export-${name}`));
  const picker = document.getElementById("export-picker");
  const folders = document.getElementById("export-folders");
  const drives = document.getElementById("export-drives");
  const el = name => document.getElementById(`export-${name}`);
  let current = "";
  let parent = "";
  let loading = false;
  async function browse(directory) {
    if (loading) return;
    loading = true;
    picker.hidden = false;
    status.textContent = "Читаю список папок…";
    try {
      const result = await astra.callBackend("list_export_directories", { directory });
      current = result.directory;
      parent = result.parent;
      el("picker-path").textContent = current;
      folders.replaceChildren(...result.folders.map(item => new Option(item.name, item.path)));
      drives.replaceChildren(...result.drives.map(path => new Option(path, path)));
      drives.value = result.drives.find(path => current.toLowerCase().startsWith(path.toLowerCase())) || "";
      status.textContent = "Открой нужную папку или выбери текущую.";
    } catch (error) {
      status.textContent = `Не удалось открыть папку: ${error.message || error}. Можно указать путь вручную и нажать «Сохранить путь».`;
    } finally {
      loading = false;
    }
  }
  async function run(method, params = {}) {
    for (const button of buttons) button.disabled = true;
    input.disabled = true;
    status.textContent = method === "choose_export_directory" ? "Выбери папку в системном окне…" : "Читаю / сохраняю папку экспорта…";
    try {
      let result = await astra.callBackend(method, params);
      while (result.pending) {
        await new Promise(resolve => setTimeout(resolve, 500));
        result = await astra.callBackend("poll_export_directory", {});
      }
      if (result.cancelled) {
        status.textContent = "Выбор отменён. Папка не изменена.";
      } else {
        input.value = result.directory;
        status.textContent = method === "get_export_settings" ? "" : "Папка экспорта сохранена.";
      }
      return true;
    } catch (error) {
      status.textContent = `Не удалось настроить экспорт: ${error.message || error}. Если backend не отвечает, полностью перезапусти плагин. Путь можно указать вручную.`;
      return false;
    } finally {
      for (const button of buttons) button.disabled = false;
      input.disabled = false;
    }
  }
  buttons[0].addEventListener("click", () => browse(input.value));
  el("up").addEventListener("click", () => browse(parent));
  el("home").addEventListener("click", () => browse());
  el("open-path").addEventListener("click", () => browse(input.value));
  drives.addEventListener("change", () => browse(drives.value));
  const openFolder = () => folders.value && browse(folders.value);
  el("open-folder").addEventListener("click", openFolder);
  folders.addEventListener("dblclick", openFolder);
  el("select-folder").addEventListener("click", async () => {
    if (loading || !current) return;
    if (await run("set_export_directory", { directory: current })) picker.hidden = true;
  });
  el("cancel").addEventListener("click", () => {
    picker.hidden = true;
    status.textContent = "Выбор отменён. Папка не изменена.";
  });
  buttons[1].addEventListener("click", () => run("set_export_directory", { directory: input.value }));
  buttons[2].addEventListener("click", () => run("set_export_directory", { directory: "" }));
  run("get_export_settings");
})();