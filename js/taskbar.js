const Taskbar = {
  el: null,
  windowsContainer: null,
  startButton: null,
  startMenu: null,
  clockEl: null,
  langLabel: null,
  themeIcon: null,
  previewEl: null,

  windowButtons: {}, // id -> { el, windowId }

  init() {
    this.el = document.getElementById('taskbar');
    this.windowsContainer = document.getElementById('taskbar-windows');
    this.startButton = document.getElementById('start-button');
    this.startMenu = document.getElementById('start-menu');
    // New start menu utility elements
    this.suClock = document.getElementById('su-clock');
    this.suLangBtn = document.getElementById('su-lang');
    this.suLangLabel = document.getElementById('su-lang-label');

    this.buildStartMenu();
    this.bindEvents();
    this.startClock();
  },

  /* ─── Start Menu ─── */
  buildStartMenu() {
    const itemsContainer = document.getElementById('start-menu-items');
    itemsContainer.innerHTML = '';

    for (const item of START_MENU_ITEMS) {
      let label = currentLang === 'en'
        ? (item.labelEn || item.id)
        : (item.label || item.id);
      let icon = item.icon;
      if (item.action === 'toggleSound') {
        label = Sound?.enabled
          ? (currentLang === 'en' ? 'Mute Sounds' : '关闭音效')
          : (currentLang === 'en' ? 'Enable Sounds' : '开启音效');
        icon = Sound?.enabled ? '♪' : '×';
      }

      const el = createEl('button', {
        className: 'menu-item',
        type: 'button',
        'data-action': item.action,
      }, [
        createEl('span', { className: 'sm-icon', textContent: icon }),
        createEl('span', { textContent: label }),
      ]);
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        this.runStartAction(item);
        this.toggleStartMenu(false);
      });
      itemsContainer.appendChild(el);
    }
  },

  runStartAction(item) {
    switch (item.action) {
      case 'openChat':
        Chat?.open?.();
        break;
      case 'terminal':
        EasterEggs?.toggleCommandLine?.(true);
        break;
      case 'achievements':
        EasterEggs?.toggleAchievements?.(true);
        break;
      case 'ticketVerify':
        TicketVerifier?.open?.();
        break;
      case 'toggleSound': {
        const enabled = Sound?.toggle?.();
        Character?.say?.(
          enabled
            ? (currentLang === 'en' ? 'Audio link restored.' : '音频链路已恢复。')
            : (currentLang === 'en' ? 'Audio link muted.' : '音频链路已静音。'),
          2200
        );
        this.buildStartMenu();
        break;
      }
      case 'fullscreen':
        EasterEggs?.triggerEasterEgg?.('fullscreen');
        break;
      case 'openWindow':
        EventBus.emit('desktop:open-window', item.windowType);
        break;
    }
  },

  updateStartMenuLabels() {
    const items = this.startMenu.querySelectorAll('.start-menu-items .menu-item');
    START_MENU_ITEMS.forEach((item, i) => {
      if (items[i]) {
        const labelSpan = items[i].querySelector('span:last-child');
        if (labelSpan) {
          labelSpan.textContent = currentLang === 'en'
            ? (item.labelEn || item.id)
            : (item.label || item.id);
        }
      }
    });
    // Update nickname
    const nickname = document.getElementById('start-nickname');
    if (nickname) {
      // Load from profile if available
    }
  },

  toggleStartMenu(show) {
    const isHidden = this.startMenu.classList.contains('hidden');
    if (show === undefined) show = isHidden;

    if (show) {
      this.buildStartMenu();
      this.startMenu.classList.remove('hidden');
      this.startButton.classList.add('active');
    } else {
      this.startMenu.classList.add('hidden');
      this.startButton.classList.remove('active');
    }
  },

  /* ─── Event Binding ─── */
  bindEvents() {
    // Start button
    this.startButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleStartMenu();
    });

    // Close start menu on outside click
    document.addEventListener('click', (e) => {
      if (!this.startMenu.contains(e.target) && e.target !== this.startButton && !this.startButton.contains(e.target)) {
        this.toggleStartMenu(false);
      }
    });

    // Window events
    EventBus.on('window:opened', (data) => this.addWindowButton(data));
    EventBus.on('window:closed', (data) => this.removeWindowButton(data));
    EventBus.on('window:minimized', (data) => this.updateButtonState(data.id, 'minimized'));
    EventBus.on('window:restored', (data) => this.updateButtonState(data.id, 'normal'));
    EventBus.on('window:focused', (data) => this.setActiveButton(data.id));

    // Language toggle (start menu utility)
    if (this.suLangBtn) {
      this.suLangBtn.addEventListener('click', () => {
        const newLang = currentLang === 'zh' ? 'en' : 'zh';
        setLang(newLang);
        if (this.suLangLabel) this.suLangLabel.textContent = newLang === 'zh' ? '中' : 'EN';
        EventBus.emit('lang:changed', newLang);
      });
    }

    // Theme toggle (start menu utility)
    // Restore initial language
    const savedLang = loadSetting('lang', 'zh');
    setLang(savedLang);
    if (this.suLangLabel) this.suLangLabel.textContent = savedLang === 'zh' ? '中' : 'EN';

    // Listen for i18n updates
    EventBus.on('lang:changed', () => {
      this.buildStartMenu();
      this.updateAllButtonLabels();
    });

    // Listen for easter egg counter updates
    EventBus.on('easteregg:found', (data) => {
      this.updateEggCounter();
    });
  },

  /* ─── Window Buttons ─── */
  addWindowButton(data) {
    const { id, type, title } = data;
    const def = DESKTOP_ICONS.find(d => d.windowType === type);
    const icon = def ? def.icon : '📄';
    const label = currentLang === 'en' ? (def?.labelEn || type) : (def?.label || type);

    const btn = createEl('button', {
      className: 'taskbar-window-btn active',
      'data-window-id': id,
    }, [
      createEl('span', { className: 'tw-icon', textContent: icon }),
      createEl('span', { className: 'tw-label', textContent: label }),
    ]);

    btn.addEventListener('click', () => {
      const w = WindowManager.windows[id];
      if (w) {
        if (w.state === 'minimized') {
          WindowManager.restoreWindow(id);
        } else if (WindowManager.activeWindowId === id) {
          WindowManager.minimizeWindow(id);
        } else {
          WindowManager.focusWindow(id);
        }
      }
    });

    // Hover preview
    btn.addEventListener('mouseenter', (e) => this.showPreview(e, id));
    btn.addEventListener('mouseleave', () => this.hidePreview());

    this.windowsContainer.appendChild(btn);
    this.windowButtons[id] = { el: btn, windowId: id };
  },

  removeWindowButton(data) {
    const { id } = data;
    const entry = this.windowButtons[id];
    if (entry) {
      entry.el.remove();
      delete this.windowButtons[id];
    }
  },

  updateButtonState(id, state) {
    const entry = this.windowButtons[id];
    if (entry) {
      entry.el.classList.toggle('active', state !== 'minimized');
    }
  },

  setActiveButton(id) {
    for (const [bid, entry] of Object.entries(this.windowButtons)) {
      entry.el.classList.toggle('active', bid === id);
    }
  },

  updateAllButtonLabels() {
    for (const [id, entry] of Object.entries(this.windowButtons)) {
      const w = WindowManager.windows[id];
      if (w) {
        const def = DESKTOP_ICONS.find(d => d.windowType === w.type);
        const labelEl = entry.el.querySelector('.tw-label');
        if (labelEl && def) {
          labelEl.textContent = currentLang === 'en' ? def.labelEn : def.label;
        }
      }
    }
  },

  /* ─── Thumbnail Preview ─── */
  showPreview(e, id) {
    this.hidePreview();
    const w = WindowManager.windows[id];
    if (!w || w.state === 'minimized') return;

    const btn = e.target.closest('.taskbar-window-btn');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();

    this.previewEl = createEl('div', {
      className: 'taskbar-preview',
      style: {
        left: (rect.left + rect.width / 2 - 100) + 'px',
      },
      textContent: w.title,
    });
    document.body.appendChild(this.previewEl);
  },

  hidePreview() {
    if (this.previewEl) {
      this.previewEl.remove();
      this.previewEl = null;
    }
  },

  /* ─── Clock ─── */
  startClock() {
    const update = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const el = this.suClock || this.clockEl;
      if (el) el.textContent = h + ':' + m;

      // Viewport HUD: P3R-sized time in the dark wedge above the panel.
      const hudHour = document.getElementById('hud-hour');
      const hudMinute = document.getElementById('hud-minute');
      const hudDate = document.getElementById('hud-date');
      const hudWeekday = document.getElementById('hud-weekday');
      if (hudHour) hudHour.textContent = h;
      if (hudMinute) hudMinute.textContent = m;
      if (hudDate) {
        hudDate.textContent = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, '0'),
          String(now.getDate()).padStart(2, '0'),
        ].join('.');
      }
      if (hudWeekday) {
        const weekdays = currentLang === 'en'
          ? ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY']
          : ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
        hudWeekday.textContent = weekdays[now.getDay()];
      }

      // Hourly chime
      if (now.getMinutes() === 0 && now.getSeconds() === 0) {
        EventBus.emit('time:hourly', now.getHours());
      }

      // Midnight detection
      if (now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() < 5) {
        EventBus.emit('time:midnight');
      }
    };
    update();
    setInterval(update, 1000);
  },

  /* ─── Easter Egg Counter ─── */
  updateEggCounter() {
    const counter = document.getElementById('egg-counter');
    if (counter) {
      const catalog = CORE_ACHIEVEMENT_IDS;
      const found = loadSetting('found_eggs', []).filter((id) => catalog.includes(id)).length;
      const total = catalog.length;
      counter.textContent = `◆ ${t('easterEggs')} ${found}/${total}`;
    }
  },
};
