"use strict";
(() => {
  const artTiles = document.getElementById("gallery-tiles");
  const animationTiles = document.getElementById("animation-gallery-tiles");
  if (!artTiles || !animationTiles) return;

  const style = document.createElement("style");
  style.textContent = `
    .rename-tile {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .rename-tile > .project-tile { width: 100%; flex: 1; }
    .rename-controls { display: flex; gap: 5px; }
    .rename-controls input { min-width: 0; width: 100%; }
    .rename-error { font-size: 12px; overflow-wrap: anywhere; }
  `;
  document.head.appendChild(style);

  function addControls(container, kind, id, readName, showName) {
    const controls = document.createElement("div");
    controls.className = "rename-controls";

    const rename = document.createElement("button");
    rename.type = "button";
    rename.textContent = "Переименовать";

    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 80;
    input.hidden = true;

    const save = document.createElement("button");
    save.type = "button";
    save.textContent = "Готово";
    save.hidden = true;

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "×";
    cancel.title = "Отмена";
    cancel.hidden = true;

    const error = document.createElement("div");
    error.className = "rename-error";
    error.setAttribute("aria-live", "polite");

    function edit(open) {
      rename.hidden = open;
      input.hidden = !open;
      save.hidden = !open;
      cancel.hidden = !open;
      if (open) {
        input.value = readName();
        input.focus();
        input.select();
      } else {
        error.textContent = "";
      }
    }

    rename.addEventListener("click", () => edit(true));
    cancel.addEventListener("click", () => edit(false));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") save.click();
      if (event.key === "Escape") edit(false);
    });

    save.addEventListener("click", async () => {
      const name = input.value.trim();
      if (!name || name.length > 80) {
        error.textContent = "Название: от 1 до 80 символов.";
        return;
      }

      save.disabled = true;
      try {
        // Дожидаемся уже начатого сохранения Art, чтобы оно
        // не записало старое имя поверх нового.
        if (kind === "project") await saveQueue;

        await astra.callBackend("rename_saved_item", {
          kind, id, name
        });

        showName(name);
        if (kind === "project" && projectId === id) {
          projectName = name;
          projectNameElement.textContent = `Открыт: ${name}`;
        }
        edit(false);
      } catch (cause) {
        error.textContent =
          `Не удалось переименовать: ${cause.message}`;
      } finally {
        save.disabled = false;
      }
    });

    controls.append(rename, input, save, cancel);
    container.append(controls, error);
  }

  function decorateArt() {
    for (const tile of [...artTiles.querySelectorAll(
      ":scope > .project-tile"
    )]) {
      const id = tile.dataset.projectId;
      const title = tile.querySelector(".tile-name");
      if (!id || !title) continue;

      // Кнопка открытия остаётся отдельной от кнопки переименования.
      const wrapper = document.createElement("div");
      wrapper.className = "rename-tile";
      tile.replaceWith(wrapper);
      wrapper.appendChild(tile);

      addControls(
        wrapper, "project", id,
        () => title.textContent,
        (name) => {
          title.textContent = name;
          tile.title = `Открыть ${name}`;
        }
      );
    }
  }

  function decorateAnimations() {
    for (const tile of animationTiles.querySelectorAll(
      ":scope > .animation-gallery-tile"
    )) {
      if (tile.dataset.renameReady) continue;
      const id = tile.dataset.animationId;
      const title = tile.querySelector("strong");
      if (!id || !title) continue;

      tile.dataset.renameReady = "yes";
      addControls(
        tile, "animation", id,
        () => title.textContent,
        (name) => {
          title.textContent = name;
          title.title = name;
        }
      );
    }
  }

  new MutationObserver(decorateArt).observe(artTiles, {
    childList: true
  });
  new MutationObserver(decorateAnimations).observe(animationTiles, {
    childList: true
  });

  // Если открытый Art был переименован из галереи во время работы
  // с анимацией, обновим подпись после возвращения к Art.
  document.getElementById("tab-art").addEventListener("click", () => {
    queueMicrotask(() => {
      if (document.getElementById("tab-art").classList.contains("active")) {
        projectNameElement.textContent = `Открыт: ${projectName}`;
      }
    });
  });

  decorateArt();
  decorateAnimations();
})();