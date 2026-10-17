"use strict";

(() => {
  const viewport = document.getElementById("viewport");
  const canvasWrap = document.getElementById("canvas-wrap");
  const zoomInput = document.getElementById("zoom");

  if (!viewport || !canvasWrap || !zoomInput) return;

  let updating = false;

  function fitCanvas() {
    if (updating) return;

    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;

    // Когда открыт другой раздел меню, редактор скрыт.
    // Подгоним холст после возвращения в Art.
    if (viewportWidth < 40 || viewportHeight < 40) return;

    const baseSize = Math.max(
      32,
      Math.min(viewportWidth - 32, viewportHeight - 32)
    );

    const zoom = Number(zoomInput.value) / 100;
    const desiredWidth = baseSize * zoom;
    const currentWidth = parseFloat(canvasWrap.style.width);

    if (Math.abs(currentWidth - desiredWidth) < 0.5) return;

    updating = true;
    canvasWrap.style.width = `${desiredWidth}px`;
    updating = false;
  }

  // main.js продолжает управлять колесом, ползунком и перемещением.
  // Здесь меняется только видимый размер холста.
  new MutationObserver(fitCanvas).observe(canvasWrap, {
    attributes: true,
    attributeFilter: ["style"]
  });

  if (window.ResizeObserver) {
    new ResizeObserver(fitCanvas).observe(viewport);
  }

  zoomInput.addEventListener("input", () => {
    requestAnimationFrame(fitCanvas);
  });

  window.addEventListener("resize", fitCanvas);
  document.getElementById("tab-art").addEventListener(
    "click",
    () => requestAnimationFrame(fitCanvas)
  );

  requestAnimationFrame(fitCanvas);
})();