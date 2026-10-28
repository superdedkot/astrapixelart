"use strict";
(() => {
  const page = document.getElementById("gallery-page");
  const tab = document.getElementById("tab-gallery");
  if (!page || !tab) return;

  const style = document.createElement("style");
  style.textContent = `
    #animation-gallery-tiles {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(145px, 1fr));
      gap: 10px;
      margin: 12px 0 20px;
    }
    .animation-gallery-tile {
      min-width: 0;
      padding: 8px;
      border: 1px solid #667;
      border-radius: 6px;
      background: rgba(35, 39, 48, 0.70);
    }
    .animation-gallery-tile canvas {
      display: block;
      width: 100%;
      max-width: 160px;
      aspect-ratio: 1;
      margin: 0 auto 7px;
      border: 1px solid #777;
      background: repeating-conic-gradient(
        #ddd 0% 25%, white 0% 50%
      ) 0 0 / 12px 12px;
      image-rendering: pixelated;
    }
    .animation-gallery-tile strong {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .animation-gallery-tile small {
      display: block;
      margin: 5px 0;
    }
    .animation-gallery-tile button { width: 100%; }
  `;
  document.head.appendChild(style);

  const section = document.createElement("section");
  const heading = document.createElement("h2");
  heading.textContent = "Анимации";
  const message = document.createElement("p");
  message.setAttribute("aria-live", "polite");
  const tiles = document.createElement("div");
  tiles.id = "animation-gallery-tiles";
  section.append(heading, message, tiles);
  page.appendChild(section);

  let listVersion = 0;
  let playbackVersion = 0;
  let playingButton = null;

  function stopPlayback() {
    playbackVersion++;
    if (playingButton) {
      playingButton.textContent = "▶ Просмотр";
      playingButton = null;
    }
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(
        new Error("Не удалось прочитать изображение кадра.")
      );
      image.src = dataUrl;
    });
  }

  async function drawFrame(animation, index, preview, version) {
    const frame = animation.frames[index];
    if (!frame || !Array.isArray(frame.layers)) {
      throw new Error("Кадр повреждён.");
    }

    const images = await Promise.all(
      frame.layers.map((layer) => loadImage(layer.data))
    );
    if (version !== playbackVersion || page.hidden) return;

    const context = preview.getContext("2d");
    context.clearRect(0, 0, preview.width, preview.height);
    context.imageSmoothingEnabled = false;

    const size = Number(animation.size);
    for (let i = frame.layers.length - 1; i >= 0; i--) {
      const layer = frame.layers[i];
      if (layer.visible === false) continue;

      const alpha = Number(layer.opacity);
      context.globalAlpha = Number.isFinite(alpha)
        ? Math.max(0, Math.min(100, alpha)) / 100
        : 1;

      const image = images[i];
      if (image.width === size * 3 &&
          image.height === size * 3) {
        context.drawImage(
          image, size, size, size, size,
          0, 0, preview.width, preview.height
        );
      } else if (image.width === size &&
                 image.height === size) {
        context.drawImage(
          image, 0, 0, preview.width, preview.height
        );
      } else {
        context.globalAlpha = 1;
        throw new Error("Размер слоя не совпадает с размером кадра.");
      }
    }
    context.globalAlpha = 1;
  }

  async function play(item, preview, button) {
    if (playingButton === button) {
      stopPlayback();
      return;
    }

    stopPlayback();
    const version = playbackVersion;
    playingButton = button;
    button.textContent = "⏸ Пауза";
    button.disabled = true;

    try {
      const result = await astra.callBackend(
        "load_animation", { id: item.id }
      );
      if (version !== playbackVersion) return;

      const animation = result.animation;
      if (!animation || !Array.isArray(animation.frames) ||
          animation.frames.length === 0) {
        throw new Error("В файле нет кадров.");
      }

      const value = Number(animation.fps);
      const fps = Number.isFinite(value)
        ? Math.max(1, Math.min(60, value))
        : 8;
      const interval = 1000 / fps;
      let index = 0;

      button.disabled = false;
      while (version === playbackVersion &&
             !page.hidden && !document.hidden) {
        const started = performance.now();
        await drawFrame(animation, index, preview, version);
        if (version !== playbackVersion ||
            page.hidden || document.hidden) break;

        index = (index + 1) % animation.frames.length;
        await new Promise((resolve) => {
          setTimeout(resolve, Math.max(
            0, interval - (performance.now() - started)
          ));
        });
      }
    } catch (error) {
      if (version === playbackVersion) {
        message.textContent =
          `Не удалось показать «${item.name}»: ${error.message}`;
      }
    } finally {
      button.disabled = false;
      if (version === playbackVersion) stopPlayback();
    }
  }

  async function refreshAnimations() {
    stopPlayback();
    const version = ++listVersion;
    tiles.replaceChildren();
    message.textContent = "Загружаю анимации...";

    try {
      const result = await astra.callBackend(
        "list_animations", {}
      );
      if (version !== listVersion || page.hidden) return;

      const animations = Array.isArray(result.animations)
        ? result.animations : [];
      message.textContent = animations.length
        ? `${animations.length} анимаций. Нажми ▶ для просмотра.`
        : "Сохранённых анимаций пока нет.";

      for (const item of animations) {
        const tile = document.createElement("div");
        tile.className = "animation-gallery-tile";
        tile.dataset.animationId = item.id;

        const preview = document.createElement("canvas");
        preview.width = 96;
        preview.height = 96;

        const name = document.createElement("strong");
        name.textContent = item.name;
        name.title = item.name;

        const details = document.createElement("small");
        details.textContent =
          `${item.frames} кадров · ${item.size}×${item.size}`;

        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "▶ Просмотр";
        button.addEventListener("click", () => {
          play(item, preview, button);
        });

        tile.append(preview, name, details, button);
        tiles.appendChild(tile);
      }
    } catch (error) {
      if (version === listVersion) {
        message.textContent =
          `Не удалось загрузить анимации: ${error.message}`;
      }
    }
  }

  tab.addEventListener("click", refreshAnimations);
  for (const id of ["tab-art", "tab-animation", "tab-settings", "tab-astra2d"]) {
    document.getElementById(id).addEventListener(
      "click", stopPlayback
    );
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopPlayback();
  });
})();