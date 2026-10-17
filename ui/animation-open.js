"use strict";
(() => {
  const tiles = document.getElementById("animation-gallery-tiles");
  const animationTab = document.getElementById("tab-animation");
  const message = document.getElementById("gallery-message");
  if (!tiles || !animationTab) return;

  let opening = false;

  function waitForAnimationTab() {
    return new Promise((resolve, reject) => {
      const deadline = performance.now() + 10000;

      function check() {
        if (animationTab.classList.contains("active")) {
          resolve();
        } else if (performance.now() > deadline) {
          reject(new Error("Вкладка «Анимация» не открылась."));
        } else {
          requestAnimationFrame(check);
        }
      }

      requestAnimationFrame(check);
    });
  }

  async function openAnimation(id, button) {
    if (opening) return;
    opening = true;
    button.disabled = true;

    try {
      if (!window.animationEditor?.loadSavedAnimation) {
        throw new Error("Редактор анимации не готов.");
      }

      // Сначала читаем файл. При ошибке остаёмся в галерее.
      const result = await astra.callBackend("load_animation", {id});
      if (!result?.animation) {
        throw new Error("Файл анимации не получен.");
      }

      animationTab.click();
      await waitForAnimationTab();
      await window.animationEditor.loadSavedAnimation(result.animation);
    } catch (error) {
      const text = `Не удалось открыть анимацию: ${error.message}`;
      if (animationTab.classList.contains("active")) {
        status.textContent = text;
      } else if (message) {
        message.textContent = text;
      }
    } finally {
      opening = false;
      button.disabled = false;
    }
  }

  function addButtons() {
    for (const tile of tiles.querySelectorAll(
      ":scope > .animation-gallery-tile"
    )) {
      if (tile.querySelector(".animation-open-button")) continue;
      const id = tile.dataset.animationId;
      if (!id) continue;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "animation-open-button";
      button.textContent = "Открыть в Анимации";
      button.style.cssText =
        "width:100%;margin-top:6px;font-size:12px";
      button.addEventListener("click", () => openAnimation(id, button));

      // Отдельная кнопка: не мешает ▶ на миниатюре и меню ☰.
      tile.appendChild(button);
    }
  }

  new MutationObserver(addButtons).observe(tiles, {
    childList: true
  });
  addButtons();
})();