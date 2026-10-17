"use strict";
(() => {
  const tools = document.getElementById("tools");
  const clear = document.getElementById("clear-selection");
  const move = [...(tools?.querySelectorAll("button") || [])]
    .find((button) => button.textContent.includes("Перенос слоя"));
  const rotate = [...(tools?.querySelectorAll("button") || [])]
    .find((button) => button.textContent.includes("Поворот"));

  if (!tools || !clear || !move || !rotate) return;

  const pen = document.getElementById("pen");
  const eraser = document.getElementById("eraser");
  const eyedropper = document.getElementById("eyedropper");
  const fill = document.getElementById("fill");
  const select = document.getElementById("select-tool");
  if (![pen, eraser, eyedropper, fill, select]
      .every((button) => button?.parentElement === tools)) return;

  move.textContent = "✥ Двигать";
  move.title = "Двигать выбранный слой или выделенные пиксели";

  const oldRow = clear.closest(".row");
  tools.append(pen, eraser, eyedropper, fill, move, select, rotate, clear);
  if (oldRow && oldRow !== tools && !oldRow.children.length) oldRow.remove();

  const style = document.createElement("style");
  style.textContent = `
    #tools {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 7px;
      align-items: stretch;
    }
    #tools button {
      grid-column: span 3;
      min-width: 0;
      min-height: 38px;
      padding: 6px 3px;
      text-align: center;
      white-space: normal;
      font-size: 13px;
    }
    #tools button:nth-child(-n+3) { grid-column: span 2; }
    #tools #clear-selection { grid-column: 1 / -1; }
  `;
  document.head.appendChild(style);
})();