"use strict";
(() => {
  const artTiles = document.getElementById("gallery-tiles");
  const gallery = document.getElementById("gallery-page");
  if (!artTiles || !gallery) return;

  const style = document.createElement("style");
  style.textContent = `
    /* Оба меню: одинаковая ширина и кнопки друг под другом. */
    #gallery-tiles > .rename-tile > .rename-controls,
    #animation-gallery-tiles > .animation-gallery-tile > .rename-controls {
      flex-direction: column;
      gap: 5px;
      width: 100%;
      min-width: 0;
      padding: 6px;
      font-size: 12px;
    }

    #gallery-tiles .rename-controls button,
    #animation-gallery-tiles .rename-controls button {
      flex: none;
      width: 100%;
      min-height: 32px;
      padding: 5px;
      font-size: 12px;
      line-height: 1.2;
      text-align: center;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    #gallery-tiles .rename-controls input,
    #animation-gallery-tiles .rename-controls input {
      width: 100%;
      font-size: 12px;
    }

    /* Меню Art раскрывается под своей плиткой, внутри потока. */
    #gallery-tiles > .rename-tile > .rename-controls {
      position: static;
      margin-top: 6px;
    }
    #gallery-scroll {
      padding-bottom: 0;
    }

    /* Меню анимации — сразу под плиткой, той же ширины. */
    #animation-gallery-tiles > .animation-gallery-tile > .rename-controls {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      right: auto;
      margin: 0;
      box-shadow: 0 5px 14px #0008;
    }
    #animation-gallery-tiles > .animation-gallery-tile.gallery-menu-open {
      z-index: 3;
    }

    /* Ширину берём с настоящей плитки Art. */
    #animation-gallery-tiles {
      grid-template-columns: repeat(
        auto-fill, var(--gallery-art-tile-width, 260px)
      );
    }
    #animation-gallery-tiles > .animation-gallery-tile {
      width: 100%;
    }
    #animation-gallery-tiles .animation-preview-wrap {
      width: 100%;
      max-width: none;
    }
    #animation-gallery-tiles .animation-preview-wrap canvas {
      width: 100%;
      max-width: none;
    }
  `;
  /* Art tiles: do not stretch with an open menu */
  style.textContent += `
    #gallery-tiles { align-items: start; }
    #gallery-tiles > .rename-tile {
      align-self: start;
      height: fit-content;
    }
    #gallery-tiles > .rename-tile > .project-tile {
      height: auto;
    }
  `;
  document.head.appendChild(style);

  function alignTiles() {
    const artTile = artTiles.querySelector(".project-tile");
    if (artTile) {
      const width = Math.round(artTile.getBoundingClientRect().width);
      if (width > 0) {
        gallery.style.setProperty(
          "--gallery-art-tile-width", `${width}px`
        );
      }
    }

    // Значок ☰ у Art оставляем на высоте названия, а не внизу карточки.
    for (const wrapper of artTiles.querySelectorAll(
      ":scope > .rename-tile"
    )) {
      const title = wrapper.querySelector(".tile-name");
      const more = wrapper.querySelector(":scope > .gallery-more");
      if (!title || !more) continue;

      const wrapperRect = wrapper.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      more.style.top = `${titleRect.top - wrapperRect.top - 3}px`;
      more.style.bottom = "auto";
    }
  }

  new MutationObserver(() => requestAnimationFrame(alignTiles))
    .observe(artTiles, { childList: true, subtree: true });
  window.addEventListener("resize", alignTiles);
  function alignAnimationMenus() {
    const tiles = document.getElementById("animation-gallery-tiles");
    if (!tiles) return;
    for (const tile of tiles.querySelectorAll(".animation-gallery-tile")) {
      const title = tile.querySelector("strong");
      const more = tile.querySelector(".gallery-more");
      if (!title || !more) continue;
      const tileRect = tile.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      more.style.top = `${titleRect.top - tileRect.top - 3}px`;
      more.style.bottom = "auto";
    }
  }

  const animationTiles = document.getElementById("animation-gallery-tiles");
  if (animationTiles) {
    new MutationObserver(() => requestAnimationFrame(alignAnimationMenus))
      .observe(animationTiles, { childList: true, subtree: true });
  }
  window.addEventListener("resize", alignAnimationMenus);
  requestAnimationFrame(alignAnimationMenus);
  function pinAnimationMenuToTitle() {
    const tiles = document.getElementById("animation-gallery-tiles");
    if (!tiles) return;
    for (const tile of tiles.querySelectorAll(".animation-gallery-tile")) {
      const title = tile.querySelector("strong");
      const button = tile.querySelector(".gallery-more");
      if (!title || !button) continue;

      const tileBox = tile.getBoundingClientRect();
      const titleBox = title.getBoundingClientRect();
      button.style.setProperty(
        "top", `${titleBox.top - tileBox.top - 2}px`, "important"
      );
      button.style.setProperty("bottom", "auto", "important");
    }
  }

  const menuTiles = document.getElementById("animation-gallery-tiles");
  if (menuTiles) {
    new MutationObserver(() => {
      requestAnimationFrame(pinAnimationMenuToTitle);
    }).observe(menuTiles, { childList: true, subtree: true });
  }
  window.addEventListener("resize", pinAnimationMenuToTitle);
  requestAnimationFrame(pinAnimationMenuToTitle);
  requestAnimationFrame(alignTiles);
})();