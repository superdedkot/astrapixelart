"use strict";
(() => {
  const tab = document.getElementById("tab-animation");
  const actions = document.getElementById("layer-actions");
  const copyButton = [...document.querySelectorAll(".layers-panel button")]
    .find((button) => button.title === "Копировать выбранный слой");

  if (!tab || !actions || !copyButton) return;

  const pasteButton = document.createElement("button");
  pasteButton.type = "button";
  pasteButton.textContent = "Вставить";
  pasteButton.title = "Вставить скопированный слой в текущий кадр";
  pasteButton.style.gridColumn = "1";
  actions.insertBefore(pasteButton, copyButton);

  let clipboard = null;

  function inAnimation() {
    return tab.classList.contains("active");
  }

  function refresh() {
    pasteButton.hidden = !inAnimation();
    pasteButton.disabled = !clipboard;
  }

  // Только в Анимации перехватываем прежнее мгновенное копирование.
  // В Art исходный обработчик кнопки остаётся прежним.
  copyButton.addEventListener("click", (event) => {
    if (!inAnimation()) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    stopDrawing();
    clipboard = {
      name: selectedLayer.name,
      canvas: copyCanvas(selectedLayer.canvas),
      visible: selectedLayer.visible,
      opacity: selectedLayer.opacity
    };
    refresh();
    status.textContent = `Слой «${clipboard.name}» скопирован. Выбери кадр и нажми «Вставить».`;
  }, true);

  pasteButton.addEventListener("click", () => {
    if (!inAnimation() || !clipboard) return;
    if (layers.length >= 20) {
      status.textContent = "Можно создать не больше 20 слоёв.";
      return;
    }
    if (clipboard.canvas.width !== canvas.width * 3 ||
        clipboard.canvas.height !== canvas.height * 3) {
      status.textContent =
        "Размер скопированного слоя отличается от размера текущего кадра.";
      return;
    }

    stopDrawing();
    rememberAction();
    const layer = makeLayer(`${clipboard.name} (копия)`);
    layer.canvas = copyCanvas(clipboard.canvas);
    layer.visible = clipboard.visible;
    layer.opacity = clipboard.opacity;
    layers.splice(selectedIndex(), 0, layer);
    selectedLayer = layer;
    selectionMove = null;
    redraw();
    renderLayers();
    scheduleSave();
    status.textContent = "Слой вставлен в текущий кадр.";
  });

  new MutationObserver(refresh).observe(tab, {
    attributes: true,
    attributeFilter: ["class"]
  });
  refresh();
})();