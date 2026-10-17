// 이동 알림 토스트 (FR-6). 드라이브 스타일과 격리하려고 Shadow DOM으로 렌더링한다.
// 드라이브는 Trusted Types를 강제하므로 innerHTML 없이 DOM API로만 만든다.
const TOAST_VISIBLE_MS = 2500;
const TOAST_FADE_MS = 200;

const toast = (() => {
  const STYLE = `
    :host {
      all: initial;
      position: fixed;
      left: 50%;
      bottom: 32px;
      transform: translateX(-50%);
      z-index: 2147483647;
      pointer-events: none;
    }
    .toast {
      padding: 10px 18px;
      border-radius: 8px;
      background: rgba(32, 33, 36, 0.92);
      color: #fff;
      font: 500 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      opacity: 0;
      transform: translateY(8px);
      transition: opacity ${TOAST_FADE_MS}ms ease, transform ${TOAST_FADE_MS}ms ease;
    }
    .toast.show {
      opacity: 1;
      transform: none;
    }
  `;

  let host = null;
  let timers = [];

  function clear() {
    timers.forEach(clearTimeout);
    timers = [];
    host?.remove();
    host = null;
  }

  function show(message) {
    clear();
    host = document.createElement('div');
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = STYLE;
    const box = document.createElement('div');
    box.className = 'toast';
    box.setAttribute('role', 'status');
    box.textContent = message;
    root.append(style, box);
    document.documentElement.append(host);

    requestAnimationFrame(() => box.classList.add('show'));
    timers.push(setTimeout(() => box.classList.remove('show'), TOAST_VISIBLE_MS));
    timers.push(setTimeout(clear, TOAST_VISIBLE_MS + TOAST_FADE_MS));
  }

  return { show };
})();
