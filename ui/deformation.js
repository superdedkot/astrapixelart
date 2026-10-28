"use strict";

// Work in the layer's full storage, including pixels outside the visible canvas.
function scaleLayerPixels(source, scaleX, scaleY) {
  if (![scaleX, scaleY].every(value => Number.isFinite(value) && value >= 0.01 && value <= 8)) {
    throw new Error("Масштаб должен быть от 1 до 800%.");
  }
  const { width, height, data } = source;
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!data[(y * width + x) * 4 + 3]) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) return null;
  const sourceWidth = right - left + 1, sourceHeight = bottom - top + 1;
  const targetWidth = Math.max(1, Math.round(sourceWidth * scaleX));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scaleY));
  const dx = Math.round(left + (sourceWidth - targetWidth) / 2);
  const dy = Math.round(top + (sourceHeight - targetHeight) / 2);
  const result = new Uint8ClampedArray(data.length);
  for (let y = Math.max(0, dy); y < Math.min(height, dy + targetHeight); y++) {
    const sy = top + Math.floor((y - dy) * sourceHeight / targetHeight);
    for (let x = Math.max(0, dx); x < Math.min(width, dx + targetWidth); x++) {
      const sx = left + Math.floor((x - dx) * sourceWidth / targetWidth);
      const from = (sy * width + sx) * 4, to = (y * width + x) * 4;
      result.set(data.subarray(from, from + 4), to);
    }
  }
  return { data: result, width, height,
    clipped: dx < 0 || dy < 0 || dx + targetWidth > width || dy + targetHeight > height };
}

(() => {
  const tools = document.getElementById("tools");
  const button = document.createElement("button");
  button.type = "button";
  button.id = "deformation-tool";
  button.textContent = "⤢ Деформация";
  tools.insertBefore(button, document.getElementById("clear-selection"));
  const panel = document.createElement("div");
  panel.id = "deformation-options";
  panel.hidden = true;
  panel.innerHTML = `
    <p>Масштаб активного слоя относительно центра рисунка.</p>
    <label>Ширина, % <input id="deformation-x" type="number" min="1" max="800" step="1" value="100"></label>
    <button id="deformation-link" type="button" aria-pressed="true">🔗 Оси связаны</button>
    <label>Высота, % <input id="deformation-y" type="number" min="1" max="800" step="1" value="100"></label>
    <button id="deformation-apply" type="button">Применить</button>
    <p class="hint">100% — исходный размер. Без сглаживания. Выделение не ограничивает масштабирование слоя. Пиксели за пределами запаса слоя обрезаются.</p>`;
  tools.insertAdjacentElement("afterend", panel);
  const x = panel.querySelector("#deformation-x");
  const y = panel.querySelector("#deformation-y");
  const link = panel.querySelector("#deformation-link");
  const wrap = document.getElementById("canvas-wrap");
  const frame = document.createElement("div");
  frame.id = "deformation-frame";
  frame.hidden = true;
  const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"].map(position => {
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = `deformation-handle deformation-handle-${position}`;
    handle.dataset.position = position;
    handle.setAttribute("aria-label", `Изменить размер: ${position}`);
    frame.appendChild(handle);
    return handle;
  });
  wrap.appendChild(frame);
  let linked = true;
  let drag = null;
  function updateFrame() {
    const active = tool === "deform";
    frame.hidden = !active;
    if (!active) return;
    frame.style.left = "0";
    frame.style.top = "0";
    frame.style.width = "100%";
    frame.style.height = "100%";
  }
  function refresh() {
    panel.hidden = tool !== "deform";
    button.classList.toggle("selected", tool === "deform");
    updateFrame();
  }
  button.addEventListener("click", () => {
    stopDrawing();
    chooseTool("deform");
    x.value = y.value = "100";
    refresh();
  });
  document.addEventListener("click", () => queueMicrotask(refresh));
  x.addEventListener("input", () => { if (linked) y.value = x.value; });
  y.addEventListener("input", () => { if (linked) x.value = y.value; });
  link.addEventListener("click", () => {
    linked = !linked;
    if (linked) y.value = x.value;
    link.setAttribute("aria-pressed", String(linked));
    link.textContent = linked ? "🔗 Оси связаны" : "⛓ Оси независимы";
  });
  panel.querySelector("#deformation-apply").addEventListener("click", () => {
    if (tool !== "deform") return;
    if (!selectedLayer.visible) { status.textContent = "Выбранный слой скрыт."; return; }
    const sx = Number(x.value) / 100, sy = Number(y.value) / 100;
    try {
      if (sx === 1 && sy === 1) return;
      const image = selectedLayer.canvas;
      const context = image.getContext("2d");
      const scaled = scaleLayerPixels(context.getImageData(0, 0, image.width, image.height), sx, sy);
      if (!scaled) { status.textContent = "Выбранный слой пуст."; return; }
      const result = new ImageData(scaled.data, scaled.width, scaled.height);
      stopDrawing();
      rememberAction();
      context.putImageData(result, 0, 0);
      selectionMask = null;
      selectionMove = null;
      drawSelectionOutline();
      redraw();
      renderLayers();
      scheduleSave();
      x.value = y.value = "100";
      frame.style.transform = "";
      status.textContent = scaled.clipped
        ? "Слой масштабирован. Часть рисунка вышла за пределы запаса слоя и обрезана. Можно отменить."
        : "Слой масштабирован. Можно отменить через Ctrl+Z.";
    } catch (error) { status.textContent = `Не удалось изменить размер: ${error.message}`; }
  });
  function setScaleFromDrag(position, event) {
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const startX = Math.max(1, drag.startWidth);
    const startY = Math.max(1, drag.startHeight);
    let sx = startX, sy = startY;
    if (position.includes("e")) sx = Math.max(1, (event.clientX - centerX) * 2);
    if (position.includes("w")) sx = Math.max(1, (centerX - event.clientX) * 2);
    if (position.includes("s")) sy = Math.max(1, (event.clientY - centerY) * 2);
    if (position.includes("n")) sy = Math.max(1, (centerY - event.clientY) * 2);
    if (position === "e" || position === "w") sy = startY;
    if (position === "n" || position === "s") sx = startX;
    let scaleX = sx / rect.width, scaleY = sy / rect.height;
    if (linked && position.length === 2) {
      const scale = Math.max(0.01, Math.min(8, Math.max(scaleX, scaleY)));
      scaleX = scaleY = scale;
    }
    x.value = String(Math.round(scaleX * 100));
    y.value = String(Math.round(scaleY * 100));
    frame.style.transform = `translate(-50%, -50%) scale(${scaleX}, ${scaleY})`;
  }
  handles.forEach(handle => {
    handle.addEventListener("pointerdown", event => {
      if (tool !== "deform" || !selectedLayer.visible) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = canvas.getBoundingClientRect();
      drag = { position: handle.dataset.position, startWidth: rect.width, startHeight: rect.height };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", event => {
      if (!drag) return;
      setScaleFromDrag(drag.position, event);
    });
    handle.addEventListener("pointerup", event => {
      if (!drag) return;
      setScaleFromDrag(drag.position, event);
      drag = null;
      handle.releasePointerCapture?.(event.pointerId);
      panel.querySelector("#deformation-apply").click();
    });
    handle.addEventListener("pointercancel", () => { drag = null; frame.style.transform = ""; });
  });
  // Prevent the drawing handler from painting while this tool is active.
  canvas.addEventListener("pointerdown", event => {
    if (tool !== "deform") return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
})();