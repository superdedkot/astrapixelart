"use strict";
(() => {
  const workspace = document.querySelector("#art-page .workspace");
  const tabAnimation = document.getElementById("tab-animation");
  if (!workspace || !tabAnimation) return;

  const formats = [
    { count: 2, rows: 1, columns: 2 },
    { count: 4, rows: 2, columns: 2 },
    { count: 6, rows: 2, columns: 3 },
    { count: 8, rows: 2, columns: 4 },
    { count: 10, rows: 2, columns: 5 },
    { count: 12, rows: 3, columns: 4 },
    { count: 15, rows: 3, columns: 5 }
  ];

  const style = document.createElement("style");
  style.textContent = `
    body.animation-workspace .workspace {
      grid-template-rows: minmax(0, 1fr) 170px;
    }
    body.animation-workspace .workspace > .tools-panel {
      grid-column: 1; grid-row: 1;
    }
    body.animation-workspace .workspace > .canvas-panel {
      grid-column: 2; grid-row: 1;
    }
    body.animation-workspace .workspace > .layers-panel {
      grid-column: 3; grid-row: 1;
    }
    body.animation-workspace #animation-format {
      grid-column: 1; grid-row: 2;
    }
    body.animation-workspace #animation-frames {
      grid-column: 2; grid-row: 2;
    }
    body.animation-workspace #animation-reserve {
      grid-column: 3; grid-row: 2;
    }
    .animation-extra-panel { overflow: auto; }
    .animation-extra-panel h2 { margin-bottom: 8px; }
    #animation-format-options {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 5px;
    }
    #animation-format-options button {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      min-width: 0;
      padding: 5px;
      font-size: 12px;
    }
    #animation-format-options button.active,
    #animation-frame-list button.active {
      outline: 2px solid #90caff;
      outline-offset: -2px;
    }
    .animation-format-diagram {
      display: grid;
      gap: 2px;
      flex: none;
    }
    .animation-format-diagram span {
      width: 7px;
      height: 7px;
      border: 1px solid #ddd;
      background: rgba(144, 202, 255, 0.55);
    }
    #animation-frame-list {
      display: flex;
      gap: 7px;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 3px 2px 10px;
      overscroll-behavior-x: contain;
    }
    #animation-frame-list button {
      flex: 0 0 74px;
      height: 75px;
      padding: 5px;
      text-align: center;
    }
    #animation-frame-list small {
      display: block;
      margin-top: 5px;
      opacity: 0.8;
    }
  `;
  document.head.appendChild(style);

  function addPanel(id, title) {
    const panel = document.createElement("section");
    panel.id = id;
    panel.className = "panel animation-extra-panel";
    panel.hidden = true;
    const heading = document.createElement("h2");
    heading.textContent = title;
    panel.appendChild(heading);
    workspace.appendChild(panel);
    return panel;
  }

  const formatPanel = addPanel("animation-format", "Формат");
  const framesPanel = addPanel("animation-frames", "Кадры");
  const reservePanel = addPanel("animation-reserve", "Резерв");
  const panels = [formatPanel, framesPanel, reservePanel];

  const formatOptions = document.createElement("div");
  formatOptions.id = "animation-format-options";
  formatPanel.appendChild(formatOptions);

  const frameInfo = document.createElement("div");
  frameInfo.style.marginBottom = "5px";
  framesPanel.appendChild(frameInfo);

  const frameList = document.createElement("div");
  frameList.id = "animation-frame-list";
  framesPanel.appendChild(frameList);

  let chosenFormat = formats[2];
  let chosenFrame = 0;
  let frames = null;

  function emptyFrame() {
    const image = document.createElement("canvas");
    image.width = canvas.width * 3;
    image.height = canvas.height * 3;
    return {
      size: canvas.width,
      selectedIndex: 0,
      nextLayerNumber: 2,
      usedColors: [],
      selectionMask: null,
      layers: [{
        name: "Слой 1",
        canvas: image,
        visible: true,
        opacity: 100
      }]
    };
  }

  function initializeFrames() {
    if (frames) return;
    frames = Array.from(
      { length: chosenFormat.count },
      () => emptyFrame()
    );
    // Первый кадр — текущий пустой черновик анимации.
    frames[0] = takeSnapshot();
  }

  function captureFrame() {
    if (frames && tabAnimation.classList.contains("active")) {
      stopDrawing();
      frames[chosenFrame] = takeSnapshot();
    }
  }

  function openFrame(index) {
    if (index === chosenFrame) return;
    captureFrame();
    chosenFrame = index;
    selectionMove = null;
    restoreSnapshot(frames[index]);
    renderFrames();
  }

  function renderFrames() {
    if (!frames) return;
    frameInfo.textContent = `Кадр ${chosenFrame + 1} из ${frames.length}`;
    const previousScroll = frameList.scrollLeft;
    frameList.replaceChildren();

    frames.forEach((frame, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.classList.toggle("active", index === chosenFrame);
      button.setAttribute("aria-label", `Кадр ${index + 1}`);
      button.textContent = String(index + 1);

      const position = document.createElement("small");
      if (chosenFormat === "custom") {
        position.textContent = "кадр";
      } else {
        const row = Math.floor(index / chosenFormat.columns) + 1;
        const column = index % chosenFormat.columns + 1;
        position.textContent = `${row} ряд · ${column} место`;
      }
      button.appendChild(position);
      button.addEventListener("click", () => openFrame(index));
      const card = document.createElement("div");
      card.className = "frame-card";
      const more = document.createElement("button");
      more.type = "button";
      more.className = "frame-more";
      more.textContent = "☰";
      more.title = `Действия с кадром ${index + 1}`;
      more.addEventListener("click", (event) => {
        event.stopPropagation();
        showFrameActions(index, more);
      });
      card.append(button, more);
      frameList.appendChild(card);
    });

    if (chosenFormat === "custom") {
      const add = document.createElement("button");
      add.type = "button";
      add.textContent = "+";
      add.title = "Добавить пустой кадр";
      add.setAttribute("aria-label", "Добавить пустой кадр");
      add.addEventListener("click", () => {
        if (frames.length >= 300) {
          status.textContent = "Не больше 300 кадров.";
          return;
        }
        captureFrame();
        frames.push(emptyFrame());
        chosenFrame = frames.length - 1;
        selectionMove = null;
        restoreSnapshot(frames[chosenFrame]);
        renderFrames();
        frameList.scrollLeft = frameList.scrollWidth;
      });
      frameList.appendChild(add);
    }

    frameList.scrollLeft = previousScroll;
  }

  function renderFormats() {
    formatOptions.replaceChildren();

    for (const format of [...formats, "custom"]) {
      const custom = format === "custom";
      const button = document.createElement("button");
      button.type = "button";
      button.classList.toggle("active", chosenFormat === format);
      button.setAttribute(
        "aria-label",
        custom ? "Сторонний, произвольное число кадров" :
          `${format.count} кадров: ${format.rows} рядов по ${format.columns}`
      );

      const label = document.createElement("span");
      label.textContent = custom ? "Сторонний — +" :
        `${format.count} — ${format.rows}×${format.columns}`;
      button.appendChild(label);

      if (!custom) {
        const diagram = document.createElement("span");
        diagram.className = "animation-format-diagram";
        diagram.style.gridTemplateColumns =
          `repeat(${format.columns}, 7px)`;
        for (let i = 0; i < format.count; i++) {
          diagram.appendChild(document.createElement("span"));
        }
        button.appendChild(diagram);
      }

      button.addEventListener("click", () => {
        if (chosenFormat === format) return;
        initializeFrames();
        captureFrame();

        if (!custom && frames.length > format.count) {
          if (button.dataset.confirmTrim !== "yes") {
            button.dataset.confirmTrim = "yes";
            button.textContent =
              `Удалить кадры ${format.count + 1}–${frames.length}? Нажми ещё раз`;
            status.textContent =
              `Переход удалит кадры ${format.count + 1}–${frames.length}. Нажми эту же кнопку ещё раз.`;
            return;
          }
        }

        if (!custom) {
          frames.length = Math.min(frames.length, format.count);
          while (frames.length < format.count) frames.push(emptyFrame());
          chosenFrame = Math.min(chosenFrame, frames.length - 1);
          selectionMove = null;
          restoreSnapshot(frames[chosenFrame]);
        }

        chosenFormat = format;
        renderFormats();
        renderFrames();
        frameList.scrollLeft = 0;
      });
      formatOptions.appendChild(button);
    }
  }

  function resizeAllAnimationFrames(newSize) {
    initializeFrames();
    stopDrawing();

    // Сначала запоминаем текущий кадр с его старым размером.
    frames[chosenFrame] = takeSnapshot();

    // Готовим ВСЕ кадры до изменения редактора.
    const resizedFrames = frames.map((frame) => {
      const updated = {
        ...frame,
        size: newSize,
        selectionMask: null,
        layers: frame.layers.map((layer) => {
          const image = document.createElement("canvas");
          image.width = newSize * 3;
          image.height = newSize * 3;
          const context = image.getContext("2d");
          context.imageSmoothingEnabled = false;
          context.drawImage(
            layer.canvas, 0, 0, image.width, image.height
          );
          return { ...layer, canvas: image };
        })
      };
      return updated;
    });

    frames = resizedFrames;
    selectionMove = null;
    restoreSnapshot(frames[chosenFrame]);

    // Старая история относится к кадрам прежнего размера.
    undoHistory.length = 0;
    redoHistory.length = 0;
    updateHistoryButtons();
    renderFrames();
    status.textContent =
      `Размер всех ${frames.length} кадров: ${newSize}×${newSize}.`;
  }

  const animationSizeSelect = document.getElementById("size");
  animationSizeSelect.addEventListener("change", (event) => {
    if (!tabAnimation.classList.contains("active")) return;

    // Не запускаем обработчик main.js: он меняет только текущий кадр.
    event.stopImmediatePropagation();
    const oldSize = canvas.width;
    const newSize = Number(animationSizeSelect.value);
    if (newSize === oldSize) return;

    try {
      resizeAllAnimationFrames(newSize);
    } catch (error) {
      animationSizeSelect.value = String(oldSize);
      status.textContent =
        `Не удалось изменить размер кадров: ${error.message}`;
    }
  }, true);
  frameList.addEventListener("wheel", (event) => {
    if (frameList.scrollWidth <= frameList.clientWidth) return;
    event.preventDefault();
    frameList.scrollLeft += event.deltaY || event.deltaX;
  }, { passive: false });

  function syncPanels() {
    const active = tabAnimation.classList.contains("active");
    document.body.classList.toggle("animation-workspace", active);
    for (const panel of panels) panel.hidden = !active;
    if (active) {
      initializeFrames();
      renderFrames();
    }
  }

  // Запоминаем текущий кадр ДО того, как animation-boundary.js
  // восстановит рисунок Art при выходе из Анимации.
  for (const id of ["tab-art", "tab-gallery", "tab-settings"]) {
    document.getElementById(id).addEventListener("click", () => {
      captureFrame();
    }, true);
  }

  for (const id of [
    "tab-art", "tab-animation", "tab-gallery", "tab-settings"
  ]) {
    document.getElementById(id).addEventListener("click", syncPanels);
  }

  // Управление просмотром кадров. Рисунки кадров здесь не изменяются.
  const playback = document.createElement("div");
  playback.id = "animation-playback-controls";
  playback.style.cssText =
    "display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:6px 0";

  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.textContent = "▶ Плей";

  const fpsLabel = document.createElement("label");
  fpsLabel.textContent = "FPS: ";
  const fpsInput = document.createElement("input");
  fpsInput.type = "number";
  fpsInput.min = "1";
  fpsInput.max = "60";
  fpsInput.step = "1";
  fpsInput.value = "8";
  fpsInput.style.width = "65px";
  fpsLabel.appendChild(fpsInput);

  playback.append(playButton, fpsLabel);
  framesPanel.insertBefore(playback, frameList);

  let playbackTimer = null;
  let fps = 8;

  function pausePlayback() {
    if (playbackTimer !== null) clearInterval(playbackTimer);
    playbackTimer = null;
    playButton.textContent = "▶ Плей";
  }

  function startPlayback() {
    if (!tabAnimation.classList.contains("active")) return;
    initializeFrames();
    if (!frames || frames.length < 2) return;

    pausePlayback();
    playbackTimer = setInterval(() => {
      if (!tabAnimation.classList.contains("active")) {
        pausePlayback();
        return;
      }
      openFrame((chosenFrame + 1) % frames.length);
    }, 1000 / fps);
    playButton.textContent = "⏸ Пауза";
  }

  playButton.addEventListener("click", () => {
    if (playbackTimer === null) startPlayback();
    else pausePlayback();
  });

  fpsInput.addEventListener("change", () => {
    const value = Number(fpsInput.value);
    fps = Number.isFinite(value)
      ? Math.max(1, Math.min(60, Math.round(value)))
      : 8;
    fpsInput.value = String(fps);
    if (playbackTimer !== null) startPlayback();
  });

  // Ручной выбор кадра, смена формата или рисование останавливают просмотр.
  frameList.addEventListener("click", pausePlayback, true);
  formatOptions.addEventListener("click", pausePlayback, true);
  canvas.addEventListener("pointerdown", pausePlayback, true);
  document.addEventListener("click", (event) => {
    if (event.target.closest("#tab-art, #tab-gallery, #tab-settings")) {
      pausePlayback();
    }
  }, true);

  // Будущий экспорт и сохранение смогут брать одно и то же значение FPS.
  window.animationPlayback = {
    get fps() { return fps; },
    pause: pausePlayback
  };
  // Это отдельный файл анимации, не проект вкладки Art.
  let animationId = newId();
  let animationName = "Анимация 1";

  const animationSaveButton = document.createElement("button");
  animationSaveButton.type = "button";
  animationSaveButton.textContent = "Сохранить изм. аним.";
  animationSaveButton.hidden = true;
  const filesChoices = document.getElementById("files-menu-choices");
  if (filesChoices) filesChoices.appendChild(animationSaveButton);

  function syncAnimationSaveButton() {
    animationSaveButton.hidden =
      !tabAnimation.classList.contains("active");
  }

  for (const id of [
    "tab-art", "tab-animation", "tab-gallery", "tab-settings"
  ]) {
    document.getElementById(id).addEventListener(
      "click", syncAnimationSaveButton
    );
  }

  async function saveAnimationFrames() {
    if (!tabAnimation.classList.contains("active")) return;
    if (!window.animationPlayback ||
        !Number.isFinite(window.animationPlayback.fps)) {
      throw new Error("Управление FPS не найдено. Анимация не сохранена.");
    }

    initializeFrames();
    captureFrame();
    const size = canvas.width;
    const storedFrames = frames.map((frame, index) => {
      if (frame.size !== size ||
          !Array.isArray(frame.layers) ||
          frame.layers.length < 1) {
        throw new Error(`Кадр ${index + 1} имеет другой размер.`);
      }
      return {
        layers: frame.layers.map((layer) => ({
          name: layer.name,
          visible: layer.visible,
          opacity: layer.opacity,
          data: layer.canvas.toDataURL("image/png")
        }))
      };
    });

    const animation = {
      id: animationId,
      name: animationName,
      size,
      format: chosenFormat === "custom"
        ? "custom" : chosenFormat.count,
      fps: window.animationPlayback.fps,
      frames: storedFrames
    };
    await astra.callBackend("save_animation", { animation });
    status.textContent =
      `Анимация сохранена: ${storedFrames.length} кадров, ` +
      `${animation.fps} FPS.`;
  }

  animationSaveButton.addEventListener("click", async () => {
    animationSaveButton.disabled = true;
    try {
      await saveAnimationFrames();
    } catch (error) {
      status.textContent =
        `Не удалось сохранить анимацию: ${error.message}`;
    } finally {
      animationSaveButton.disabled = false;
    }
  });
  async function loadSavedAnimation(saved) {
    if (!tabAnimation.classList.contains("active")) {
      throw new Error("Сначала открой вкладку «Анимация».");
    }
    const validSizes = [8, 16, 32, 64, 128, 256, 512];
    const format = saved?.format === "custom"
      ? "custom"
      : formats.find((item) => item.count === saved?.format);
    if (!saved || typeof saved.id !== "string" ||
        !/^[0-9a-f]{32}$/.test(saved.id) ||
        !validSizes.includes(saved.size) ||
        !format || !Array.isArray(saved.frames) ||
        saved.frames.length < 1 || saved.frames.length > 300 ||
        (format !== "custom" && saved.frames.length !== format.count)) {
      throw new Error("Файл анимации повреждён.");
    }

    // Сначала читаем все слои. При ошибке нынешняя работа останется на экране.
    const restored = [];
    for (const [frameIndex, frame] of saved.frames.entries()) {
      if (!Array.isArray(frame.layers) ||
          frame.layers.length < 1 || frame.layers.length > 20) {
        throw new Error(`Повреждён кадр ${frameIndex + 1}.`);
      }
      const frameLayers = [];
      for (const layer of frame.layers) {
        const source = await decodeLayer(layer.data);
        const size = saved.size;
        if (!((source.width === size && source.height === size) ||
              (source.width === size * 3 && source.height === size * 3))) {
          throw new Error(`Неверный размер слоя кадра ${frameIndex + 1}.`);
        }
        const image = document.createElement("canvas");
        image.width = size * 3;
        image.height = size * 3;
        image.getContext("2d").drawImage(
          source,
          source.width === size ? size : 0,
          source.height === size ? size : 0
        );
        frameLayers.push({
          name: String(layer.name || "Слой").slice(0, 80),
          canvas: image,
          visible: layer.visible !== false,
          opacity: Math.max(0, Math.min(100, Number(layer.opacity) || 0))
        });
      }
      restored.push({
        size: saved.size,
        selectedIndex: 0,
        nextLayerNumber: frameLayers.length + 1,
        usedColors: [],
        selectionMask: null,
        layers: frameLayers
      });
    }

    pausePlayback();
    animationId = saved.id;
    animationName = String(saved.name || "Анимация").slice(0, 80);
    chosenFormat = format;
    chosenFrame = 0;
    frames = restored;
    const loadedFps = Number(saved.fps);
    fps = Number.isFinite(loadedFps)
      ? Math.max(1, Math.min(60, Math.round(loadedFps))) : 8;
    fpsInput.value = String(fps);
    selectionMove = null;
    restoreSnapshot(frames[0]);
    undoHistory.length = 0;
    redoHistory.length = 0;
    updateHistoryButtons();
    renderFormats();
    renderFrames();
    status.textContent =
      `Открыта анимация «${animationName}»: ${frames.length} кадров, ${fps} FPS.`;
  }

  window.animationEditor = { loadSavedAnimation };
  const spriteExportButton = document.createElement("button");
  spriteExportButton.type = "button";
  spriteExportButton.textContent = "Экспорт PNG для Astra";
  spriteExportButton.hidden = true;
  if (!filesChoices) {
    throw new Error("Меню «Файлы» не найдено.");
  }
  filesChoices.appendChild(spriteExportButton);

  function syncSpriteExportButton() {
    spriteExportButton.hidden =
      !tabAnimation.classList.contains("active");
  }
  new MutationObserver(syncSpriteExportButton).observe(tabAnimation, {
    attributes: true,
    attributeFilter: ["class"]
  });
  syncSpriteExportButton();

  async function exportAstraSpriteSheet() {
    if (!tabAnimation.classList.contains("active")) return;
    if (chosenFormat === "custom") {
      throw new Error(
        "Для «Стороннего» формата сетка PNG не задана."
      );
    }

    window.animationPlayback?.pause();
    initializeFrames();
    captureFrame();

    const size = canvas.width;
    const count = chosenFormat.count;
    if (frames.length !== count) {
      throw new Error("Число кадров не соответствует формату.");
    }

    const sheet = document.createElement("canvas");
    sheet.width = chosenFormat.columns * size;
    sheet.height = chosenFormat.rows * size;
    const output = sheet.getContext("2d");
    output.imageSmoothingEnabled = false;

    frames.forEach((frame, index) => {
      if (frame.size !== size || !Array.isArray(frame.layers)) {
        throw new Error(`Неверный размер кадра ${index + 1}.`);
      }
      const x = (index % chosenFormat.columns) * size;
      const y = Math.floor(index / chosenFormat.columns) * size;

      // Слои хранятся сверху вниз; собираем снизу вверх.
      for (let i = frame.layers.length - 1; i >= 0; i--) {
        const layer = frame.layers[i];
        if (!layer.visible) continue;
        const image = layer.canvas;
        if (image.width !== size * 3 ||
            image.height !== size * 3) {
          throw new Error(
            `Повреждён слой в кадре ${index + 1}.`
          );
        }
        output.globalAlpha =
          Math.max(0, Math.min(100, Number(layer.opacity))) / 100;
        output.drawImage(
          image, size, size, size, size,
          x, y, size, size
        );
      }
      output.globalAlpha = 1;
    });

    const dataUrl = sheet.toDataURL("image/png");
    const prefix = "data:image/png;base64,";
    if (!dataUrl.startsWith(prefix)) {
      throw new Error("Не удалось собрать PNG.");
    }
    // Текущий Python save_png ограничивает длину base64 двумя миллионами.
    if (dataUrl.length - prefix.length > 2000000) {
      throw new Error(
        "PNG превышает лимит сохранения 2 млн символов. " +
        "Файл не записан."
      );
    }
    const result = await astra.callBackend("save_png", {
      data_url: dataUrl
    });
    status.textContent =
      `Спрайтлист ${sheet.width}×${sheet.height} сохранён: ${result.path}`;
  }

  spriteExportButton.addEventListener("click", async () => {
    spriteExportButton.disabled = true;
    status.textContent = "Собираю PNG для Astra...";
    try {
      await exportAstraSpriteSheet();
    } catch (error) {
      status.textContent =
        `Не удалось экспортировать PNG: ${error.message}`;
    } finally {
      spriteExportButton.disabled = false;
    }
  });
  const gifButton = document.createElement("button");
  gifButton.type = "button";
  gifButton.textContent = "Экспорт GIF";
  gifButton.hidden = true;
  if (!filesChoices) {
    throw new Error("Меню «Файлы» не найдено.");
  }
  filesChoices.appendChild(gifButton);

  function syncGifButton() {
    gifButton.hidden = !tabAnimation.classList.contains("active");
  }
  new MutationObserver(syncGifButton).observe(tabAnimation, {
    attributes: true,
    attributeFilter: ["class"]
  });
  syncGifButton();

  async function exportTransparentGif() {
    if (!tabAnimation.classList.contains("active")) return;
    pausePlayback();
    initializeFrames();
    captureFrame();

    const size = canvas.width;
    const pngFrames = frames.map((frame, index) => {
      if (frame.size !== size || !Array.isArray(frame.layers) ||
          frame.layers.length < 1) {
        throw new Error(`Неверный размер кадра ${index + 1}.`);
      }

      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = size;
      outputCanvas.height = size;
      const output = outputCanvas.getContext("2d");
      output.imageSmoothingEnabled = false;

      for (let i = frame.layers.length - 1; i >= 0; i--) {
        const layer = frame.layers[i];
        if (!layer.visible) continue;
        const image = layer.canvas;
        if (image.width !== size * 3 || image.height !== size * 3) {
          throw new Error(`Повреждён слой кадра ${index + 1}.`);
        }
        output.globalAlpha =
          Math.max(0, Math.min(100, Number(layer.opacity))) / 100;
        output.drawImage(
          image, size, size, size, size, 0, 0, size, size
        );
      }
      output.globalAlpha = 1;
      return outputCanvas.toDataURL("image/png");
    });

    const result = await astra.callBackend("export_gif", {
      frames: pngFrames,
      fps
    });
    status.textContent =
      `GIF сохранён: ${result.path} (${result.frames} кадров, ${fps} FPS).`;
  }

  gifButton.addEventListener("click", async () => {
    gifButton.disabled = true;
    status.textContent = "Собираю прозрачный GIF...";
    try {
      await exportTransparentGif();
    } catch (error) {
      status.textContent = `Не удалось экспортировать GIF: ${error.message}`;
    } finally {
      gifButton.disabled = false;
    }
  });
  const mp4Button = document.createElement("button");
  mp4Button.type = "button";
  mp4Button.textContent = "Экспорт MP4";
  mp4Button.hidden = true;
  filesChoices.appendChild(mp4Button);

  function syncMp4Button() {
    mp4Button.hidden = !tabAnimation.classList.contains("active");
  }
  new MutationObserver(syncMp4Button).observe(tabAnimation, {
    attributes: true,
    attributeFilter: ["class"]
  });
  syncMp4Button();

  async function exportAnimationMp4() {
    if (!tabAnimation.classList.contains("active")) return;
    pausePlayback();
    initializeFrames();
    captureFrame();

    const size = canvas.width;
    const pngFrames = frames.map((frame, index) => {
      if (frame.size !== size || !Array.isArray(frame.layers) ||
          frame.layers.length < 1) {
        throw new Error(`Неверный размер кадра ${index + 1}.`);
      }

      const imageCanvas = document.createElement("canvas");
      imageCanvas.width = size;
      imageCanvas.height = size;
      const imageContext = imageCanvas.getContext("2d");
      imageContext.imageSmoothingEnabled = false;

      for (let i = frame.layers.length - 1; i >= 0; i--) {
        const layer = frame.layers[i];
        if (!layer.visible) continue;
        const image = layer.canvas;
        if (image.width !== size * 3 || image.height !== size * 3) {
          throw new Error(`Повреждён слой кадра ${index + 1}.`);
        }
        imageContext.globalAlpha =
          Math.max(0, Math.min(100, Number(layer.opacity))) / 100;
        imageContext.drawImage(
          image, size, size, size, size, 0, 0, size, size
        );
      }
      imageContext.globalAlpha = 1;
      return imageCanvas.toDataURL("image/png");
    });

    const result = await astra.callBackend("export_mp4", {
      frames: pngFrames,
      fps
    });
    status.textContent =
      `MP4 сохранён: ${result.path} (${result.frames} кадров, ${fps} FPS).`;
  }

  mp4Button.addEventListener("click", async () => {
    mp4Button.disabled = true;
    status.textContent = "Собираю MP4...";
    try {
      await exportAnimationMp4();
    } catch (error) {
      status.textContent = `Не удалось экспортировать MP4: ${error.message}`;
    } finally {
      mp4Button.disabled = false;
    }
  });
  const webmButton = document.createElement("button");
  webmButton.type = "button";
  webmButton.textContent = "Экспорт WebM";
  webmButton.hidden = true;
  filesChoices.appendChild(webmButton);

  function syncWebmButton() {
    webmButton.hidden = !tabAnimation.classList.contains("active");
  }
  new MutationObserver(syncWebmButton).observe(tabAnimation, {
    attributes: true,
    attributeFilter: ["class"]
  });
  syncWebmButton();

  async function exportAnimationWebm() {
    if (!tabAnimation.classList.contains("active")) return;
    pausePlayback();
    initializeFrames();
    captureFrame();

    if (fps > 30 || frames.length / fps > 3) {
      throw new Error(
        "Для стикера нужно не больше 30 FPS и не больше 3 секунд."
      );
    }

    const size = canvas.width;
    const pngFrames = frames.map((frame, index) => {
      if (frame.size !== size ||
          !Array.isArray(frame.layers) ||
          frame.layers.length < 1) {
        throw new Error(`Неверный размер кадра ${index + 1}.`);
      }

      const imageCanvas = document.createElement("canvas");
      imageCanvas.width = size;
      imageCanvas.height = size;
      const output = imageCanvas.getContext("2d");
      output.imageSmoothingEnabled = false;

      for (let i = frame.layers.length - 1; i >= 0; i--) {
        const layer = frame.layers[i];
        if (!layer.visible) continue;
        const image = layer.canvas;
        if (image.width !== size * 3 || image.height !== size * 3) {
          throw new Error(`Повреждён слой кадра ${index + 1}.`);
        }
        output.globalAlpha =
          Math.max(0, Math.min(100, Number(layer.opacity))) / 100;
        output.drawImage(
          image, size, size, size, size, 0, 0, size, size
        );
      }
      output.globalAlpha = 1;
      return imageCanvas.toDataURL("image/png");
    });

    const result = await astra.callBackend("export_webm", {
      frames: pngFrames,
      fps
    });
    status.textContent =
      `WebM сохранён: ${result.path} (${result.frames} кадров, ${fps} FPS).`;
  }

  webmButton.addEventListener("click", async () => {
    webmButton.disabled = true;
    status.textContent = "Собираю прозрачный WebM...";
    try {
      await exportAnimationWebm();
    } catch (error) {
      status.textContent = `Не удалось экспортировать WebM: ${error.message}`;
    } finally {
      webmButton.disabled = false;
    }
  });
  const newAnimationButton = document.createElement("button");
  newAnimationButton.type = "button";
  newAnimationButton.textContent = "Новая анимация";
  newAnimationButton.hidden = true;
  if (filesChoices) filesChoices.appendChild(newAnimationButton);

  function syncNewAnimationButton() {
    newAnimationButton.hidden =
      !tabAnimation.classList.contains("active");
  }
  new MutationObserver(syncNewAnimationButton).observe(tabAnimation, {
    attributes: true,
    attributeFilter: ["class"]
  });
  syncNewAnimationButton();

  function createNewAnimation() {
    pausePlayback();
    stopDrawing();

    // У нового набора свой ID: сохранение не перезапишет старую анимацию.
    animationId = newId();
    animationName = "Анимация 1";
    const count = chosenFormat === "custom" ? 1 : chosenFormat.count;
    frames = Array.from({ length: count }, () => emptyFrame());
    chosenFrame = 0;
    fps = 8;
    fpsInput.value = "8";
    selectionMove = null;

    restoreSnapshot(frames[0]);
    undoHistory.length = 0;
    redoHistory.length = 0;
    updateHistoryButtons();
    renderFormats();
    renderFrames();
    frameList.scrollLeft = 0;
    projectNameElement.textContent = "Анимация: новая";
    status.textContent =
      `Создана новая анимация: ${count} пустых кадров. ` +
      "Для записи в файл нажми «Сохранить изм. аним.»";
  }

  let newAnimationConfirmTimer = null;
  function resetNewAnimationConfirmation() {
    clearTimeout(newAnimationConfirmTimer);
    newAnimationConfirmTimer = null;
    newAnimationButton.textContent = "Новая анимация";
  }

  newAnimationButton.addEventListener("click", (event) => {
    if (!tabAnimation.classList.contains("active")) return;

    if (newAnimationConfirmTimer === null) {
      // Не закрываем меню «Файлы» после первого, предупреждающего нажатия.
      event.stopPropagation();
      newAnimationButton.textContent = "Создать? Нажми ещё раз";
      status.textContent =
        "Новая анимация заменит текущий черновик в редакторе. " +
        "Сначала сохрани его, если он нужен.";
      newAnimationConfirmTimer = setTimeout(
        resetNewAnimationConfirmation, 8000
      );
      return;
    }

    resetNewAnimationConfirmation();
    createNewAnimation();
  });
  syncAnimationSaveButton();
  renderFormats();
  syncPanels();

  style.textContent += `
    #animation-frame-list .frame-card {
      position: relative;
      flex: 0 0 74px;
      width: 74px;
    }
    #animation-frame-list .frame-card > button:first-child {
      width: 100%;
    }
    #animation-frame-list .frame-more {
      position: absolute;
      right: 3px;
      bottom: 3px;
      width: 23px;
      height: 23px;
      padding: 0;
      font-size: 13px;
    }
    #frame-actions {
      position: fixed;
      z-index: 1000;
      display: grid;
      gap: 4px;
      width: 150px;
      padding: 6px;
      border: 1px solid #aaa;
      border-radius: 5px;
      background: #30343d;
      box-shadow: 0 5px 14px #0008;
    }
    #frame-actions[hidden] { display: none; }
    #frame-actions button {
      width: 100%;
      padding: 5px;
      font-size: 12px;
      text-align: left;
    }
  `;

  let copiedFrame = null;
  let menuIndex = -1;
  let confirmAction = "";
  let confirmTimer = null;

  const frameActions = document.createElement("div");
  frameActions.id = "frame-actions";
  frameActions.hidden = true;
  document.body.appendChild(frameActions);

  function resetFrameWarning() {
    clearTimeout(confirmTimer);
    confirmTimer = null;
    confirmAction = "";
    clearButton.textContent = "Очистить";
    deleteButton.textContent = "Удалить";
  }

  function closeFrameActions() {
    resetFrameWarning();
    frameActions.hidden = true;
    menuIndex = -1;
  }

  function showFrameActions(index, anchor) {
    if (!frames || index < 0 || index >= frames.length) return;
    resetFrameWarning();
    menuIndex = index;
    pasteButton.disabled = !copiedFrame;
    deleteButton.hidden = chosenFormat !== "custom";
    deleteButton.disabled = frames.length <= 1;
    frameActions.hidden = false;

    const rect = anchor.getBoundingClientRect();
    frameActions.style.left =
      `${Math.max(4, Math.min(rect.left, innerWidth - 154))}px`;
    frameActions.style.top =
      `${Math.max(4, Math.min(rect.bottom + 4,
          innerHeight - frameActions.offsetHeight - 4))}px`;
  }

  function cloneAnimationFrame(frame) {
    return {
      ...frame,
      usedColors: [...frame.usedColors],
      selectionMask: frame.selectionMask
        ? new Uint8Array(frame.selectionMask) : null,
      layers: frame.layers.map((layer) => ({
        ...layer,
        canvas: copyCanvas(layer.canvas)
      }))
    };
  }

  function warnTwice(action, button, text) {
    if (confirmAction === action) {
      resetFrameWarning();
      return true;
    }
    resetFrameWarning();
    confirmAction = action;
    button.textContent = "Точно? Нажми ещё раз";
    status.textContent = text;
    confirmTimer = setTimeout(resetFrameWarning, 8000);
    return false;
  }

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.textContent = "Копировать";
  copyButton.addEventListener("click", () => {
    if (menuIndex < 0) return;
    pausePlayback();
    captureFrame();
    const number = menuIndex + 1;
    copiedFrame = cloneAnimationFrame(frames[menuIndex]);
    closeFrameActions();
    status.textContent = `Кадр ${number} скопирован.`;
  });

  const pasteButton = document.createElement("button");
  pasteButton.type = "button";
  pasteButton.textContent = "Вставить";
  pasteButton.addEventListener("click", () => {
    if (menuIndex < 0 || !copiedFrame) return;
    if (copiedFrame.size !== canvas.width) {
      status.textContent = "Размер скопированного кадра отличается.";
      closeFrameActions();
      return;
    }
    pausePlayback();
    captureFrame();
    const target = menuIndex;
    frames[target] = cloneAnimationFrame(copiedFrame);
    selectionMove = null;
    if (target === chosenFrame) {
      restoreSnapshot(frames[target]);
      undoHistory.length = 0;
      redoHistory.length = 0;
      updateHistoryButtons();
    }
    renderFrames();
    closeFrameActions();
    status.textContent = `Копия вставлена в кадр ${target + 1}.`;
  });

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.textContent = "Очистить";
  clearButton.addEventListener("click", () => {
    if (menuIndex < 0) return;
    const target = menuIndex;
    if (!warnTwice("clear", clearButton,
        `Кадр ${target + 1} станет пустым. Нажми ещё раз.`)) return;
    pausePlayback();
    captureFrame();
    frames[target] = emptyFrame();
    selectionMove = null;
    if (target === chosenFrame) {
      restoreSnapshot(frames[target]);
      undoHistory.length = 0;
      redoHistory.length = 0;
      updateHistoryButtons();
    }
    renderFrames();
    closeFrameActions();
    status.textContent = `Кадр ${target + 1} очищен.`;
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = "Удалить";
  deleteButton.addEventListener("click", () => {
    if (menuIndex < 0 || chosenFormat !== "custom" ||
        frames.length <= 1) return;
    const target = menuIndex;
    if (!warnTwice("delete", deleteButton,
        `Кадр ${target + 1} будет удалён. Нажми ещё раз.`)) return;
    pausePlayback();
    captureFrame();
    frames.splice(target, 1);
    if (target < chosenFrame) chosenFrame--;
    else if (target === chosenFrame) {
      chosenFrame = Math.min(target, frames.length - 1);
    }
    selectionMove = null;
    restoreSnapshot(frames[chosenFrame]);
    undoHistory.length = 0;
    redoHistory.length = 0;
    updateHistoryButtons();
    renderFrames();
    closeFrameActions();
    status.textContent = `Кадр ${target + 1} удалён.`;
  });

  frameActions.append(
    copyButton, pasteButton, clearButton, deleteButton
  );

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#frame-actions, .frame-more")) {
      closeFrameActions();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeFrameActions();
  });
})();