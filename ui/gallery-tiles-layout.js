"use strict";
(() => {
  const art = document.getElementById("gallery-tiles");
  const animations = document.getElementById("animation-gallery-tiles");
  if (!art || !animations) return;

  const style = document.createElement("style");
  style.textContent = `
    #gallery-tiles > .rename-tile {
      position: relative;
      display: block;
      min-width: 0;
    }
    #gallery-tiles > .rename-tile > .project-tile {
      display: block;
      width: 100%;
      height: 100%;
    }
    #gallery-tiles .tile-name { padding-right: 28px; }

    .animation-gallery-tile {
      position: relative;
      min-width: 0;
    }
    .animation-gallery-tile strong { padding-right: 28px; }

    .gallery-more {
      position: absolute;
      right: 7px;
      bottom: 24px;
      z-index: 2;
      width: 27px !important;
      height: 27px;
      padding: 0;
      line-height: 1;
      font-size: 19px;
    }
    .animation-gallery-tile .gallery-more { bottom: 29px; }

    .rename-tile > .rename-controls,
    .animation-gallery-tile > .rename-controls {
      display: none;
      position: static;
      width: 100%;
      min-width: 0;
      margin-top: 6px;
      padding: 6px;
      border: 1px solid #aaa;
      border-radius: 5px;
      background: #30343d;
      flex-wrap: wrap;
      gap: 5px;
    }
    .rename-tile.gallery-menu-open > .rename-controls,
    .animation-gallery-tile.gallery-menu-open > .rename-controls {
      display: flex;
    }
    .rename-controls button {
      flex: 1 1 95px;
      min-width: 0;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .rename-controls input { flex: 1 1 100%; }
    .rename-tile > .rename-error,
    .animation-gallery-tile > .rename-error {
      min-height: 0;
    }

    .animation-preview-wrap {
      position: relative;
      width: 100%;
      max-width: 160px;
      margin: 0 auto 7px;
    }
    .animation-preview-wrap canvas {
      width: 100%;
      margin: 0 !important;
    }
    .animation-gallery-tile .animation-preview-play {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      padding: 0;
      border: 0;
      background: transparent;
      color: white;
      font-size: 0;
      cursor: pointer;
    }
    .animation-preview-play::after {
      content: "▶";
      display: inline-grid;
      place-items: center;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #20242acc;
      font-size: 29px;
    }
    .animation-preview-play.is-playing::after {
      content: "⏸";
      opacity: 0;
    }
    .animation-preview-wrap:hover .animation-preview-play.is-playing::after,
    .animation-preview-play.is-playing:focus-visible::after {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);

  function addMenu(container) {
    if (container.querySelector(":scope > .gallery-more")) return;
    const controls = container.querySelector(":scope > .rename-controls");
    if (!controls) return;

    const more = document.createElement("button");
    more.type = "button";
    more.className = "gallery-more";
    more.textContent = "☰";
    more.title = "Действия с работой";
    more.setAttribute("aria-label", "Действия с работой");
    more.setAttribute("aria-expanded", "false");
    more.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = container.classList.toggle("gallery-menu-open");
      more.setAttribute("aria-expanded", String(open));
    });
    container.appendChild(more);
  }

  function arrange() {
    for (const wrapper of art.querySelectorAll(
      ":scope > .rename-tile"
    )) {
      addMenu(wrapper);
    }

    for (const tile of animations.querySelectorAll(
      ":scope > .animation-gallery-tile"
    )) {
      addMenu(tile);
      if (tile.querySelector(".animation-preview-wrap")) continue;

      const canvas = tile.querySelector(":scope > canvas");
      const play = tile.querySelector(":scope > button");
      if (!canvas || !play) continue;

      const preview = document.createElement("div");
      preview.className = "animation-preview-wrap";
      tile.insertBefore(preview, canvas);
      preview.append(canvas, play);
      play.classList.add("animation-preview-play");

      // Старый обработчик по-прежнему управляет воспроизведением.
      new MutationObserver(() => {
        play.classList.toggle(
          "is-playing", play.textContent.includes("Пауза")
        );
      }).observe(play, { childList: true, characterData: true, subtree: true });
    }
  }

  new MutationObserver(arrange).observe(art, {
    childList: true, subtree: true
  });
  new MutationObserver(arrange).observe(animations, {
    childList: true, subtree: true
  });
  arrange();
})();