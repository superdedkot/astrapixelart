"use strict";
(() => {
  const panel = document.querySelector(".layers-panel");
  const add = document.getElementById("add-layer");
  const remove = document.getElementById("delete-layer");
  const up = document.getElementById("move-up");
  const down = document.getElementById("move-down");
  if (!panel || !add || !remove || !up || !down) return;

  const buttons = [...panel.querySelectorAll("button")];
  const named = (text) =>
    buttons.find((button) => button.textContent.trim() === text);

  const mirrorLayer = named("↔ Отзеркалить слой");
  const mirrorProject = named("↔ Отзеркалить проект");
  const copySelection = named("Выделение → новый слой");
  const copyLayer = named("Копировать слой");

  // Если состав кнопок изменился, ничего не переставляем.
  if (!mirrorLayer || !mirrorProject || !copySelection || !copyLayer) return;

  const firstRow = add.closest(".row");
  const moveRow = up.closest(".row");
  if (!firstRow || !moveRow || firstRow === moveRow) return;

  const style = document.createElement("style");
  style.textContent = `
    #project-name, #gallery { display: none !important; }
    #layer-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin: 12px 0;
    }
    #layer-actions button {
      width: 100%;
      min-width: 0;
      padding: 8px 5px;
      white-space: nowrap;
    }
    #layer-actions .wide { grid-column: 1 / -1; }
    #layer-actions .right { grid-column: 2; }
  `;
  document.head.appendChild(style);

  const grid = document.createElement("div");
  grid.id = "layer-actions";
  firstRow.before(grid);

  mirrorLayer.textContent = "↔ слой";
  mirrorLayer.title = "Отзеркалить выбранный слой";
  mirrorProject.textContent = "↔ проект";
  mirrorProject.title = "Отзеркалить весь проект";
  copyLayer.textContent = "Копировать";
  copyLayer.title = "Копировать выбранный слой";
  copySelection.classList.add("wide");
  copyLayer.classList.add("right");

  grid.append(
    add, remove,
    mirrorLayer, mirrorProject,
    copySelection, copyLayer,
    up, down
  );
  firstRow.remove();
  moveRow.remove();
})();