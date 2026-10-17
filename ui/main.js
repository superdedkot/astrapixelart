"use strict";

const $ = (id) => document.getElementById(id);

const canvas = $("canvas");
const ctx = canvas.getContext("2d");
const overlay = $("selection-overlay");
const overlayCtx = overlay.getContext("2d");
const grid = $("pixel-grid");
const viewport = $("viewport");
const canvasWrap = $("canvas-wrap");
const status = $("status");

const sizeSelect = $("size");
const hueBar = $("hue");
const hueMarker = $("hue-marker");
const colorSquare = $("color-square");
const colorMarker = $("color-marker");
const colorPreview = $("color-preview");
const colorValue = $("color-value");
const usedColorsElement = $("used-colors");

const penButton = $("pen");
const eraserButton = $("eraser");
const fillButton = $("fill");
const selectButton = $("select-tool");
const eyedropperButton = $("eyedropper");
const moveButton = document.createElement("button");
moveButton.type = "button";
moveButton.textContent = "✥ Перенос слоя";
$("tools").appendChild(moveButton);
const selectionOptions = $("selection-options");
const selectionMode = $("selection-mode");
const clearSelectionButton = $("clear-selection");
const brushInput = $("brush-size");
const brushValue = $("brush-value");

const saveButton = $("save");
const undoButton = $("undo");
const redoButton = $("redo");

const layersElement = $("layers");
const addLayerButton = $("add-layer");
const deleteLayerButton = $("delete-layer");
const moveUpButton = $("move-up");
const moveDownButton = $("move-down");
const opacityInput = $("opacity");
const opacityValue = $("opacity-value");
const importButton = $("import");
const fileInput = $("file-input");

const galleryElement = $("gallery");
const projectNameElement = $("project-name");
const newProjectButton = $("new-project");
const saveProjectButton = $("save-project");

const zoomInput = $("zoom");
const zoomValue = $("zoom-value");

let hue = 0;
let saturation = 1;
let brightness = 1;
let selectedColor = "#ff0000";
let usedColors = [];
let tool = "pen";
let brushSize = 1;

let layers = [];
let selectedLayer = null;
let nextLayerNumber = 1;

let drawing = false;
let activePointer = null;
let lastCell = null;
let startCell = null;
let freePath = [];
let selectionMask = null;

const undoHistory = [];
const redoHistory = [];
const HISTORY_LIMIT = 20;
let changingOpacity = false;

let projectId = "";
let projectName = "Проект 1";
let ready = false;
let saveTimer = null;
let saveQueue = Promise.resolve();

let zoom = 1;
let panX = 0;
let panY = 0;
let movePointer = null;
let moveCell = null;
let moveStarted = false;
let panning = false;
let panPointer = null;
let panStartX = 0;
let panStartY = 0;

function newId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function copyCanvas(source) {
  const copy = document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  copy.getContext("2d").drawImage(source, 0, 0);
  return copy;
}

function makeLayer(name) {
  const image = document.createElement("canvas");
  image.width = canvas.width * 3; image.height = canvas.height * 3;

  return {
    name: name || `Слой ${nextLayerNumber++}`,
    canvas: image,
    visible: true,
    opacity: 100
  };
}

function selectedIndex() {
  return layers.indexOf(selectedLayer);
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (!layer.visible) continue;
    ctx.globalAlpha = layer.opacity / 100;
    ctx.drawImage(layer.canvas, canvas.width, canvas.height, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  }

  ctx.globalAlpha = 1;
}

function renderLayers() {
  layersElement.replaceChildren();

  for (const layer of layers) {
    const row = document.createElement("div");
    row.className = "layer-row";
    row.classList.toggle("active", layer === selectedLayer);

    const visibility = document.createElement("button");
    visibility.type = "button";
    visibility.textContent = layer.visible ? "Скрыть" : "Показать";
    visibility.addEventListener("click", () => {
      stopDrawing();
      rememberAction();
      layer.visible = !layer.visible;
      redraw();
      renderLayers();
      scheduleSave();
    });

    const name = document.createElement("button");
    name.type = "button";
    name.className = "layer-name";
    name.textContent = layer.name;
    name.title = layer.name;
    name.addEventListener("click", () => {
      stopDrawing();
      selectedLayer = layer;
      renderLayers();
      scheduleSave();
      status.textContent = `Выбран ${layer.name}.`;
    });

    row.append(visibility, name);
    layersElement.appendChild(row);
  }

  const index = selectedIndex();
  opacityInput.value = String(selectedLayer.opacity);
  opacityValue.textContent = `${selectedLayer.opacity}%`;
  deleteLayerButton.disabled = layers.length <= 1;
  moveUpButton.disabled = index <= 0;
  moveDownButton.disabled = index >= layers.length - 1;
}

function takeSnapshot() {
  return {
    size: canvas.width,
    selectedIndex: selectedIndex(),
    nextLayerNumber,
    usedColors: [...usedColors],
    selectionMask: selectionMask ? new Uint8Array(selectionMask) : null,
    layers: layers.map((layer) => ({
      name: layer.name,
      canvas: copyCanvas(layer.canvas),
      visible: layer.visible,
      opacity: layer.opacity
    }))
  };
}

function updateHistoryButtons() {
  undoButton.disabled = !undoHistory.length;
  redoButton.disabled = !redoHistory.length;
}

function rememberAction() {
  undoHistory.push(takeSnapshot());
  if (undoHistory.length > HISTORY_LIMIT) undoHistory.shift();
  redoHistory.length = 0;
  updateHistoryButtons();
}

function restoreSnapshot(snapshot) {
  stopDrawing();
  changingOpacity = false;

  canvas.width = snapshot.size;
  canvas.height = snapshot.size;
  sizeSelect.value = String(snapshot.size);
  usedColors = [...snapshot.usedColors];

  layers = snapshot.layers.map((layer) => ({
    name: layer.name,
    canvas: copyCanvas(layer.canvas),
    visible: layer.visible,
    opacity: layer.opacity
  }));

  selectedLayer = layers[snapshot.selectedIndex] || layers[0];
  nextLayerNumber = snapshot.nextLayerNumber;

  selectionMask = snapshot.selectionMask ? new Uint8Array(snapshot.selectionMask) : null;
  overlay.width = canvas.width;
  overlay.height = canvas.height;
  redraw();
  drawSelectionOutline();
  renderLayers();
  renderUsedColors();
  updateGrid();
  updateHistoryButtons();
  scheduleSave();
}

function undoAction() {
  if (!undoHistory.length) return;
  redoHistory.push(takeSnapshot());
  if (redoHistory.length > HISTORY_LIMIT) redoHistory.shift();
  restoreSnapshot(undoHistory.pop());
  status.textContent = "Действие отменено.";
}

function redoAction() {
  if (!redoHistory.length) return;
  undoHistory.push(takeSnapshot());
  if (undoHistory.length > HISTORY_LIMIT) undoHistory.shift();
  restoreSnapshot(redoHistory.pop());
  status.textContent = "Действие возвращено.";
}

undoButton.addEventListener("click", undoAction);
redoButton.addEventListener("click", redoAction);

document.addEventListener("keydown", (event) => {
  if (event.altKey || event.metaKey) return;

  const target = event.target;
  if (target instanceof Element &&
      (target.closest("input, textarea, select") ||
       target.isContentEditable)) {
    return;
  }

  const key = event.key.toLowerCase();

  if (event.ctrlKey && !event.shiftKey && key === "z") {
    event.preventDefault();
    undoAction();
    return;
  }

  if (event.ctrlKey && !event.shiftKey && key === "y") {
    event.preventDefault();
    redoAction();
    return;
  }

  if (event.ctrlKey || event.shiftKey) return;

  const moves = {
    arrowleft: [-25, 0],
    arrowright: [25, 0],
    arrowup: [0, -25],
    arrowdown: [0, 25]
  };

  if (moves[key]) {
    event.preventDefault();
    if (tool === "move" && selectedLayer) {
      const step = {
        arrowleft: [-1, 0],
        arrowright: [1, 0],
        arrowup: [0, -1],
        arrowdown: [0, 1]
      }[key];
      rememberAction();
      moveActivePixels(step[0], step[1]);
      return;
    }
    panX += moves[key][0];
    panY += moves[key][1];
    updateView();
  }
});

const copySelectionButton = document.createElement("button");
copySelectionButton.type = "button";
copySelectionButton.textContent = "Выделение → новый слой";
addLayerButton.insertAdjacentElement("afterend", copySelectionButton);
copySelectionButton.addEventListener("click", () => {
  if (!selectionMask || !selectionMask.some((value) => value === 1)) {
    status.textContent = "Сначала выдели область.";
    return;
  }
  if (layers.length >= 20) {
    status.textContent = "Можно создать не больше 20 слоёв.";
    return;
  }
  const original = selectedLayer;
  const width = original.canvas.width;
  const height = original.canvas.height;
  if (selectionMask.length !== width * height) {
    status.textContent = "Размер выделения не совпадает с размером слоя.";
    return;
  }

  stopDrawing();
  rememberAction();
  const copy = makeLayer(`${original.name} (выделение)`);
  const copyCtx = copy.canvas.getContext("2d");
  copyCtx.drawImage(original.canvas, 0, 0);
  const pixels = copyCtx.getImageData(0, 0, width, height);
  for (let i = 0; i < selectionMask.length; i++) {
    if (!selectionMask[i]) {
      const offset = i * 4;
      pixels.data[offset] = 0;
      pixels.data[offset + 1] = 0;
      pixels.data[offset + 2] = 0;
      pixels.data[offset + 3] = 0;
    }
  }
  copyCtx.putImageData(pixels, 0, 0);
  copy.opacity = original.opacity;
  layers.splice(layers.indexOf(original), 0, copy);
  selectedLayer = copy;
  selectionMove = null;
  redraw();
  renderLayers();
  scheduleSave();
  status.textContent = "Выделение скопировано на новый слой.";
});
const copyLayerButton = document.createElement("button");
copyLayerButton.type = "button";
copyLayerButton.textContent = "Копировать слой";
addLayerButton.insertAdjacentElement("afterend", copyLayerButton);
copyLayerButton.addEventListener("click", () => {
  if (layers.length >= 20) {
    status.textContent = "Можно создать не больше 20 слоёв.";
    return;
  }
  stopDrawing();
  rememberAction();
  const original = selectedLayer;
  const copy = makeLayer(`${original.name} (копия)`);
  copy.canvas = copyCanvas(original.canvas);
  copy.visible = original.visible;
  copy.opacity = original.opacity;
  layers.splice(selectedIndex(), 0, copy);
  selectedLayer = copy;
  selectionMove = null;
  redraw();
  renderLayers();
  scheduleSave();
  status.textContent = `Скопирован слой «${original.name}».`;
});
function mirrorStoredLayer(layer) {
  const source = layer.canvas;
  const result = document.createElement("canvas");
  result.width = source.width;
  result.height = source.height;
  const resultCtx = result.getContext("2d");
  resultCtx.translate(result.width, 0);
  resultCtx.scale(-1, 1);
  resultCtx.drawImage(source, 0, 0);
  layer.canvas = result;
}

function mirrorLayers(allLayers) {
  stopDrawing();
  rememberAction();
  const targets = allLayers ? layers : [selectedLayer];
  for (const layer of targets) mirrorStoredLayer(layer);
  selectionMove = null;
  selectionMask = null;
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  redraw();
  scheduleSave();
  status.textContent = allLayers
    ? "Весь проект отражён слева направо."
    : "Выбранный слой отражён слева направо.";
}

const mirrorLayerButton = document.createElement("button");
mirrorLayerButton.type = "button";
mirrorLayerButton.textContent = "↔ Отзеркалить слой";
addLayerButton.insertAdjacentElement("afterend", mirrorLayerButton);
mirrorLayerButton.addEventListener("click", () => mirrorLayers(false));

const mirrorProjectButton = document.createElement("button");
mirrorProjectButton.type = "button";
mirrorProjectButton.textContent = "↔ Отзеркалить проект";
mirrorLayerButton.insertAdjacentElement("afterend", mirrorProjectButton);
mirrorProjectButton.addEventListener("click", () => mirrorLayers(true));
addLayerButton.addEventListener("click", () => {
  if (layers.length >= 20) {
    status.textContent = "Можно создать не больше 20 слоёв.";
    return;
  }

  stopDrawing();
  rememberAction();
  const layer = makeLayer();
  layers.unshift(layer);
  selectedLayer = layer;
  redraw();
  renderLayers();
  scheduleSave();
});

deleteLayerButton.addEventListener("click", () => {
  if (layers.length <= 1) return;

  stopDrawing();
  rememberAction();
  const index = selectedIndex();
  layers.splice(index, 1);
  selectedLayer = layers[Math.min(index, layers.length - 1)];
  redraw();
  renderLayers();
  scheduleSave();
});

moveUpButton.addEventListener("click", () => {
  const index = selectedIndex();
  if (index <= 0) return;

  stopDrawing();
  rememberAction();
  [layers[index - 1], layers[index]] = [layers[index], layers[index - 1]];
  redraw();
  renderLayers();
  scheduleSave();
});

moveDownButton.addEventListener("click", () => {
  const index = selectedIndex();
  if (index < 0 || index >= layers.length - 1) return;

  stopDrawing();
  rememberAction();
  [layers[index], layers[index + 1]] = [layers[index + 1], layers[index]];
  redraw();
  renderLayers();
  scheduleSave();
});

opacityInput.addEventListener("input", () => {
  const value = Number(opacityInput.value);
  if (value === selectedLayer.opacity) return;

  if (!changingOpacity) {
    rememberAction();
    changingOpacity = true;
  }

  selectedLayer.opacity = value;
  opacityValue.textContent = `${value}%`;
  redraw();
  scheduleSave();
});

opacityInput.addEventListener("change", () => {
  changingOpacity = false;
});

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

function pointerPosition(event, element) {
  const rect = element.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width),
    y: clamp((event.clientY - rect.top) / rect.height)
  };
}

function hsvToHex(h, s, v) {
  const c = v * s;
  const part = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const offset = v - c;
  let rgb;

  if (h < 60) rgb = [c, part, 0];
  else if (h < 120) rgb = [part, c, 0];
  else if (h < 180) rgb = [0, c, part];
  else if (h < 240) rgb = [0, part, c];
  else if (h < 300) rgb = [part, 0, c];
  else rgb = [c, 0, part];

  return "#" + rgb.map((value) =>
    Math.round((value + offset) * 255)
      .toString(16).padStart(2, "0")
  ).join("");
}

function hexToHsv(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  let h = 0;

  if (diff) {
    if (max === r) h = 60 * (((g - b) / diff) % 6);
    else if (max === g) h = 60 * ((b - r) / diff + 2);
    else h = 60 * ((r - g) / diff + 4);
  }

  if (h < 0) h += 360;
  return {h, s: max ? diff / max : 0, v: max};
}

function renderUsedColors() {
  usedColorsElement.replaceChildren();

  for (let i = 0; i < 45; i++) {
    const color = usedColors[i];
    const cell = document.createElement("button");
    cell.type = "button";
    cell.style.backgroundColor = color || "#ffffff";
    cell.disabled = !color;
    cell.title = color || "Пустая ячейка";

    if (color) {
      if (color === selectedColor) cell.classList.add("active-color");
      cell.addEventListener("click", () => {
        setSelectedColor(color);
        chooseTool("pen");
      });
    }

    usedColorsElement.appendChild(cell);
  }
}

function rememberUsedColor(color) {
  if (usedColors[0] === color) return;
  const old = usedColors.indexOf(color);
  if (old !== -1) usedColors.splice(old, 1);
  usedColors.unshift(color);
  usedColors.length = Math.min(usedColors.length, 45);
  renderUsedColors();
}

function refreshPicker() {
  colorSquare.style.backgroundColor = hsvToHex(hue, 1, 1);
  hueMarker.style.left = `${hue / 360 * 100}%`;
  colorMarker.style.left = `${saturation * 100}%`;
  colorMarker.style.top = `${(1 - brightness) * 100}%`;
  colorPreview.style.backgroundColor = selectedColor;
  colorValue.textContent = selectedColor.toUpperCase();
  renderUsedColors();
}

function setSelectedColor(hex) {
  selectedColor = hex.toLowerCase();
  const hsv = hexToHsv(selectedColor);
  hue = hsv.h;
  saturation = hsv.s;
  brightness = hsv.v;
  refreshPicker();
  scheduleSave();
}

function updateToolButtons() {
  const buttons = [
    [penButton, "pen"],
    [eraserButton, "eraser"],
    [fillButton, "fill"],
    [selectButton, "select"],
    [eyedropperButton, "eyedropper"],
    [moveButton, "move"]
  ];

  for (const [button, name] of buttons) {
    button.classList.toggle("selected", tool === name);
  }

  selectionOptions.hidden = tool !== "select";
}

function chooseTool(name) {
  stopDrawing();
  movePointer = null;
  moveCell = null;
  moveStarted = false;
  tool = name;
  updateToolButtons();
  status.textContent = name === "select"
    ? "Нарисуй область выделения на холсте."
    : `Выбран инструмент: ${name}.`;
}

penButton.addEventListener("click", () => chooseTool("pen"));
eraserButton.addEventListener("click", () => chooseTool("eraser"));
fillButton.addEventListener("click", () => chooseTool("fill"));
selectButton.addEventListener("click", () => chooseTool("select"));
eyedropperButton.addEventListener("click", () => chooseTool("eyedropper"));
moveButton.addEventListener("click", () => chooseTool("move"));

function enableDrag(element, callback) {
  let pointer = null;

  element.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointer = event.pointerId;
    element.setPointerCapture(pointer);
    callback(pointerPosition(event, element));
    event.preventDefault();
  });

  element.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointer) return;
    callback(pointerPosition(event, element));
    event.preventDefault();
  });

  function stop(event) {
    if (event.pointerId === pointer) pointer = null;
  }

  element.addEventListener("pointerup", stop);
  element.addEventListener("pointercancel", stop);
  element.addEventListener("lostpointercapture", stop);
}

enableDrag(hueBar, ({x}) => {
  hue = x * 360;
  selectedColor = hsvToHex(hue, saturation, brightness);
  refreshPicker();
  chooseTool("pen");
  scheduleSave();
});

enableDrag(colorSquare, ({x, y}) => {
  saturation = x;
  brightness = 1 - y;
  selectedColor = hsvToHex(hue, saturation, brightness);
  refreshPicker();
  chooseTool("pen");
  scheduleSave();
});

brushInput.addEventListener("input", () => {
  brushSize = Number(brushInput.value);
  brushValue.textContent = `${brushSize} пикс.`;
});

function updateGrid() {
  grid.style.display = $("grid-toggle").checked ? "block" : "none";
  if (grid.style.display === "none") return;

  const width = canvas.clientWidth - 2;
  const height = canvas.clientHeight - 2;
  grid.style.backgroundSize =
    `${width / canvas.width}px ${height / canvas.height}px`;
}

$("grid-toggle").addEventListener("change", updateGrid);
window.addEventListener("resize", updateGrid);

if (window.ResizeObserver) {
  new ResizeObserver(updateGrid).observe(canvas);
}

sizeSelect.addEventListener("change", () => {
  const newSize = Number(sizeSelect.value);
  if (newSize === canvas.width) return;

  stopDrawing();
  rememberAction();

  for (const layer of layers) {
    const resized = document.createElement("canvas");
    resized.width = newSize * 3; resized.height = newSize * 3;
    const resizedCtx = resized.getContext("2d");
    resizedCtx.imageSmoothingEnabled = false;
    resizedCtx.drawImage(layer.canvas, 0, 0, newSize * 3, newSize * 3);
    layer.canvas = resized;
  }

  canvas.width = newSize;
  canvas.height = newSize;
  overlay.width = newSize;
  overlay.height = newSize;
  selectionMask = null;

  redraw();
  updateGrid();
  scheduleSave();
  status.textContent = `Размер холста: ${newSize}×${newSize}.`;
});

function moveLayerPixels(dx, dy) {
  if (!dx && !dy) return;
  const image = selectedLayer.canvas;
  const saved = copyCanvas(image);
  const imageCtx = image.getContext("2d");
  imageCtx.clearRect(0, 0, image.width, image.height);
  imageCtx.drawImage(saved, dx, dy);
  redraw();
  scheduleSave();
}
let selectionMove = null;

function moveActivePixels(dx, dy) {
  if (!dx && !dy) return;

  if (!selectionMask) {
    selectionMove = null;
    moveLayerPixels(dx, dy);
    return;
  }

  const image = selectedLayer.canvas;
  const width = image.width;
  const height = image.height;
  if (selectionMask.length !== width * height) {
    throw new Error("Размер выделения не совпадает с размером слоя.");
  }

  // Новое выделение или другой слой начинают новый перенос.
  if (!selectionMove ||
      selectionMove.layer !== selectedLayer ||
      selectionMove.currentMask !== selectionMask) {
    const source = image.getContext("2d", {
      willReadFrequently: true
    }).getImageData(0, 0, width, height);

    const background = document.createElement("canvas");
    background.width = width;
    background.height = height;
    const fragment = document.createElement("canvas");
    fragment.width = width;
    fragment.height = height;

    const backgroundData = new ImageData(
      new Uint8ClampedArray(source.data), width, height
    );
    const fragmentData = new ImageData(
      new Uint8ClampedArray(source.data), width, height
    );

    for (let i = 0; i < selectionMask.length; i++) {
      const offset = i * 4;
      if (selectionMask[i]) {
        backgroundData.data[offset] = 0;
        backgroundData.data[offset + 1] = 0;
        backgroundData.data[offset + 2] = 0;
        backgroundData.data[offset + 3] = 0;
      } else {
        fragmentData.data[offset] = 0;
        fragmentData.data[offset + 1] = 0;
        fragmentData.data[offset + 2] = 0;
        fragmentData.data[offset + 3] = 0;
      }
    }

    background.getContext("2d").putImageData(backgroundData, 0, 0);
    fragment.getContext("2d").putImageData(fragmentData, 0, 0);
    selectionMove = {
      layer: selectedLayer,
      originalMask: new Uint8Array(selectionMask),
      currentMask: selectionMask,
      background,
      fragment,
      x: 0,
      y: 0
    };
  }

  const move = selectionMove;
  move.x += dx;
  move.y += dy;

  // Никогда не читаем пиксели из результата предыдущего шага.
  const imageCtx = image.getContext("2d");
  imageCtx.clearRect(0, 0, width, height);
  imageCtx.drawImage(move.background, 0, 0);
  imageCtx.drawImage(move.fragment, move.x, move.y);

  const shifted = new Uint8Array(move.originalMask.length);
  for (let i = 0; i < move.originalMask.length; i++) {
    if (!move.originalMask[i]) continue;
    const x = i % width + move.x;
    const y = Math.floor(i / width) + move.y;
    if (x >= 0 && y >= 0 && x < width && y < height) {
      shifted[y * width + x] = 1;
    }
  }
  selectionMask = shifted;
  move.currentMask = shifted;
  drawSelectionOutline();
  redraw();
  scheduleSave();
}
function movePointerCell(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.floor((event.clientX - rect.left - 1) *
                  canvas.width / (rect.width - 2)),
    y: Math.floor((event.clientY - rect.top - 1) *
                  canvas.height / (rect.height - 2))
  };
}
function cellFromPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(
    (event.clientX - rect.left - 1) * canvas.width / (rect.width - 2)
  );
  const y = Math.floor(
    (event.clientY - rect.top - 1) * canvas.height / (rect.height - 2)
  );

  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
    return null;
  }

  return {x, y};
}

function isSelected(x, y) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
    return false;
  }
  return !selectionMask || selectionMask[(y + canvas.height) * (canvas.width * 3) + x + canvas.width] === 1;
}

function paintCell(x, y) {
  const layerCtx = selectedLayer.canvas.getContext("2d");

  if (tool === "eraser") {
    const offset = Math.floor((brushSize - 1) / 2);
    for (let py = y - offset; py < y - offset + brushSize; py++) {
      for (let px = x - offset; px < x - offset + brushSize; px++) {
        if (isSelected(px, py)) {
          layerCtx.clearRect(px + canvas.width, py + canvas.height, 1, 1);
        }
      }
    }
    return;
  }

  layerCtx.fillStyle = selectedColor;
  const offset = Math.floor((brushSize - 1) / 2);

  for (let py = y - offset; py < y - offset + brushSize; py++) {
    for (let px = x - offset; px < x - offset + brushSize; px++) {
      if (isSelected(px, py)) layerCtx.fillRect(px + canvas.width, py + canvas.height, 1, 1);
    }
  }

  rememberUsedColor(selectedColor);
}

function walkLine(a, b, callback) {
  const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));

  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    callback(
      Math.round(a.x + (b.x - a.x) * t),
      Math.round(a.y + (b.y - a.y) * t)
    );
  }
}

function paintTo(cell) {
  if (!cell) return;

  if (lastCell) walkLine(lastCell, cell, paintCell);
  else paintCell(cell.x, cell.y);

  lastCell = cell;
  redraw();
  scheduleSave();
}

function fillAt(start) {
  if (!isSelected(start.x, start.y)) return false;

  const layerCtx = selectedLayer.canvas.getContext("2d", {
    willReadFrequently: true
  });
  const width = canvas.width;
  const height = canvas.height;
  const image = layerCtx.getImageData(width, height, width, height);
  const data = image.data;
  const first = (start.y * width + start.x) * 4;
  const target = Array.from(data.slice(first, first + 4));
  const replacement = [
    parseInt(selectedColor.slice(1, 3), 16),
    parseInt(selectedColor.slice(3, 5), 16),
    parseInt(selectedColor.slice(5, 7), 16),
    255
  ];

  if (target.every((value, i) => value === replacement[i])) return false;

  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const startIndex = start.y * width + start.x;
  queue[tail++] = startIndex;
  visited[startIndex] = 1;

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    const offset = index * 4;

    if (!isSelected(x, y)) continue;
    if (!target.every((value, i) => data[offset + i] === value)) continue;

    for (let i = 0; i < 4; i++) data[offset + i] = replacement[i];

    const neighbors = [];
    if (x > 0) neighbors.push(index - 1);
    if (x < width - 1) neighbors.push(index + 1);
    if (y > 0) neighbors.push(index - width);
    if (y < height - 1) neighbors.push(index + width);

    for (const neighbor of neighbors) {
      if (!visited[neighbor]) {
        visited[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }
  }

  layerCtx.putImageData(image, width, height);
  rememberUsedColor(selectedColor);
  redraw();
  scheduleSave();
  return true;
}

function insidePolygon(x, y, points) {
  let inside = false;

  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];

    if ((a.y > y) !== (b.y > y) &&
        x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }

  return inside;
}

function buildSelection(end) {
  const width = canvas.width;
  const height = canvas.height;
  const mask = new Uint8Array(width * height * 9);
  const left = Math.min(startCell.x, end.x);
  const right = Math.max(startCell.x, end.x);
  const top = Math.min(startCell.y, end.y);
  const bottom = Math.max(startCell.y, end.y);
  const mode = selectionMode.value;

  if (mode === "free" && freePath.length < 3) {
    mask[(startCell.y + height) * (width * 3) + startCell.x + width] = 1;
  } else {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let inside = false;

        if (mode === "rect") {
          inside = x >= left && x <= right && y >= top && y <= bottom;
        } else if (mode === "ellipse") {
          const cx = (left + right + 1) / 2;
          const cy = (top + bottom + 1) / 2;
          const rx = (right - left + 1) / 2;
          const ry = (bottom - top + 1) / 2;
          inside = ((x + .5 - cx) / rx) ** 2 +
                   ((y + .5 - cy) / ry) ** 2 <= 1;
        } else {
          inside = insidePolygon(x + .5, y + .5, freePath);
        }

        if (inside) mask[(y + height) * (width * 3) + x + width] = 1;
      }
    }
  }

  selectionMask = mask;
  drawSelectionOutline();
  status.textContent = "Область выделена.";
}

function drawSelectionOutline() {
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  if (!selectionMask) return;
  const width = canvas.width;
  const height = canvas.height;
  const storageWidth = width * 3;
  const selected = (x, y) => {
    const sx = x + width;
    const sy = y + height;
    return sx >= 0 && sy >= 0 &&
      sx < storageWidth && sy < height * 3 &&
      selectionMask[sy * storageWidth + sx] === 1;
  };
  overlayCtx.fillStyle = "rgba(0, 210, 255, .9)";
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!selected(x, y)) continue;
      if (!selected(x, y - 1))
        overlayCtx.fillRect(x, y, 1, .18);
      if (!selected(x, y + 1))
        overlayCtx.fillRect(x, y + .82, 1, .18);
      if (!selected(x - 1, y))
        overlayCtx.fillRect(x, y, .18, 1);
      if (!selected(x + 1, y))
        overlayCtx.fillRect(x + .82, y, .18, 1);
    }
  }
}
clearSelectionButton.addEventListener("click", () => {
  selectionMask = null;
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  status.textContent = "Выделение снято.";
});

function pickColor(cell) {
  redraw();
  const pixel = ctx.getImageData(cell.x, cell.y, 1, 1).data;

  if (!pixel[3]) {
    status.textContent = "Здесь прозрачный пиксель.";
    return;
  }

  const hex = "#" + [pixel[0], pixel[1], pixel[2]]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

  setSelectedColor(hex);
  chooseTool("pen");
  status.textContent = `Пипетка выбрала ${hex.toUpperCase()}.`;
}

canvas.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;

  const cell = cellFromPointer(event);
  if (!cell) return;

  viewport.focus();
  if (tool === "move") {
    movePointer = event.pointerId;
    moveCell = cell;
    moveStarted = false;
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    return;
  }
  if (tool === "eyedropper") {
    pickColor(cell);
    event.preventDefault();
    return;
  }

  if (tool === "select") {
    drawing = true;
    activePointer = event.pointerId;
    startCell = cell;
    lastCell = cell;
    freePath = [{x: cell.x + .5, y: cell.y + .5}];
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    return;
  }

  if (!selectedLayer.visible) {
    status.textContent = "Выбранный слой скрыт.";
    return;
  }

  if (tool === "fill") {
    if (isSelected(cell.x, cell.y)) {
      rememberAction();
      fillAt(cell);
    }
    event.preventDefault();
    return;
  }

  rememberAction();
  drawing = true;
  activePointer = event.pointerId;
  lastCell = null;
  canvas.setPointerCapture(event.pointerId);
  paintTo(cell);
  event.preventDefault();
});

canvas.addEventListener("pointermove", (event) => {
  if (tool === "move" && event.pointerId === movePointer) {
    const cell = movePointerCell(event);
    const dx = cell.x - moveCell.x;
    const dy = cell.y - moveCell.y;
    if (dx || dy) {
      if (!moveStarted) {
        rememberAction();
        moveStarted = true;
      }
      moveActivePixels(dx, dy);
      moveCell = cell;
    }
    event.preventDefault();
    return;
  }
  if (!drawing || event.pointerId !== activePointer) return;

  const cell = cellFromPointer(event);
  if (!cell) return;

  if (tool === "select") {
    if (selectionMode.value === "free" &&
        (!lastCell || cell.x !== lastCell.x || cell.y !== lastCell.y)) {
      freePath.push({x: cell.x + .5, y: cell.y + .5});
    }
    lastCell = cell;
  } else {
    paintTo(cell);
  }

  event.preventDefault();
});

canvas.addEventListener("pointerup", (event) => {
  if (event.pointerId === movePointer) {
    movePointer = null;
    moveCell = null;
    moveStarted = false;
    return;
  }
  if (!drawing || event.pointerId !== activePointer) return;

  if (tool === "select" && startCell) {
    buildSelection(cellFromPointer(event) || lastCell || startCell);
  }

  stopDrawing();
});

function stopDrawing() {
  const wasDrawing = drawing && tool !== "select";
  drawing = false;
  activePointer = null;
  lastCell = null;
  startCell = null;
  freePath = [];

  if (wasDrawing) scheduleSave();
}

canvas.addEventListener("pointercancel", stopDrawing);
canvas.addEventListener("pointercancel", () => {
  movePointer = null;
  moveCell = null;
  moveStarted = false;
});
canvas.addEventListener("lostpointercapture", () => {
  movePointer = null;
  moveCell = null;
  moveStarted = false;
});
canvas.addEventListener("lostpointercapture", stopDrawing);

const allowedExtensions = /\.(png|jpe?g|webp|bmp)$/i;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(
      new Error("Не удалось открыть картинку.")
    );
    image.src = dataUrl;
  });
}

async function importImage(file) {
  if (!file || !allowedExtensions.test(file.name)) {
    throw new Error("Выбери PNG, JPG, WebP или BMP.");
  }

  if (file.size > 20 * 1024 * 1024) {
    throw new Error("Файл больше 20 МБ.");
  }

  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);

  if (!image.naturalWidth || !image.naturalHeight ||
      image.naturalWidth > 4096 || image.naturalHeight > 4096) {
    throw new Error("Размер картинки должен быть не больше 4096×4096.");
  }

  if (layers.length >= 20) {
    throw new Error("Можно создать не больше 20 слоёв.");
  }

  const layer = makeLayer(`Импорт: ${file.name.slice(0, 35)}`);
  const layerCtx = layer.canvas.getContext("2d");
  const scale = Math.min(
    canvas.width / image.naturalWidth,
    canvas.height / image.naturalHeight
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const x = Math.floor((canvas.width - width) / 2);
  const y = Math.floor((canvas.height - height) / 2);

  layerCtx.imageSmoothingEnabled = scale < 1;
  layerCtx.drawImage(image, x + canvas.width, y + canvas.height, width, height);

  stopDrawing();
  rememberAction();
  layers.unshift(layer);
  selectedLayer = layer;
  redraw();
  renderLayers();
  scheduleSave();
  status.textContent = `${file.name} добавлен как новый слой.`;
}

async function importWithMessage(file) {
  status.textContent = "Открываю картинку...";
  try {
    await importImage(file);
  } catch (error) {
    status.textContent = `Не удалось добавить слой: ${error.message}`;
  }
}

importButton.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  fileInput.value = "";
  if (file) importWithMessage(file);
});

// Перетаскивание остаётся дополнительным способом.
// Если Astra не передаёт файл во вкладку, работает кнопка выбора.
document.addEventListener("dragover", (event) => {
  if (!Array.from(event.dataTransfer?.types || []).includes("Files")) return;
  event.preventDefault();
}, true);

document.addEventListener("drop", (event) => {
  if (!Array.from(event.dataTransfer?.types || []).includes("Files")) return;
  event.preventDefault();

  const file = event.dataTransfer.files[0];
  if (file) importWithMessage(file);
  else status.textContent = "Нажми «Добавить рисунок как слой».";
}, true);

saveButton.addEventListener("click", async () => {
  saveButton.disabled = true;
  redraw();
  status.textContent = "Сохраняю PNG...";

  try {
    const result = await astra.callBackend("save_png", {
      data_url: canvas.toDataURL("image/png")
    });
    status.textContent = `PNG сохранён: ${result.path}`;
  } catch (error) {
    status.textContent = `Не удалось сохранить PNG: ${error.message}`;
  } finally {
    saveButton.disabled = false;
  }
});

/* Проекты: сохраняем каждый слой отдельно, поэтому PNG-экспорт
   не заменяет файл проекта. */

function projectData() {
  return {
    id: projectId,
    name: projectName,
    size: canvas.width,
    selectedIndex: selectedIndex(),
    nextLayerNumber,
    selectedColor,
    usedColors: [...usedColors],
    layers: layers.map((layer) => ({
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity,
      data: layer.canvas.toDataURL("image/png")
    }))
  };
}

function scheduleSave() {
  if (!ready || !projectId) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveNow().catch((error) => {
      status.textContent = `Не удалось сохранить проект: ${error.message}`;
    });
  }, 1000);
}

function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;

  // Снимок делаем сейчас, а не после ожидания предыдущего сохранения.
  const data = projectData();

  saveQueue = saveQueue.catch(() => {}).then(async () => {
    await astra.callBackend("save_project", {project: data});
  });

  return saveQueue;
}

function renderGallery(items) {
  galleryElement.replaceChildren();

  if (!items.length) {
    galleryElement.textContent = "Проектов пока нет.";
    return;
  }

  for (const item of items) {
    const row = document.createElement("div");
    row.className = "gallery-row";
    row.classList.toggle("active", item.id === projectId);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-name";
    button.textContent = `${item.name} — ${item.size}×${item.size}`;
    button.title = "Открыть проект";
    button.addEventListener("click", async () => {
      if (item.id === projectId) return;

      button.disabled = true;
      status.textContent = "Сохраняю текущий проект...";

      try {
        await saveNow();
        await openProject(item.id);
      } catch (error) {
        status.textContent = `Не удалось открыть проект: ${error.message}`;
      } finally {
        button.disabled = false;
      }
    });

    row.appendChild(button);
    galleryElement.appendChild(row);
  }
}

async function refreshGallery() {
  const result = await astra.callBackend("list_projects", {});
  renderGallery(result.projects || []);
}

function decodeLayer(data) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Повреждено изображение слоя."));
    image.src = data;
  });
}

async function applyProject(project) {
  const validSizes = [8, 16, 32, 64, 128, 256, 512];

  if (!project || !validSizes.includes(project.size) ||
      !Array.isArray(project.layers) ||
      project.layers.length < 1 || project.layers.length > 20) {
    throw new Error("Файл проекта повреждён.");
  }

  // Сначала загружаем все изображения. Если одно повреждено,
  // текущий открытый проект останется на экране.
  const images = await Promise.all(
    project.layers.map((layer) => decodeLayer(layer.data))
  );

  const restored = project.layers.map((layer, index) => {
    const image = document.createElement("canvas");
    image.width = project.size * 3; image.height = project.size * 3; const source = images[index]; if (source.width === project.size && source.height === project.size) { image.getContext("2d").drawImage(source, project.size, project.size); } else if (source.width === project.size * 3 && source.height === project.size * 3) { image.getContext("2d").drawImage(source, 0, 0); } else { throw new Error("Недопустимый размер изображения слоя."); }

    return {
      name: String(layer.name || `Слой ${index + 1}`).slice(0, 80),
      canvas: image,
      visible: layer.visible !== false,
      opacity: Math.max(
        0, Math.min(100, Number(layer.opacity) || 0)
      )
    };
  });

  ready = false;
  clearTimeout(saveTimer);
  saveTimer = null;
  stopDrawing();
  undoHistory.length = 0;
  redoHistory.length = 0;

  projectId = project.id;
  projectName = String(project.name || "Без названия").slice(0, 80);
  projectNameElement.textContent = `Открыт: ${projectName}`;

  canvas.width = project.size;
  canvas.height = project.size;
  overlay.width = project.size;
  overlay.height = project.size;
  sizeSelect.value = String(project.size);

  layers = restored;
  selectedLayer = layers[
    Math.max(0, Math.min(
      layers.length - 1, Number(project.selectedIndex) || 0
    ))
  ];
  nextLayerNumber = Number(project.nextLayerNumber) || layers.length + 1;
  usedColors = Array.isArray(project.usedColors)
    ? project.usedColors
        .filter((color) => /^#[0-9a-f]{6}$/i.test(color))
        .slice(0, 45)
    : [];

  const color = /^#[0-9a-f]{6}$/i.test(project.selectedColor || "")
    ? project.selectedColor
    : "#ff0000";
  setSelectedColor(color);

  selectionMask = null;
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

  redraw();
  renderLayers();
  updateToolButtons();
  updateHistoryButtons();
  updateGrid();
  ready = true;
}

async function openProject(id) {
  const result = await astra.callBackend("load_project", {id});
  await applyProject(result.project);
  await saveNow();
  await refreshGallery();
  status.textContent = `Открыт проект «${projectName}».`;
}

function startEmptyProject(name) {
  ready = false;
  clearTimeout(saveTimer);
  saveTimer = null;

  projectId = newId();
  projectName = name;
  projectNameElement.textContent = `Открыт: ${projectName}`;

  canvas.width = 64;
  canvas.height = 64;
  overlay.width = 64;
  overlay.height = 64;
  sizeSelect.value = "64";
  selectionMask = null;
  usedColors = [];
  layers = [];
  nextLayerNumber = 1;
  selectedLayer = makeLayer();
  layers.push(selectedLayer);
  undoHistory.length = 0;
  redoHistory.length = 0;

  redraw();
  renderLayers();
  renderUsedColors();
  updateHistoryButtons();
  updateGrid();
  ready = true;
}

newProjectButton.addEventListener("click", async () => {
  newProjectButton.disabled = true;
  status.textContent = "Сохраняю текущий проект...";

  try {
    await saveNow();

    const gallery = await astra.callBackend("list_projects", {});
    const number = (gallery.projects || []).length + 1;

    startEmptyProject(`Проект ${number}`);
    resetView();
    await saveNow();
    await refreshGallery();

    status.textContent =
      "Создан новый проект. Предыдущий остался в галерее.";
  } catch (error) {
    status.textContent =
      `Новый проект не создан: ${error.message}`;
  } finally {
    newProjectButton.disabled = false;
  }
});

saveProjectButton.addEventListener("click", async () => {
  saveProjectButton.disabled = true;
  status.textContent = "Сохраняю проект...";

  try {
    await saveNow();
    await refreshGallery();
    status.textContent =
      `Проект «${projectName}» сохранён.`;
  } catch (error) {
    status.textContent =
      `Не удалось сохранить проект: ${error.message}`;
  } finally {
    saveProjectButton.disabled = false;
  }
});

/* Масштаб и перемещение меняют только вид редактора,
   размеры PNG и пикселей проекта не меняются. */

function updateView() {
  canvasWrap.style.width = `${512 * zoom}px`;
  canvasWrap.style.transform =
    `translate(-50%, -50%) translate(${panX}px, ${panY}px)`;
  zoomInput.value = String(Math.round(zoom * 100));
  zoomValue.textContent = `${Math.round(zoom * 100)}%`;
  updateGrid();
}

function setZoom(percent) {
  zoom = Math.max(0.25, Math.min(8, percent / 100));
  updateView();
}

function resetView() {
  zoom = 1;
  panX = 0;
  panY = 0;
  updateView();
}

zoomInput.addEventListener("input", () => {
  setZoom(Number(zoomInput.value));
});

$("reset-view").addEventListener("click", resetView);

viewport.addEventListener("wheel", (event) => {
  event.preventDefault();
  setZoom(zoom * 100 + (event.deltaY < 0 ? 25 : -25));
}, {passive: false});

viewport.addEventListener("pointerdown", (event) => {
  if (event.button !== 1) return;

  event.preventDefault();
  viewport.focus();
  panning = true;
  panPointer = event.pointerId;
  panStartX = event.clientX;
  panStartY = event.clientY;
  viewport.setPointerCapture(event.pointerId);
  viewport.style.cursor = "grabbing";
});

viewport.addEventListener("pointermove", (event) => {
  if (!panning || event.pointerId !== panPointer) return;

  panX += event.clientX - panStartX;
  panY += event.clientY - panStartY;
  panStartX = event.clientX;
  panStartY = event.clientY;
  updateView();
});

function stopPanning() {
  panning = false;
  panPointer = null;
  viewport.style.cursor = "";
}

viewport.addEventListener("pointerup", stopPanning);
viewport.addEventListener("pointercancel", stopPanning);
viewport.addEventListener("lostpointercapture", stopPanning);

viewport.addEventListener("auxclick", (event) => {
  if (event.button === 1) event.preventDefault();
});

async function start() {
  setSelectedColor("#ff0000");
  updateToolButtons();
  updateHistoryButtons();
  resetView();

  try {
    const result = await astra.callBackend("list_projects", {});
    const items = result.projects || [];
    const active = items.find(
      (item) => item.id === result.activeId
    );

    if (active) {
      await openProject(active.id);
    } else {
      startEmptyProject(`Проект ${items.length + 1}`);
      await saveNow();
      await refreshGallery();
      status.textContent = "Новый проект создан и сохранён.";
    }
  } catch (error) {
    ready = false;
    status.textContent =
      `Не удалось открыть проекты: ${error.message}`;
  }
}

start();