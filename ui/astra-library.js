"use strict";

(() => {
  const element = id => document.getElementById(`astra2d-${id}`);
  const page = element("page");
  const refresh = element("refresh");
  const message = element("message");
  const profiles = element("profiles");
  const clips = element("clips");
  const canvas = element("preview");
  const previewMessage = element("preview-message");
  const play = element("play");
  const stop = element("stop");
  const importButton = element("import");
  const sheetToggle = element("sheet-toggle");
  const sheetPanel = element("sheet-panel");
  const sheetImage = element("sheet-image");
  const sheetZoom = element("sheet-zoom");
  const sheetInfo = element("sheet-info");
  const packSelect = document.createElement("select");
  packSelect.setAttribute("aria-label", "Пакет анимаций для просмотра");
  const packLabel = document.createElement("label");
  packLabel.textContent = "Пакет (только для просмотра): ";
  packLabel.appendChild(packSelect);
  clips.before(packLabel);
  let libraryPacks = [];
  let selected = null;
  let version = 0;
  let timer = null;
  let preview = null;
  let loaded = false;
  let importConfirmTimer = null;

  function resetImportConfirmation() {
    clearTimeout(importConfirmTimer);
    importConfirmTimer = null;
    importButton.textContent = "Копия в редактор";
  }

  function stopPlayback() {
    clearInterval(timer);
    timer = null;
  }

  function resetPreview() {
    resetImportConfirmation();
    version++;
    stopPlayback();
    preview = null;
    canvas.hidden = true;
    play.disabled = true;
    stop.disabled = true;
    importButton.disabled = true;
    sheetToggle.disabled = true;
    sheetToggle.textContent = "Полный PNG-лист";
    sheetToggle.setAttribute("aria-expanded", "false");
    sheetPanel.hidden = true;
    sheetImage.removeAttribute("src");
    sheetInfo.textContent = "";
    previewMessage.textContent = "";
  }

  function drawFrame(index) {
    const { image, frame, columns } = preview;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = false;
    context.drawImage(image, (index % columns) * frame,
      Math.floor(index / columns) * frame, frame, frame, 0, 0, canvas.width, canvas.height);
  }

  function startPlayback() {
    stopPlayback();
    if (!preview || page.hidden) return;
    sheetPanel.hidden = true;
    sheetToggle.textContent = "Полный PNG-лист";
    sheetToggle.setAttribute("aria-expanded", "false");
    canvas.hidden = false;
    let index = 0;
    drawFrame(0);
    timer = setInterval(() => {
      if (page.hidden) { stopPlayback(); return; }
      index++;
      if (index >= preview.count) {
        if (!preview.loops) { stopPlayback(); return; }
        index = 0;
      }
      drawFrame(index);
    }, 1000 / preview.fps);
  }

  async function loadPreview() {
    resetPreview();
    if (!selected || !clips.value) return;
    const request = version;
    previewMessage.textContent = "Читаю изображение анимации…";
    try {
      const result = await astra.callBackend("preview_astra_2d", {
        characterId: selected.id, clipKey: clips.value, packId: packSelect.value || null
      });
      if (request !== version) return;
      if (!result.available) { previewMessage.textContent = result.message; return; }
      const image = await new Promise((resolve, reject) => {
        const value = new Image();
        value.onload = () => resolve(value);
        value.onerror = () => reject(new Error("Не удалось декодировать PNG."));
        value.src = result.dataUrl;
      });
      if (request !== version) return;
      const frame = Number(result.frame);
      const fps = Number(result.fps);
      if (!Number.isInteger(frame) || frame < 1 || frame > 2048 ||
          image.naturalWidth % frame || image.naturalHeight % frame ||
          image.naturalWidth * image.naturalHeight > 32 * 1024 * 1024 ||
          !Number.isFinite(fps) || fps <= 0 || fps > 240) {
        throw new Error("Размер PNG или параметры кадров не подходят для предпросмотра.");
      }
      const columns = image.naturalWidth / frame;
      sheetImage.src = result.dataUrl;
      sheetZoom.value = "1";
      sheetImage.width = image.naturalWidth;
      sheetImage.height = image.naturalHeight;
      sheetInfo.textContent = `PNG: ${image.naturalWidth}×${image.naturalHeight} пикселей. ` +
        `Сетка: ${columns} столбцов × ${image.naturalHeight / frame} рядов; ` +
        `клетка ${frame}×${frame}, всего ${columns * image.naturalHeight / frame} клеток.`;
      sheetToggle.disabled = false;
      const count = columns * image.naturalHeight / frame;
      if (!count) throw new Error("PNG не содержит кадров.");
      preview = { image, frame, columns, count, fps, loops: result.loops,
        name: clips.selectedOptions[0].textContent };
      canvas.hidden = false;
      play.disabled = false;
      stop.disabled = false;
      importButton.disabled = ![8, 16, 32, 64, 128, 256, 512].includes(frame) || count > 300;
      previewMessage.textContent = `${count} кадров • ${frame}×${frame} • ${fps} FPS` +
        (result.source ? ` • ${result.source}` : "");
      drawFrame(0);
    } catch (error) {
      if (request === version) previewMessage.textContent = `Не удалось показать анимацию: ${error.message}`;
    }
  }

  function selectProfile(profile) {
    selected = profile;
    resetPreview();
    element("title").textContent = `${profile.name}${profile.active ? " — активный в Astra" : ""}`;
    packSelect.replaceChildren();
    const effective = document.createElement("option");
    effective.value = "";
    effective.textContent = "Пакеты выбранного профиля";
    packSelect.appendChild(effective);
    for (const pack of libraryPacks) {
      const option = document.createElement("option");
      option.value = pack.id;
      option.textContent = `${pack.name} [${pack.id}] — ${pack.clips.length} записей`;
      packSelect.appendChild(option);
    }
    selectPack();
  }

  function selectPack() {
    resetPreview();
    const source = packSelect.value
      ? libraryPacks.find(pack => pack.id === packSelect.value) : selected;
    clips.replaceChildren();
    for (const clip of source?.clips || []) {
      const option = document.createElement("option");
      option.value = clip.key;
      option.textContent = `${clip.overlay ? "Эффект: " : ""}${clip.name} — ${clip.fps} FPS${clip.pack ? ` (${clip.pack})` : ""}`;
      clips.appendChild(option);
    }
    clips.disabled = !source?.clips.length;
    if (source?.clips.length) loadPreview();
    else previewMessage.textContent = "В индексе нет анимаций этого профиля.";
  }

  async function loadProfiles() {
    refresh.disabled = true;
    resetPreview();
    selected = null;
    clips.replaceChildren();
    clips.disabled = true;
    packSelect.replaceChildren();
    libraryPacks = [];
    profiles.replaceChildren();
    element("title").textContent = "";
    message.textContent = "Читаю библиотеку Astra…";
    try {
      const result = await astra.callBackend("list_astra_2d", {});
      libraryPacks = result.packs || [];
      element("source").textContent = result.source;
      message.textContent = `Найдено 2D-профилей: ${result.profiles.length}. ${result.notice}`;
      for (const profile of result.profiles) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `${profile.name} — ${profile.builtin ? "встроенный" : "пользовательский"} (${profile.clips.length} анимаций)`;
        button.addEventListener("click", () => selectProfile(profile));
        profiles.appendChild(button);
      }
      loaded = true;
      if (result.profiles.length) selectProfile(result.profiles[0]);
    } catch (error) {
      message.textContent = `Не удалось прочитать библиотеку: ${error.message}`;
    } finally {
      refresh.disabled = false;
    }
  }

  refresh.addEventListener("click", loadProfiles);
  sheetToggle.addEventListener("click", () => {
    if (!preview || sheetToggle.disabled) return;
    stopPlayback();
    sheetPanel.hidden = !sheetPanel.hidden;
    canvas.hidden = !sheetPanel.hidden;
    sheetToggle.textContent = sheetPanel.hidden ? "Полный PNG-лист" : "Вернуться к анимации";
    sheetToggle.setAttribute("aria-expanded", String(!sheetPanel.hidden));
  });
  sheetZoom.addEventListener("change", () => {
    if (!preview) return;
    const zoom = Number(sheetZoom.value);
    if (![1, 2, 4].includes(zoom)) return;
    sheetImage.width = preview.image.naturalWidth * zoom;
    sheetImage.height = preview.image.naturalHeight * zoom;
  });
  packSelect.addEventListener("change", selectPack);
  importButton.addEventListener("click", async () => {
    if (!preview || importButton.disabled) return;
    if (importConfirmTimer === null) {
      importButton.textContent = "Заменить черновик? Нажми ещё раз";
      previewMessage.textContent = "Копия заменит текущий черновик во вкладке «Анимация». Сначала сохрани его, если он нужен. Для импорта нажми кнопку ещё раз. Файлы Astra не изменятся.";
      importConfirmTimer = setTimeout(resetImportConfirmation, 8000);
      return;
    }
    resetImportConfirmation();
    const source = preview;
    importButton.disabled = true;
    stopPlayback();
    try {
      if (!window.animationEditor?.loadSavedAnimation) throw new Error("Редактор ещё не готов.");
      const frames = Array.from({ length: source.count }, (_, index) => {
        const output = document.createElement("canvas");
        output.width = output.height = source.frame;
        const context = output.getContext("2d");
        context.imageSmoothingEnabled = false;
        context.drawImage(source.image, (index % source.columns) * source.frame,
          Math.floor(index / source.columns) * source.frame, source.frame, source.frame,
          0, 0, source.frame, source.frame);
        return { layers: [{ name: "Оригинал (копия)", visible: true, opacity: 100,
          data: output.toDataURL("image/png") }] };
      });
      const tab = document.getElementById("tab-animation");
      tab.click();
      const deadline = performance.now() + 10000;
      while (!tab.classList.contains("active")) {
        if (performance.now() > deadline) throw new Error("Вкладка «Анимация» не открылась.");
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
      await window.animationEditor.loadSavedAnimation({
        id: newId(), name: `Копия ${source.name}`,
        size: source.frame, format: "custom", fps: source.fps, frames
      });
    } catch (error) {
      const text = `Не удалось создать копию: ${error.message}`;
      previewMessage.textContent = text;
      if (page.hidden) status.textContent = text;
    } finally {
      if (preview === source) importButton.disabled = false;
    }
  });
  clips.addEventListener("change", loadPreview);
  play.addEventListener("click", startPlayback);
  stop.addEventListener("click", stopPlayback);
  new MutationObserver(() => {
    if (page.hidden) { stopPlayback(); resetImportConfirmation(); return; }
    if (!loaded && !refresh.disabled) loadProfiles();
  }).observe(page, { attributes: true, attributeFilter: ["hidden"] });
})();