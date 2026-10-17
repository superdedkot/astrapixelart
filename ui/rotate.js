"use strict";
(() => {
  const canvas = document.getElementById("canvas");
  const tools = document.getElementById("tools");
  const status = document.getElementById("status");
  const wrap = document.getElementById("canvas-wrap");

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "⟳ Поворот";
  tools.appendChild(button);

  const panel = document.createElement("div");
  panel.hidden = true;
  panel.style.cssText = "margin:14px 0;text-align:center";
  panel.innerHTML = '<div>Угол: <span id="rotation-angle">0°</span></div>';

  const dial = document.createElement("div");
  dial.style.cssText =
    "position:relative;width:130px;height:130px;margin:10px auto;" +
    "border:2px solid #ddd;border-radius:50%;cursor:crosshair;" +
    "touch-action:none;background:" +
    "linear-gradient(90deg,transparent 49%,#888 49%,#888 51%,transparent 51%)," +
    "linear-gradient(transparent 49%,#888 49%,#888 51%,transparent 51%),#30343d";

  const hand = document.createElement("div");
  hand.style.cssText =
    "position:absolute;left:50%;top:12px;width:3px;height:53px;" +
    "background:#61d9ff;transform-origin:50% 53px;pointer-events:none";
  dial.appendChild(hand);
  panel.appendChild(dial);
  tools.insertAdjacentElement("afterend", panel);

  const marker = document.createElement("div");
  marker.style.cssText =
    "position:absolute;left:50%;top:50%;width:12px;height:12px;" +
    "border:2px solid #61d9ff;border-radius:50%;" +
    "transform:translate(-50%,-50%);pointer-events:none;display:none";
  wrap.appendChild(marker);

  let angle = 0;
  let center = {
    x: canvas.width / 2,
    y: canvas.height / 2
  };
  let dialPointer = null;
  let session = null;

  function setDisplayedAngle(value) {
    angle = value;
    hand.style.transform = `rotate(${angle}deg)`;
    panel.querySelector("#rotation-angle").textContent = `${angle}°`;
  }

  function refresh() {
    const active = tool === "rotate";
    button.classList.toggle("selected", active);
    panel.hidden = !active;
    marker.style.display = active ? "block" : "none";
    if (!active) session = null;
  }

  button.addEventListener("click", () => {
    chooseTool("rotate");
    session = null;
    setDisplayedAngle(0);
    refresh();
    status.textContent =
      "Щёлкни на холсте для выбора центра, затем вращай круг.";
  });

  document.addEventListener("click", () => queueMicrotask(refresh));

  canvas.addEventListener("pointerdown", (event) => {
    if (tool !== "rotate") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const cell = cellFromPointer(event);
    if (!cell) return;
    center = { x: cell.x + 0.5, y: cell.y + 0.5 };
    marker.style.left = `${center.x / canvas.width * 100}%`;
    marker.style.top = `${center.y / canvas.height * 100}%`;
    session = null;
    setDisplayedAngle(0);
    status.textContent = "Центр поворота установлен.";
  }, true);

  function beginSession() {
    const image = selectedLayer.canvas;
    const width = image.width;
    const height = image.height;
    const mask = selectionMask
      ? new Uint8Array(selectionMask) : null;

    if (mask && mask.length !== width * height) {
      throw new Error("Размер выделения не совпадает с размером слоя.");
    }

    const original = image.getContext("2d", {
      willReadFrequently: true
    }).getImageData(0, 0, width, height);
    const background = new Uint8ClampedArray(original.data);

    let left = width, top = height, right = -1, bottom = -1;
    for (let i = 0; i < width * height; i++) {
      const selected = mask ? mask[i] === 1 : original.data[i * 4 + 3] !== 0;
      if (!selected) continue;

      const x = i % width;
      const y = Math.floor(i / width);
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);

      if (mask) {
        const offset = i * 4;
        background[offset] = 0;
        background[offset + 1] = 0;
        background[offset + 2] = 0;
        background[offset + 3] = 0;
      }
    }

    if (!mask) background.fill(0);

    return {
      layer: selectedLayer,
      width,
      height,
      original,
      background,
      mask,
      left,
      top,
      right,
      bottom,
      cx: canvas.width + center.x,
      cy: canvas.height + center.y,
      remembered: false
    };
  }

  function composite(data, destination, source, from) {
    const alpha = source[from + 3] / 255;
    if (alpha === 0) return;

    if (alpha === 1) {
      for (let channel = 0; channel < 4; channel++) {
        data[destination + channel] = source[from + channel];
      }
      return;
    }

    const backAlpha = data[destination + 3] / 255;
    const resultAlpha = alpha + backAlpha * (1 - alpha);
    for (let channel = 0; channel < 3; channel++) {
      data[destination + channel] = Math.round(
        (source[from + channel] * alpha +
         data[destination + channel] * backAlpha * (1 - alpha)) /
        resultAlpha
      );
    }
    data[destination + 3] = Math.round(resultAlpha * 255);
  }

  function renderRotation(degrees) {
    const current = session;
    if (!current || current.layer !== selectedLayer) return;
    if (!current.remembered && degrees === 0) return;

    if (!current.remembered) {
      rememberAction();
      current.remembered = true;
    }

    const {
      width, height, original, background, mask,
      left, top, right, bottom, cx, cy
    } = current;
    const result = new Uint8ClampedArray(background);
    const rotatedMask = mask ? new Uint8Array(mask.length) : null;

    if (right >= left && bottom >= top) {
      const radians = degrees * Math.PI / 180;
      let cosine = Math.cos(radians);
      let sine = Math.sin(radians);
      if (degrees % 90 === 0) {
        cosine = Math.round(cosine);
        sine = Math.round(sine);
      }

      const corners = [
        [left, top], [right + 1, top],
        [left, bottom + 1], [right + 1, bottom + 1]
      ].map(([x, y]) => [
        cx + (x - cx) * cosine - (y - cy) * sine,
        cy + (x - cx) * sine + (y - cy) * cosine
      ]);

      const minX = Math.max(0,
        Math.floor(Math.min(...corners.map((point) => point[0])) - 1));
      const maxX = Math.min(width - 1,
        Math.ceil(Math.max(...corners.map((point) => point[0])) + 1));
      const minY = Math.max(0,
        Math.floor(Math.min(...corners.map((point) => point[1])) - 1));
      const maxY = Math.min(height - 1,
        Math.ceil(Math.max(...corners.map((point) => point[1])) + 1));

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const sx = Math.floor(cx + dx * cosine + dy * sine);
          const sy = Math.floor(cy - dx * sine + dy * cosine);
          if (sx < left || sx > right || sy < top || sy > bottom) continue;

          const sourceIndex = sy * width + sx;
          if (mask && !mask[sourceIndex]) continue;

          const destinationIndex = y * width + x;
          if (rotatedMask) rotatedMask[destinationIndex] = 1;
          composite(result, destinationIndex * 4,
            original.data, sourceIndex * 4);
        }
      }
    }

    current.layer.canvas.getContext("2d").putImageData(
      new ImageData(result, width, height), 0, 0
    );
    if (mask) {
      selectionMask = rotatedMask;
      drawSelectionOutline();
    }
    selectionMove = null;
    redraw();
    scheduleSave();
  }

  function angleFromPointer(event) {
    const rect = dial.getBoundingClientRect();
    let degrees = (
      Math.atan2(
        event.clientY - rect.top - rect.height / 2,
        event.clientX - rect.left - rect.width / 2
      ) * 180 / Math.PI + 90 + 360
    ) % 360;
    const nearest = Math.round(degrees / 90) * 90;
    if (Math.abs(degrees - nearest) <= 7) degrees = nearest;
    return Math.round(degrees) % 360;
  }

  function changeAngle(event) {
    const value = angleFromPointer(event);
    if (value === angle) return;
    setDisplayedAngle(value);
    try {
      renderRotation(value);
    } catch (error) {
      status.textContent = `Не удалось повернуть: ${error.message}`;
    }
  }

  dial.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (!selectedLayer.visible) {
      status.textContent = "Выбранный слой скрыт.";
      return;
    }
    try {
      session = beginSession();
    } catch (error) {
      status.textContent = `Не удалось начать поворот: ${error.message}`;
      return;
    }
    setDisplayedAngle(0);
    dialPointer = event.pointerId;
    dial.setPointerCapture(dialPointer);
    changeAngle(event);
    event.preventDefault();
  });

  dial.addEventListener("pointermove", (event) => {
    if (event.pointerId === dialPointer) changeAngle(event);
  });

  function finish(event) {
    if (event.pointerId !== dialPointer) return;
    dialPointer = null;
    session = null;
  }
  dial.addEventListener("pointerup", finish);
  dial.addEventListener("pointercancel", finish);
  dial.addEventListener("lostpointercapture", finish);

  refresh();
})();