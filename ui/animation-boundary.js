"use strict";
(() => {
  const tabs = ["art", "animation", "gallery", "settings", "astra2d"]
    .map((name) => document.getElementById(`tab-${name}`));
  const newProject = document.getElementById("new-project");
  const saveProject = document.getElementById("save-project");
  if (tabs.some((tab) => !tab) || !newProject || !saveProject) return;

  let artState = null;
  let animationState = null;
  let switching = false;
  let internalClick = false;

  function captureEditor() {
    stopDrawing();
    return {
      snapshot: takeSnapshot(),
      undo: [...undoHistory],
      redo: [...redoHistory],
      color: selectedColor,
      activeTool: tool,
      nameLabel: projectNameElement.textContent
    };
  }

  function restoreEditor(state) {
    ready = false;
    clearTimeout(saveTimer);
    saveTimer = null;
    selectionMove = null;

    restoreSnapshot(state.snapshot);
    undoHistory.splice(0, undoHistory.length, ...state.undo);
    redoHistory.splice(0, redoHistory.length, ...state.redo);
    setSelectedColor(state.color);
    chooseTool(state.activeTool);
    updateHistoryButtons();
    projectNameElement.textContent = state.nameLabel;
  }

  function makeEmptyAnimationDraft() {
    ready = false;
    clearTimeout(saveTimer);
    saveTimer = null;
    selectionMove = null;
    selectionMask = null;
    undoHistory.length = 0;
    redoHistory.length = 0;
    layers = [];
    nextLayerNumber = 1;
    selectedLayer = makeLayer();
    layers.push(selectedLayer);
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    chooseTool("pen");
    redraw();
    renderLayers();
    updateHistoryButtons();
    projectNameElement.textContent = "Анимация: черновик";
  }

  function enterAnimation() {
    artState = captureEditor();

    // Обычное автосохранение Art не должно записывать черновик.
    ready = false;
    clearTimeout(saveTimer);
    saveTimer = null;

    if (animationState) {
      restoreEditor(animationState);
    } else {
      makeEmptyAnimationDraft();
    }

    newProject.disabled = true;
    saveProject.disabled = true;
    status.textContent =
      "Черновик остаётся при смене вкладок, но пока не сохраняется в файл.";
  }

  function leaveAnimation() {
    if (!artState) return;
    animationState = captureEditor();

    ready = false;
    clearTimeout(saveTimer);
    saveTimer = null;
    restoreEditor(artState);

    newProject.disabled = false;
    saveProject.disabled = false;
    artState = null;
    ready = true;
    status.textContent = "Редактор Art восстановлен.";
  }

  function forwardClick(tab) {
    internalClick = true;
    try {
      tab.click();
    } finally {
      internalClick = false;
    }
  }

  for (const tab of tabs) {
    tab.addEventListener("click", (event) => {
      if (internalClick) return;

      const toAnimation = tab === tabs[1];
      if ((!artState && !toAnimation) ||
          (artState && toAnimation)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      if (switching) return;

      switching = true;
      (async () => {
        try {
          if (toAnimation) {
            await saveNow();
            enterAnimation();
          } else {
            leaveAnimation();
          }
          forwardClick(tab);
        } catch (error) {
          status.textContent =
            `Не удалось переключить редактор: ${error.message}`;
        } finally {
          switching = false;
        }
      })();
    }, true);
  }
})();