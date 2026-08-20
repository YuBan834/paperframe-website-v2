/* Pointer-driven atmosphere for the memory operating system.
   Motion stays cosmetic: no interaction target or application state depends on it. */
(function () {
  const root = document.documentElement;
  let frame = 0;
  let latestEvent = null;
  let wakeTimer = 0;
  let pointerContent = null;
  let awakenedContent = null;

  function paintPointer() {
    frame = 0;
    const event = latestEvent;
    if (!event) return;

    const viewportX = Math.max(0, Math.min(1, event.clientX / Math.max(1, window.innerWidth)));
    const viewportY = Math.max(0, Math.min(1, event.clientY / Math.max(1, window.innerHeight)));
    root.style.setProperty('--memory-pointer-x', `${(viewportX * 100).toFixed(2)}%`);
    root.style.setProperty('--memory-pointer-y', `${(viewportY * 100).toFixed(2)}%`);

    const target = event.target instanceof Element ? event.target : null;
    const windowContent = target?.closest('.window-content') || null;
    if (pointerContent && pointerContent !== windowContent) {
      pointerContent.classList.remove('is-pointer-awake');
    }
    pointerContent = windowContent;
    if (!windowContent) return;

    const rect = windowContent.getBoundingClientRect();
    const localX = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
    const localY = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)));
    windowContent.style.setProperty('--window-pointer-x', `${(localX * 100).toFixed(2)}%`);
    windowContent.style.setProperty('--window-pointer-y', `${(localY * 100).toFixed(2)}%`);
    windowContent.classList.add('is-pointer-awake');
  }

  document.addEventListener('pointermove', (event) => {
    latestEvent = event;
    if (!frame) frame = requestAnimationFrame(paintPointer);
  }, { passive: true });

  document.addEventListener('pointerleave', () => {
    pointerContent?.classList.remove('is-pointer-awake');
    pointerContent = null;
  });

  document.addEventListener('pointerdown', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const content = target?.closest('.window-content');
    if (!content) return;
    const rect = content.getBoundingClientRect();
    const pulse = document.createElement('i');
    pulse.className = 'memory-touch-pulse';
    pulse.style.left = `${event.clientX - rect.left}px`;
    pulse.style.top = `${event.clientY - rect.top}px`;
    content.appendChild(pulse);
    pulse.addEventListener('animationend', () => pulse.remove(), { once: true });

    if (awakenedContent && awakenedContent !== content) {
      awakenedContent.classList.remove('is-memory-awake');
    }
    awakenedContent = content;
    content.classList.add('is-memory-awake');
    clearTimeout(wakeTimer);
    wakeTimer = setTimeout(() => {
      content.classList.remove('is-memory-awake');
      if (awakenedContent === content) awakenedContent = null;
    }, 720);
  });
})();
