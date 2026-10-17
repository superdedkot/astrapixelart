"use strict";
(() => {
  const panel = document.querySelector(".tools-panel");
  const newProject = document.getElementById("new-project");
  const saveProject = document.getElementById("save-project");
  const savePng = document.getElementById("save");
  if (!panel || !newProject || !saveProject || !savePng) return;

  const menu = document.createElement("div");
  menu.id = "files-menu";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.textContent = "Файлы";
  toggle.setAttribute("aria-expanded", "false");

  const choices = document.createElement("div");
  choices.id = "files-menu-choices";
  choices.hidden = true;
  choices.append(newProject, saveProject, savePng);
  menu.append(toggle, choices);
  panel.prepend(menu);

  // После переноса двух кнопок проектов их прежняя строка пуста.
  // Строку с «Отменить» и «Вернуть» оставляем на месте.
  for (const row of panel.querySelectorAll(".row")) {
    if (row.children.length === 0) row.remove();
  }

  const style = document.createElement("style");
  style.textContent = `
    #files-menu { margin-bottom: 16px; text-align: left; }
    #files-menu > button { width: 100%; font-weight: bold; }
    #files-menu-choices {
      display: grid;
      gap: 6px;
      margin-top: 6px;
    }
    #files-menu-choices[hidden] { display: none; }
    #files-menu-choices button { width: 100%; text-align: left; }
  `;
  document.head.appendChild(style);

  function setOpen(open) {
    choices.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  }

  toggle.addEventListener("click", () => setOpen(choices.hidden));
  choices.addEventListener("click", (event) => {
    if (event.target.closest("button")) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
})();