"use strict";
(() => {
  const artTiles = document.getElementById("gallery-tiles");
  const animationTiles = document.getElementById("animation-gallery-tiles");
  if (!artTiles || !animationTiles) return;

  function addDeleteButton(container, controls, kind, id) {
    if (!controls || controls.querySelector(".gallery-delete-button")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-delete-button";
    button.textContent = "Удалить";

    let confirmationTimer = null;
    function reset() {
      clearTimeout(confirmationTimer);
      confirmationTimer = null;
      button.textContent = "Удалить";
    }

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (kind === "project" && projectId === id) {
        const error = container.querySelector(".rename-error");
        if (error) error.textContent =
          "Открытый Art-проект нельзя удалить. Сначала открой другой.";
        return;
      }

      if (!confirmationTimer) {
        button.textContent = "Точно удалить? Нажми ещё раз";
        confirmationTimer = setTimeout(reset, 6000);
        return;
      }

      reset();
      button.disabled = true;
      try {
        if (kind === "project") await saveQueue;
        await astra.callBackend("delete_saved_item", {kind, id});
        container.remove();
      } catch (error) {
        const message = container.querySelector(".rename-error");
        if (message) {
          message.textContent = `Не удалось удалить: ${error.message}`;
        }
        button.disabled = false;
      }
    });

    controls.appendChild(button);
  }

  function decorate() {
    for (const wrapper of artTiles.querySelectorAll(
      ":scope > .rename-tile"
    )) {
      const tile = wrapper.querySelector(".project-tile");
      if (tile?.dataset.projectId) {
        addDeleteButton(
          wrapper,
          wrapper.querySelector(".rename-controls"),
          "project",
          tile.dataset.projectId
        );
      }
    }

    for (const tile of animationTiles.querySelectorAll(
      ":scope > .animation-gallery-tile"
    )) {
      if (tile.dataset.animationId) {
        addDeleteButton(
          tile,
          tile.querySelector(".rename-controls"),
          "animation",
          tile.dataset.animationId
        );
      }
    }
  }

  new MutationObserver(decorate).observe(artTiles, {
    childList: true, subtree: true
  });
  new MutationObserver(decorate).observe(animationTiles, {
    childList: true, subtree: true
  });
  decorate();
})();