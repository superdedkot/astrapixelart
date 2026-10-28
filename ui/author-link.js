"use strict";
(() => {
  const link = document.querySelector('#settings-meow a[href="https://t.me/super_ded_kot"]');
  if (!link) return;
  const status = document.createElement("p");
  status.className = "hint";
  status.setAttribute("role", "status");
  link.parentElement.after(status);
  let pending = false;
  link.addEventListener("click", async event => {
    event.preventDefault();
    if (pending) return;
    pending = true;
    status.textContent = "Открываю Telegram в браузере…";
    try {
      await astra.callBackend("open_author_telegram", {});
      status.textContent = "Ссылка передана браузеру.";
    } catch {
      status.textContent = "Не удалось открыть ссылку. Перезапусти плагин или открой https://t.me/super_ded_kot в браузере.";
    } finally {
      pending = false;
    }
  });
})();