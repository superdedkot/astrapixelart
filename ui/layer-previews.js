"use strict";
(() => {
  const list = document.getElementById("layers");
  if (!list || typeof renderLayers !== "function" ||
      typeof redraw !== "function") return;

  let timer = null;

  function updatePreviews() {
    const rows = list.querySelectorAll(".layer-row");
    if (rows.length !== layers.length) return;

    rows.forEach((row, index) => {
      const layer = layers[index];
      const visibility = row.querySelector("button");
      const name = row.querySelector(".layer-name");
      if (!layer || !visibility || !name) return;

      visibility.textContent = layer.visible ? "◉" : "○";
      visibility.title = layer.visible ? "Скрыть слой" : "Показать слой";
      visibility.setAttribute("aria-label", visibility.title);
      visibility.classList.add("layer-eye");

      let thumbnail = row.querySelector(".layer-thumbnail");
      if (!thumbnail) {
        thumbnail = document.createElement("canvas");
        thumbnail.width = 32;
        thumbnail.height = 32;
        thumbnail.className = "layer-thumbnail";
        thumbnail.setAttribute("aria-hidden", "true");
        row.insertBefore(thumbnail, name);
      }

      const preview = thumbnail.getContext("2d");
      preview.clearRect(0, 0, 32, 32);
      preview.imageSmoothingEnabled = false;

      const image = layer.canvas;
      const size = canvas.width;
      if (image.width === size * 3 && image.height === size * 3) {
        preview.drawImage(image, size, size, size, size, 0, 0, 32, 32);
      } else {
        preview.drawImage(image, 0, 0, image.width, image.height,
                          0, 0, 32, 32);
      }
      thumbnail.style.opacity = layer.visible ? "1" : "0.4";
    });
  }

  const style = document.createElement("style");
  style.textContent = `
    #layers .layer-eye {
      flex: 0 0 32px;
      width: 32px;
      padding: 4px 0;
      font-size: 18px;
      line-height: 24px;
    }
    #layers .layer-thumbnail {
      flex: 0 0 32px;
      width: 32px;
      height: 32px;
      border: 1px solid #888;
      background-color: white;
      background-image: repeating-conic-gradient(
        #ddd 0% 25%, white 0% 50%
      );
      background-size: 8px 8px;
      image-rendering: pixelated;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);

  const originalRenderLayers = renderLayers;
  renderLayers = function (...args) {
    const result = originalRenderLayers(...args);
    updatePreviews();
    return result;
  };

  const originalRedraw = redraw;
  redraw = function (...args) {
    const result = originalRedraw(...args);
    clearTimeout(timer);
    timer = setTimeout(updatePreviews, 150);
    return result;
  };

  updatePreviews();
})();