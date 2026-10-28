"use strict";

(() => {
  const pages = {
    art: document.getElementById("art-page"),
    animation: document.getElementById("animation-page"),
    gallery: document.getElementById("gallery-page"),
    astra2d: document.getElementById("astra2d-page"),
    settings: document.getElementById("settings-page")
  };

  const tabs = {
    art: document.getElementById("tab-art"),
    animation: document.getElementById("tab-animation"),
    gallery: document.getElementById("tab-gallery"),
    astra2d: document.getElementById("tab-astra2d"),
    settings: document.getElementById("tab-settings")
  };

  const tiles = document.getElementById("gallery-tiles");
  const message = document.getElementById("gallery-message");
  const previous = document.getElementById("gallery-prev");
  const next = document.getElementById("gallery-next");
  const pageNumber = document.getElementById("gallery-page-number");

  const PAGE_SIZE = 81;
  let projects = [];
  let currentPage = 0;
  let renderVersion = 0;
  let currentSection = "art";

  function showSection(name) {
    currentSection = name;

    for (const [section, element] of Object.entries(pages)) {
      element.hidden = section !== (name === "animation" ? "art" : name);
      tabs[section].classList.toggle("active", section === name);
      tabs[section].setAttribute(
        "aria-current",
        section === name ? "page" : "false"
      );
    }

    if (name !== "gallery") {
      renderVersion++;
    }

    if (name === "art" || name === "animation") {
      window.dispatchEvent(new Event("resize"));
    }
  }

  function decodeImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Миниатюра повреждена."));
      image.src = dataUrl;
    });
  }

  async function drawThumbnail(id, preview, version) {
    const result = await astra.callBackend("load_project", { id });
    const project = result.project;

    if (!project || !Array.isArray(project.layers)) {
      throw new Error("Проект повреждён.");
    }

    const images = await Promise.all(
      project.layers.map((layer) => decodeImage(layer.data))
    );

    if (version !== renderVersion || currentSection !== "gallery") {
      return;
    }

    const context = preview.getContext("2d");
    context.clearRect(0, 0, preview.width, preview.height);
    context.imageSmoothingEnabled = false;

    // Слои хранятся сверху вниз. Рисуем снизу вверх.
    for (let i = project.layers.length - 1; i >= 0; i--) {
      const layer = project.layers[i];
      if (layer.visible === false) continue;

      const opacity = Number(layer.opacity);
      context.globalAlpha = Number.isFinite(opacity)
        ? Math.max(0, Math.min(100, opacity)) / 100
        : 1;

      const image = images[i];
      const size = Number(project.size);
      if (image.width === size * 3 && image.height === size * 3) {
        context.drawImage(
          image, size, size, size, size,
          0, 0, preview.width, preview.height
        );
      } else {
        context.drawImage(
          image, 0, 0, preview.width, preview.height
        );
      }
    }

    context.globalAlpha = 1;
  }

  async function renderGalleryPage() {
    const version = ++renderVersion;
    tiles.replaceChildren();
    message.textContent = "";

    const pageCount = Math.max(
      1, Math.ceil(projects.length / PAGE_SIZE)
    );

    currentPage = Math.min(currentPage, pageCount - 1);
    pageNumber.textContent =
      `Страница ${currentPage + 1} из ${pageCount}`;
    previous.disabled = currentPage === 0;
    next.disabled = currentPage >= pageCount - 1;

    if (projects.length === 0) {
      message.textContent = "Сохранённых проектов пока нет.";
      return;
    }

    const start = currentPage * PAGE_SIZE;
    const visible = projects.slice(start, start + PAGE_SIZE);
    const previews = [];

    for (const item of visible) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "project-tile";
      tile.dataset.projectId = item.id;
      tile.title = `Открыть ${item.name}`;

      const preview = document.createElement("canvas");
      preview.width = 96;
      preview.height = 96;

      const title = document.createElement("span");
      title.className = "tile-name";
      title.textContent = item.name;

      const size = document.createElement("small");
      size.textContent = `${item.size}×${item.size}`;

      tile.append(preview, title, size);
      tiles.appendChild(tile);
      previews.push({ item, preview });

      tile.addEventListener("click", async () => {
        tile.disabled = true;
        message.textContent = "Сохраняю текущую работу и открываю проект...";

        try {
          // Это функции работающего main.js. Он подключён выше menu.js.
          await saveNow();
          await openProject(item.id);
          showSection("art");
        } catch (error) {
          message.textContent =
            `Не удалось открыть проект: ${error.message}`;
        } finally {
          tile.disabled = false;
        }
      });
    }

    message.textContent =
      `Показано ${visible.length} из ${projects.length}. Загружаю миниатюры...`;

    // Загружаем не все 81 картинки одновременно, чтобы не подвесить Astra.
    let position = 0;

    async function worker() {
      while (position < previews.length) {
        if (version !== renderVersion || currentSection !== "gallery") {
          return;
        }

        const entry = previews[position++];

        try {
          await drawThumbnail(entry.item.id, entry.preview, version);
        } catch (error) {
          entry.preview.title =
            `Не удалось показать миниатюру: ${error.message}`;
        }
      }
    }

    await Promise.all([worker(), worker()]);

    if (version === renderVersion && currentSection === "gallery") {
      message.textContent =
        `Показано ${visible.length} из ${projects.length} проектов.`;
    }
  }

  async function refreshLargeGallery() {
    message.textContent = "Загружаю список проектов...";

    try {
      // Сохраняем даже последние изменения, не дожидаясь автосохранения.
      await saveNow();
      const result = await astra.callBackend("list_projects", {});
      projects = Array.isArray(result.projects)
        ? result.projects
        : [];
      await renderGalleryPage();
    } catch (error) {
      message.textContent =
        `Не удалось открыть галерею: ${error.message}`;
    }
  }

  tabs.art.addEventListener("click", () => showSection("art"));
  tabs.animation.addEventListener(
    "click", () => showSection("animation")
  );
  tabs.settings.addEventListener(
    "click", () => showSection("settings")
  );

  tabs.astra2d.addEventListener("click", () => showSection("astra2d"));

  tabs.gallery.addEventListener("click", () => {
    showSection("gallery");
    refreshLargeGallery();
  });

  previous.addEventListener("click", () => {
    if (currentPage > 0) {
      currentPage--;
      renderGalleryPage();
    }
  });

  next.addEventListener("click", () => {
    if ((currentPage + 1) * PAGE_SIZE < projects.length) {
      currentPage++;
      renderGalleryPage();
    }
  });

  showSection("art");
})();