"use strict";
(() => {
  const storageKey = "astrapixelart.appearance.v1";
  const defaults = { opacity: 90, radius: 22, glass: false, blur: 10,
    font: "pixel", color: "#f3e9eb", panelColor: "#411622",
    controlColor: "#ff7775", toggleColor: "#cf1c29", secondaryColor: "#2c2c30",
    buttonColor: "#ffffff", buttonOpacity: 8 };
  const fonts = {
    pixel: '"APA Pixel", "Segoe UI", sans-serif',
    regular: '"Segoe UI", Arial, sans-serif',
    hand: '"APA Hand", "Segoe Print", cursive'
  };
  function normalizeAppearance(value) {
    const data = value && typeof value === "object" ? value : {};
    const number = (key, min, max) => typeof data[key] === "number" && Number.isFinite(data[key])
      ? Math.round(Math.max(min, Math.min(max, data[key]))) : defaults[key];
    return {
      opacity: number("opacity", 10, 100), radius: number("radius", 0, 36),
      glass: typeof data.glass === "boolean" ? data.glass : defaults.glass,
      blur: number("blur", 0, 24), buttonOpacity: number("buttonOpacity", 0, 100),
      secondaryColor: typeof data.secondaryColor === "string" && /^#[0-9a-f]{6}$/i.test(data.secondaryColor) ? data.secondaryColor : defaults.secondaryColor,
      buttonColor: typeof data.buttonColor === "string" && /^#[0-9a-f]{6}$/i.test(data.buttonColor) ? data.buttonColor : defaults.buttonColor,
      font: Object.hasOwn(fonts, data.font) ? data.font : defaults.font,
      color: typeof data.color === "string" && /^#[0-9a-f]{6}$/i.test(data.color) ? data.color : defaults.color,
      panelColor: typeof data.panelColor === "string" && /^#[0-9a-f]{6}$/i.test(data.panelColor) ? data.panelColor : defaults.panelColor,
      controlColor: typeof data.controlColor === "string" && /^#[0-9a-f]{6}$/i.test(data.controlColor) ? data.controlColor : defaults.controlColor,
      toggleColor: typeof data.toggleColor === "string" && /^#[0-9a-f]{6}$/i.test(data.toggleColor) ? data.toggleColor : defaults.toggleColor
    };
  }
  let settings = { ...defaults };
  let revision = 0;
  let saveQueue = Promise.resolve();
  const backend = typeof astra !== "undefined" && typeof astra.callBackend === "function"
    ? (method, params) => astra.callBackend(method, params) : null;
  try { settings = normalizeAppearance(JSON.parse(localStorage.getItem(storageKey))); }
  catch { /* Missing or invalid storage must not block the editor. */ }
  const element = name => document.getElementById(`appearance-${name}`);
  const controls = Object.fromEntries(Object.keys(defaults).map(key => [key, element(key)]));
  const status = element("status");

  function applyAppearance() {
    const style = document.documentElement.style;
    const rgb = hex => hex.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16)).join(", ");
    style.setProperty("--apa-surface", `rgba(${rgb(settings.panelColor)}, ${settings.opacity / 100})`);
    style.setProperty("--apa-panel-color", settings.panelColor);
    style.setProperty("--apa-control-color", settings.controlColor);
    style.setProperty("--apa-toggle-color", settings.toggleColor);
    style.setProperty("--apa-accent", settings.secondaryColor);
    style.setProperty("--apa-secondary", settings.secondaryColor);
    style.setProperty("--apa-button", `rgba(${rgb(settings.buttonColor)}, ${settings.buttonOpacity / 100})`);
    style.setProperty("--apa-radius", `${settings.radius}px`);
    style.setProperty("--apa-blur", `${settings.glass ? settings.blur : 0}px`);
    style.setProperty("--apa-text", settings.color);
    style.setProperty("--apa-muted", settings.color);
    style.setProperty("--apa-font", fonts[settings.font]);
    for (const [key, min, max] of [["opacity", 10, 100], ["radius", 0, 36], ["blur", 0, 24], ["buttonOpacity", 0, 100]]) {
      style.setProperty(`--apa-${key}-progress`, `${(settings[key] - min) / (max - min) * 100}%`);
    }
    for (const key of Object.keys(defaults)) {
      if (key === "glass") controls[key].checked = settings[key];
      else controls[key].value = String(settings[key]);
    }
    element("opacity-value").textContent = `${settings.opacity}%`;
    element("radius-value").textContent = `${settings.radius} px`;
    element("blur-value").textContent = `${settings.blur} px`;
    element("buttonOpacity-value").textContent = `${settings.buttonOpacity}%`;
    controls.blur.disabled = !settings.glass;
  }
  function saveAppearance() {
    const currentRevision = ++revision;
    applyAppearance();
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
      status.textContent = "Оформление сохранено автоматически.";
    } catch {
      status.textContent = "Оформление применено, но хранилище недоступно: после перезапуска настройки могут сброситься.";
    }
    if (backend) {
      const snapshot = { ...settings };
      status.textContent = "Сохраняю оформление…";
      saveQueue = saveQueue.then(() => backend("save_appearance", { settings: snapshot }))
        .then(() => {
          if (revision === currentRevision) status.textContent = "Оформление сохранено в файл.";
        }).catch(() => {
          if (revision === currentRevision) status.textContent = "Не удалось сохранить оформление в файл. Проверь, запущен ли обновлённый плагин.";
        });
    }
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  }
  for (const [key, control] of Object.entries(controls)) {
    control.addEventListener(key === "glass" || key === "font" ? "change" : "input", () => {
      const value = key === "glass" ? control.checked :
        ["opacity", "radius", "blur", "buttonOpacity"].includes(key) ? Number(control.value) : control.value;
      settings = normalizeAppearance({ ...settings, [key]: value });
      saveAppearance();
    });
  }
  element("reset-windows").addEventListener("click", () => {
    for (const key of ["opacity", "radius", "glass", "blur", "panelColor", "controlColor", "toggleColor", "secondaryColor", "buttonColor", "buttonOpacity"]) settings[key] = defaults[key];
    saveAppearance();
    saveAppearance();
  });
  element("reset-fonts").addEventListener("click", () => {
    settings.font = defaults.font;
    settings.color = defaults.color;
    saveAppearance();
  });
  const buttons = [...document.querySelectorAll("[data-settings-target]")];
  const sections = [...document.querySelectorAll("[data-settings-section]")];
  const content = document.getElementById("settings-content");
  function markSection(id) {
    for (const item of buttons) {
      item.setAttribute("aria-current", item.dataset.settingsTarget === id ? "location" : "false");
    }
  }
  function updateNavigation() {
    if (!content.clientHeight) return;
    const top = content.getBoundingClientRect().top;
    for (const section of sections) {
      const offset = top - section.getBoundingClientRect().top;
      section.style.setProperty("--fade-top", `${offset}px`);
      section.style.setProperty("--fade-top-end", `${offset + 24}px`);
      section.style.setProperty("--fade-bottom-start", `${offset + content.clientHeight - 36}px`);
      section.style.setProperty("--fade-bottom", `${offset + content.clientHeight}px`);
    }
    let active = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= top + 48) active = section;
    }
    if (content.scrollTop > 0 && content.scrollTop + content.clientHeight >= content.scrollHeight - 2) {
      active = sections[sections.length - 1];
    }
    if (active) markSection(active.id);
  }
  for (const section of sections) section.hidden = false;
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const section = sections.find(item => item.id === button.dataset.settingsTarget);
      if (!section) return;
      const top = content.scrollTop + section.getBoundingClientRect().top - content.getBoundingClientRect().top - 24;
      content.scrollTo({ top: Math.max(0, top), behavior: "instant" });
      updateNavigation();
      markSection(section.id);
    });
  }
  content.addEventListener("scroll", updateNavigation, { passive: true });
  window.addEventListener("resize", updateNavigation);
  requestAnimationFrame(updateNavigation);
  applyAppearance();
  if (backend) {
    backend("load_appearance", {}).then(result => {
      if (revision !== 0) return;
      if (result.settings) {
        settings = normalizeAppearance(result.settings);
        applyAppearance();
        requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
      } else {
        saveAppearance();
      }
    }).catch(() => {
      status.textContent = "Не удалось прочитать файл оформления. Перезапусти обновлённый плагин.";
    });
  }
})();