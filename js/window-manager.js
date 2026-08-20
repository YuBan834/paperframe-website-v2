const WindowManager = {
  windows: {},       // id -> { el, type, title, state }
  zIndexCounter: 20,
  activeWindowId: null,

  // Aero Shake detection
  shakeHistory: [],
  shakeThreshold: 4,   // direction changes
  shakeTimeWindow: 500, // ms

  init() {
    EventBus.on('desktop:open-window', (type) => this.openWindow(type));
    EventBus.on('window:minimize-all', () => this.minimizeAll());
    EventBus.on('window:close-all', () => this.closeAll());
    window.addEventListener('resize', debounce(() => {
      this.keepWindowsInBounds();
      this.updateCharacterAvoidance();
    }, 100));
  },

  openWindow(type) {
    // If window already exists, focus it
    const existingId = Object.keys(this.windows).find(id => this.windows[id].type === type);
    if (existingId) {
      this.focusWindow(existingId);
      // If minimized, restore
      const w = this.windows[existingId];
      if (w.state === 'minimized') {
        this.restoreWindow(existingId);
      }
      return existingId;
    }

    const id = 'win-' + type + '-' + Date.now();
    const titleDef = DESKTOP_ICONS.find(d => d.windowType === type);
    const title = titleDef ? (currentLang === 'en' ? titleDef.labelEn : titleDef.label) : type;
    const icon = titleDef ? titleDef.icon : '📄';

    // Viewport-level windows open in the left/centre safe area. They are not
    // children of the Academy panel's visual perspective.
    const openCount = Object.keys(this.windows).length;
    const desiredWidth = type === 'timeline' ? WINDOW_CONFIG.timelineWidth
      : type === 'works' ? 720 : WINDOW_CONFIG.defaultWidth;
    const desiredHeight = type === 'timeline' ? WINDOW_CONFIG.timelineHeight : WINDOW_CONFIG.defaultHeight;
    const windowWidth = Math.max(WINDOW_CONFIG.minWidth, Math.min(desiredWidth, window.innerWidth - 40));
    const windowHeight = Math.max(WINDOW_CONFIG.minHeight, Math.min(desiredHeight, window.innerHeight - 90));
    const safeRight = window.innerWidth * 0.68;
    const cascade = (openCount % 4) * 24;
    const offsetX = Math.max(24, Math.min(window.innerWidth * 0.21 + cascade, safeRight - windowWidth));
    const offsetY = Math.max(54, Math.min(window.innerHeight * 0.15 + cascade, window.innerHeight - windowHeight - 24));

    const el = createEl('div', {
      className: 'desktop-window window-opening',
      'data-window-id': id,
      'data-window-type': type,
      style: {
        left: offsetX + 'px',
        top: offsetY + 'px',
        width: windowWidth + 'px',
        height: windowHeight + 'px',
      },
    }, [
      // Title bar
      createEl('div', { className: 'window-titlebar' }, [
        createEl('span', { className: 'window-title-icon', textContent: icon }),
        createEl('span', { className: 'window-title-text', textContent: title }),
        createEl('div', { className: 'window-title-actions' }, [
          createEl('button', { className: 'window-btn minimize', title: t('windowMin'), textContent: '─' }),
          createEl('button', { className: 'window-btn maximize', title: t('windowMax'), textContent: '□' }),
          createEl('button', { className: 'window-btn close', title: t('windowClose'), textContent: '✕' }),
        ]),
      ]),
      // Content
      createEl('div', { className: 'window-content', 'data-content-for': type }, [
        createEl('div', { style: { textAlign: 'center', padding: '40px', color: 'var(--window-text-secondary)' } }, [
          t('loading') + '...',
        ]),
      ]),
      // Resize handles
      ...['n','s','e','w','ne','nw','se','sw'].map(dir =>
        createEl('div', { className: 'window-resize-handle window-resize-' + dir })
      ),
    ]);

    this.container().appendChild(el);

    // Store window data
    this.windows[id] = { el, type, title, state: 'normal' };
    this.activeWindowId = id;
    this.zIndexCounter++;
    el.style.zIndex = this.zIndexCounter;

    // Bind events
    this.bindWindowEvents(id);

    // Remove opening animation class
    setTimeout(() => el.classList.remove('window-opening'), 250);

    // Load module content
    this.loadModuleContent(id, type);

    // Notify taskbar
    EventBus.emit('window:opened', { id, type, title });
    Sound?.play?.('windowOpen');
    this.updateCharacterAvoidance();

    return id;
  },

  container() {
    return document.getElementById('desktop');
  },

  bindWindowEvents(id) {
    const w = this.windows[id];
    if (!w) return;
    const el = w.el;

    // Title bar drag
    const titlebar = el.querySelector('.window-titlebar');
    let dragStartX, dragStartY, origLeft, origTop, isDragging = false;

    titlebar.addEventListener('mousedown', (e) => {
      if (e.target.closest('.window-title-actions')) return; // Don't drag from buttons
      if (e.button !== 0) return;
      if (window.matchMedia('(max-width: 760px)').matches) {
        this.focusWindow(id);
        return;
      }

      this.focusWindow(id);
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      origLeft = parseInt(el.style.left) || 0;
      origTop = parseInt(el.style.top) || 0;
      isDragging = true;

      // Shake detection
      this.recordShake(e.clientX, e.clientY);

      const onMove = (ev) => {
        if (!isDragging) return;
        const dx = ev.clientX - dragStartX;
        const dy = ev.clientY - dragStartY;
        let newLeft = origLeft + dx;
        let newTop = origTop + dy;

        // Snap to edges
        if (Math.abs(newLeft) < WINDOW_CONFIG.snapThreshold) newLeft = 0;
        if (Math.abs(newTop) < WINDOW_CONFIG.snapThreshold) newTop = 0;
        // Snap to right
        if (Math.abs(newLeft + el.offsetWidth - window.innerWidth) < WINDOW_CONFIG.snapThreshold) {
          newLeft = window.innerWidth - el.offsetWidth;
        }
        // Snap to top → maximize
        if (newTop < -10) {
          this.maximizeWindow(id);
          isDragging = false;
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          return;
        }

        el.style.left = newLeft + 'px';
        el.style.top = newTop + 'px';
        this.updateCharacterAvoidance();

        // Shake detection
        this.recordShake(ev.clientX, ev.clientY);
      };

      const onUp = () => {
        isDragging = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);

        // Check if dropped near edges for half-screen snapping
        const rect = el.getBoundingClientRect();
        if (rect.left < 0 && rect.right < window.innerWidth) {
          // Snap left half
          el.style.left = '0px';
          el.style.top = '0px';
          el.style.width = (window.innerWidth / 2) + 'px';
          el.style.height = 'calc(100% - var(--taskbar-height))';
        } else if (rect.right > window.innerWidth && rect.left > 0) {
          // Snap right half
          el.style.left = (window.innerWidth / 2) + 'px';
          el.style.top = '0px';
          el.style.width = (window.innerWidth / 2) + 'px';
          el.style.height = 'calc(100% - var(--taskbar-height))';
        }
        this.updateCharacterAvoidance();
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // Button actions
    el.querySelector('.window-btn.minimize').addEventListener('click', () => this.minimizeWindow(id));
    el.querySelector('.window-btn.maximize').addEventListener('click', () => this.toggleMaximize(id));
    el.querySelector('.window-btn.close').addEventListener('click', () => this.closeWindow(id));

    // Click to focus
    el.addEventListener('mousedown', () => this.focusWindow(id));

    // Resize
    el.querySelectorAll('.window-resize-handle').forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.matchMedia('(max-width: 760px)').matches) return;
        const dir = handle.className.replace('window-resize-handle window-resize-', '');
        this.startResize(id, dir, e.clientX, e.clientY);
      });
    });
  },

  focusWindow(id) {
    const w = this.windows[id];
    if (!w) return;

    this.activeWindowId = id;
    this.zIndexCounter++;
    if (this.zIndexCounter > 60) {
      this.zIndexCounter = 21;
      Object.values(this.windows).forEach((win, index) => { win.el.style.zIndex = 20 + index; });
    }
    w.el.style.zIndex = this.zIndexCounter;

    // Update active class
    for (const [wid, win] of Object.entries(this.windows)) {
      win.el.classList.toggle('active', wid === id);
    }

    EventBus.emit('window:focused', { id });
    this.updateCharacterAvoidance();
  },

  minimizeWindow(id) {
    const w = this.windows[id];
    if (!w || w.state === 'minimized') return;

    w.el.classList.add('window-minimizing');
    w.state = 'minimized';
    w._prevDisplay = w.el.style.display;
    w._prevLeft = w.el.style.left;
    w._prevTop = w.el.style.top;
    w._prevWidth = w.el.style.width;
    w._prevHeight = w.el.style.height;

    setTimeout(() => {
      w.el.style.display = 'none';
      w.el.classList.remove('window-minimizing');
    }, 400);

    EventBus.emit('window:minimized', { id, type: w.type });
    setTimeout(() => this.updateCharacterAvoidance(), 410);
  },

  restoreWindow(id) {
    const w = this.windows[id];
    if (!w || w.state !== 'minimized') return;

    w.el.style.display = '';
    w.el.style.left = w._prevLeft || '100px';
    w.el.style.top = w._prevTop || '60px';
    w.el.style.width = w._prevWidth || WINDOW_CONFIG.defaultWidth + 'px';
    w.el.style.height = w._prevHeight || WINDOW_CONFIG.defaultHeight + 'px';
    w.state = 'normal';
    w.el.classList.add('window-opening');
    setTimeout(() => w.el.classList.remove('window-opening'), 250);

    this.focusWindow(id);
    EventBus.emit('window:restored', { id, type: w.type });
    this.updateCharacterAvoidance();
  },

  toggleMaximize(id) {
    const w = this.windows[id];
    if (!w) return;

    if (w.state === 'maximized') {
      // Restore
      w.el.classList.remove('maximized');
      w.el.style.left = (w._restoreLeft || 100) + 'px';
      w.el.style.top = (w._restoreTop || 60) + 'px';
      w.el.style.width = (w._restoreWidth || WINDOW_CONFIG.defaultWidth) + 'px';
      w.el.style.height = (w._restoreHeight || WINDOW_CONFIG.defaultHeight) + 'px';
      w.state = 'normal';
      w.el.querySelector('.window-btn.maximize').textContent = '□';
    } else {
      // Maximize
      w._restoreLeft = parseInt(w.el.style.left) || 100;
      w._restoreTop = parseInt(w.el.style.top) || 60;
      w._restoreWidth = parseInt(w.el.style.width) || WINDOW_CONFIG.defaultWidth;
      w._restoreHeight = parseInt(w.el.style.height) || WINDOW_CONFIG.defaultHeight;
      w.el.classList.add('maximized');
      w.state = 'maximized';
      w.el.querySelector('.window-btn.maximize').textContent = '❐';
    }
    this.updateCharacterAvoidance();
  },

  maximizeWindow(id) {
    const w = this.windows[id];
    if (!w || w.state === 'maximized') return;
    this.toggleMaximize(id);
  },

  closeWindow(id) {
    const w = this.windows[id];
    if (!w) return;

    // Fragment effect
    this.createCloseFragments(w.el);

    w.el.classList.add('window-closing');
    setTimeout(() => {
      w.el.remove();
      delete this.windows[id];
      if (this.activeWindowId === id) {
        this.activeWindowId = Object.keys(this.windows).pop() || null;
        if (this.activeWindowId) this.focusWindow(this.activeWindowId);
      }
      this.updateCharacterAvoidance();
    }, 250);

    EventBus.emit('window:closed', { id, type: w.type });
    Sound?.play?.('windowClose');
  },

  createCloseFragments(el) {
    const rect = el.getBoundingClientRect();
    const count = 12;
    for (let i = 0; i < count; i++) {
      const frag = document.createElement('div');
      frag.className = 'window-fragment';
      frag.style.left = (rect.left + rect.width / 2) + 'px';
      frag.style.top = (rect.top + rect.height / 2) + 'px';
      const angle = (i / count) * Math.PI * 2;
      const dist = rand(30, 80);
      frag.style.setProperty('--fx', Math.cos(angle) * dist + 'px');
      frag.style.setProperty('--fy', Math.sin(angle) * dist + 'px');
      document.body.appendChild(frag);
      setTimeout(() => frag.remove(), 600);
    }
  },

  minimizeAll() {
    for (const id of Object.keys(this.windows)) {
      const w = this.windows[id];
      if (w.state !== 'minimized') this.minimizeWindow(id);
    }
  },

  closeAll() {
    for (const id of Object.keys(this.windows)) {
      this.closeWindow(id);
    }
  },

  /* ─── Resize ─── */
  startResize(id, dir, startX, startY) {
    const w = this.windows[id];
    if (!w || w.state === 'maximized') return;
    const el = w.el;
    const origRect = el.getBoundingClientRect();

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      let newLeft = origRect.left;
      let newTop = origRect.top;
      let newWidth = origRect.width;
      let newHeight = origRect.height;

      if (dir.includes('e')) newWidth = Math.max(WINDOW_CONFIG.minWidth, origRect.width + dx);
      if (dir.includes('w')) {
        newWidth = Math.max(WINDOW_CONFIG.minWidth, origRect.width - dx);
        newLeft = origRect.right - newWidth;
      }
      if (dir.includes('s')) newHeight = Math.max(WINDOW_CONFIG.minHeight, origRect.height + dy);
      if (dir.includes('n')) {
        newHeight = Math.max(WINDOW_CONFIG.minHeight, origRect.height - dy);
        newTop = origRect.bottom - newHeight;
      }

      el.style.left = newLeft + 'px';
      el.style.top = newTop + 'px';
      el.style.width = newWidth + 'px';
      el.style.height = newHeight + 'px';
      this.updateCharacterAvoidance();
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  },

  /* ─── Character / viewport window relationship ─── */
  updateCharacterAvoidance() {
    const active = this.activeWindowId ? this.windows[this.activeWindowId] : null;
    if (!active || active.state === 'minimized' || active.el.style.display === 'none') {
      document.body.classList.remove('character-yielding');
      return;
    }

    const rect = active.el.getBoundingClientRect();
    const characterZoneLeft = window.innerWidth * 0.64;
    const overlapsCharacterZone = rect.right > characterZoneLeft && rect.left < window.innerWidth * 0.96;
    document.body.classList.toggle('character-yielding', overlapsCharacterZone || active.state === 'maximized');
  },

  keepWindowsInBounds() {
    Object.values(this.windows).forEach((w) => {
      if (w.state === 'maximized' || w.state === 'minimized') return;
      const width = Math.min(w.el.offsetWidth, window.innerWidth - 24);
      const height = Math.min(w.el.offsetHeight, window.innerHeight - 24);
      w.el.style.width = width + 'px';
      w.el.style.height = height + 'px';
      w.el.style.left = clamp(parseFloat(w.el.style.left) || 12, 12, Math.max(12, window.innerWidth - width - 12)) + 'px';
      w.el.style.top = clamp(parseFloat(w.el.style.top) || 12, 12, Math.max(12, window.innerHeight - height - 12)) + 'px';
    });
  },

  /* ─── Shake Detection ─── */
  recordShake(x, y) {
    const now = Date.now();
    this.shakeHistory.push({ x, y, time: now });

    // Remove old entries
    this.shakeHistory = this.shakeHistory.filter(e => now - e.time < this.shakeTimeWindow);

    // Count direction changes
    if (this.shakeHistory.length > this.shakeThreshold) {
      let changes = 0;
      for (let i = 2; i < this.shakeHistory.length; i++) {
        const dx1 = this.shakeHistory[i-1].x - this.shakeHistory[i-2].x;
        const dx2 = this.shakeHistory[i].x - this.shakeHistory[i-1].x;
        if (Math.sign(dx1) !== Math.sign(dx2) && Math.abs(dx1) > 8 && Math.abs(dx2) > 8) {
          changes++;
        }
      }
      if (changes >= this.shakeThreshold) {
        this.shakeHistory = [];
        EventBus.emit('window:aero-shake');
      }
    }
  },

  /* ─── Module Content Loading ─── */
  async loadModuleContent(id, type) {
    const w = this.windows[id];
    if (!w) return;
    const contentEl = w.el.querySelector('.window-content');
    if (!contentEl) return;

    try {
      switch (type) {
        case 'about':
          await Modules.About.render(contentEl);
          break;
        case 'timeline':
          await Modules.Timeline.render(contentEl);
          break;
        case 'works':
          await Modules.Works.render(contentEl);
          break;
        case 'changelog':
          await Modules.Changelog.render(contentEl);
          break;
        case 'contact':
          Modules.Contact.render(contentEl);
          break;
        case 'signal':
          await Modules.Signal.render(contentEl);
          break;
        default:
          contentEl.innerHTML = '<p>Unknown module</p>';
      }
    } catch (err) {
      console.error('Failed to load module:', type, err);
      contentEl.replaceChildren(createEl('p', {
        textContent: `加载失败: ${String(err?.message || 'unknown error')}`,
        style: { color: 'red' },
      }));
    }
  },
};
