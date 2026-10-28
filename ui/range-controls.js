"use strict";
(() => {
  function updateRange(input) {
    const min = input.min === "" ? 0 : Number(input.min);
    const max = input.max === "" ? 100 : Number(input.max);
    const value = Number(input.value);
    const percent = max > min ? Math.max(0, Math.min(100, (value - min) / (max - min) * 100)) : 0;
    const progress = `${Number.isFinite(percent) ? percent : 0}%`;
    if (input.style.getPropertyValue("--range-progress") !== progress) {
      input.style.setProperty("--range-progress", progress);
    }
  }
  function refresh() {
    for (const input of document.querySelectorAll('input[type="range"]')) updateRange(input);
  }
  document.addEventListener("input", event => {
    if (event.target.matches('input[type="range"]')) updateRange(event.target);
  });
  document.addEventListener("change", refresh);
  // Layer selection and canvas fitting also set .value without firing input.
  // Include dynamically created animation controls and programmatic updates.
  window.setInterval(refresh, 200);
  refresh();
})();