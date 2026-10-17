"use strict";
(() => {
  const choices = document.getElementById("files-menu-choices");
  const animationTab = document.getElementById("tab-animation");
  const png = document.getElementById("save");
  if (!choices || !animationTab || !png) return;

  const newAnimation = [...choices.querySelectorAll("button")]
    .find((button) => button.textContent === "Новая анимация");
  if (!newAnimation) return;

  let swapped = false;

  function swapButtons() {
    const firstPlace = document.createComment("PNG position");
    const secondPlace = document.createComment("animation position");
    png.replaceWith(firstPlace);
    newAnimation.replaceWith(secondPlace);
    firstPlace.replaceWith(newAnimation);
    secondPlace.replaceWith(png);
    swapped = !swapped;
  }

  function sync() {
    const inAnimation = animationTab.classList.contains("active");
    if (inAnimation !== swapped) swapButtons();
    png.textContent = inAnimation ? "Экспорт PNG" : "Сохранить PNG";
  }

  new MutationObserver(sync).observe(animationTab, {
    attributes: true,
    attributeFilter: ["class"]
  });
  sync();
})();