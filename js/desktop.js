const Desktop = {
  container: null,
  iconsContainer: null,
  icons: {},       // id -> DOM element
  selectedIcons: new Set(),
  iconPositions: {}, // id -> {x, y}

  // Selection state
  isSelecting: false,
  selectStartX: 0,
  selectStartY: 0,

  // Context menu
  contextMenu: null,

  init() {
    this.container = document.getElementById('desktop');
    this.iconsContainer = document.getElementById('desktop-icons');
    this.initBackgroundPanel();
    this.loadPositions();
    this.renderIcons();
    this.bindDesktopEvents();
    this.bindGlobalEvents();
  },

  /* ─── Background Panel ─── */
  initBackgroundPanel() {
    const panelWallpaper = document.getElementById('panel-wallpaper');
    if (panelWallpaper) {
      panelWallpaper.style.backgroundImage = 'url(assets/images/wallpaper/academy-city-panel.png)';
    }
    // Set page body to dark background behind the tilted panel
    document.body.style.background = '#080e1a';
    document.body.style.backgroundSize = 'unset';
    document.body.style.backgroundPosition = 'unset';
    document.body.style.backgroundAttachment = 'unset';

    // Store panel ref for parallax
    this.panel = document.getElementById('background-panel');
  },

  /* ─── Icon Rendering ─── */
  renderIcons() {
    this.iconsContainer.innerHTML = '';
    const positions = this.computeDefaultPositions();

    for (const def of DESKTOP_ICONS) {
      const pos = positions[def.id] || { x: 24, y: 24 };

      const label = currentLang === 'en' ? def.labelEn : def.label;
      const iconEl = createEl('button', {
        className: 'desktop-icon',
        type: 'button',
        'aria-label': label,
        'data-id': def.id,
        style: { left: pos.x + 'px', top: pos.y + 'px' },
      }, [
        createEl('div', { className: 'icon-image' }, [def.icon]),
        createEl('span', { className: 'icon-label', textContent: label }),
      ]);

      // Click to select
      iconEl.addEventListener('mousedown', (e) => this.onIconMouseDown(e, def.id));
      // Double click to open window
      iconEl.addEventListener('dblclick', () => {
        EventBus.emit('desktop:open-window', def.windowType);
      });
      iconEl.addEventListener('click', (event) => {
        if (event.detail === 0 || window.matchMedia('(pointer: coarse)').matches) {
          EventBus.emit('desktop:open-window', def.windowType);
        }
      });

      this.iconsContainer.appendChild(iconEl);
      this.icons[def.id] = iconEl;
    }
  },

  computeDefaultPositions() {
    const positions = {};
    const startX = 24;
    const compact = window.matchMedia('(max-width: 760px)').matches;
    const startY = compact
      ? Math.max(158, Math.round(window.innerHeight * 0.21))
      : Math.max(76, Math.round(window.innerHeight * 0.105));
    const surfaceHeight = this.iconsContainer?.clientHeight || window.innerHeight;
    const available = Math.max(280, surfaceHeight - startY - 82);
    const gapY = clamp(
      available / Math.max(1, DESKTOP_ICONS.length - 1),
      compact ? 62 : 58,
      compact ? 108 : 94
    );

    DESKTOP_ICONS.forEach((def, i) => {
      positions[def.id] = { x: startX, y: startY + i * gapY };
    });
    return positions;
  },

  loadPositions() {
    // The numbered memory entries are part of the composition, not loose
    // desktop files. Discard positions saved by older draggable versions.
    this.iconPositions = {};
    saveSetting('icon_positions', {});
    saveSetting('icon_layout_version', 4);
  },

  savePositions() {
    saveSetting('icon_positions', this.iconPositions);
  },

  /* ─── Icon Mouse Events ─── */
  onIconMouseDown(e, id) {
    if (e.button !== 0) return;
    e.stopPropagation();

    // Selection handling
    if (!e.ctrlKey && !e.metaKey) {
      this.clearSelection();
    }
    if (e.ctrlKey || e.metaKey) {
      if (this.selectedIcons.has(id)) {
        this.selectedIcons.delete(id);
        this.icons[id].classList.remove('selected');
      } else {
        this.selectedIcons.add(id);
        this.icons[id].classList.add('selected');
      }
    } else {
      this.selectedIcons.add(id);
      this.icons[id].classList.add('selected');
    }

  },

  /* ─── Selection ─── */
  clearSelection() {
    for (const id of this.selectedIcons) {
      if (this.icons[id]) this.icons[id].classList.remove('selected');
    }
    this.selectedIcons.clear();
  },

  /* ─── Desktop Events ─── */
  bindDesktopEvents() {
    const isDesktopSurface = (target) => target === this.container ||
      target === this.iconsContainer ||
      target === this.panel ||
      target.id === 'panel-wallpaper' ||
      target.id === 'panel-particles' ||
      target.id === 'scene-floor';

    // Click on desktop to clear selection or check colored dots
    this.container.addEventListener('mousedown', (e) => {
      // Check if click hits a colored easter egg dot (panel-local coords)
      if (Particles && Particles.checkDotClick) {
        const panel = document.getElementById('background-panel');
        const pr = panel ? panel.getBoundingClientRect() : { left: 0, top: 0 };
        if (Particles.checkDotClick(e.clientX - pr.left, e.clientY - pr.top)) return;
      }
      if (isDesktopSurface(e.target)) {
        if (e.button === 0) {
          this.clearSelection();
          this.isSelecting = true;
          this.selectStartX = e.clientX;
          this.selectStartY = e.clientY;
          const rect = document.getElementById('selection-rect');
          rect.style.left = this.selectStartX + 'px';
          rect.style.top = this.selectStartY + 'px';
          rect.style.width = '0';
          rect.style.height = '0';
          rect.style.display = 'block';
        }
      }
    });

    // Right-click is a contextual Mental Scan, never a generic OS menu.
    this.container.addEventListener('contextmenu', (e) => {
      if (!isDesktopSurface(e.target) && !e.target.closest('#background-panel')) return;
      e.preventDefault();
      this.activateMentalScan(e.clientX, e.clientY);
    });

    // Double-click → constellation
    this.container.addEventListener('dblclick', (e) => {
      if (isDesktopSurface(e.target)) {
        EventBus.emit('desktop:dblclick');
      }
    });

  },

  bindGlobalEvents() {
    // Selection rectangle
    document.addEventListener('mousemove', (e) => {
      if (!this.isSelecting) return;
      const rect = document.getElementById('selection-rect');
      const x1 = this.selectStartX;
      const y1 = this.selectStartY;
      const x2 = e.clientX;
      const y2 = e.clientY;
      rect.style.left = Math.min(x1, x2) + 'px';
      rect.style.top = Math.min(y1, y2) + 'px';
      rect.style.width = Math.abs(x2 - x1) + 'px';
      rect.style.height = Math.abs(y2 - y1) + 'px';

      // Highlight icons inside selection
      const selRect = rect.getBoundingClientRect();
      for (const [id, el] of Object.entries(this.icons)) {
        const iconRect = el.getBoundingClientRect();
        if (iconRect.left >= selRect.left && iconRect.right <= selRect.right &&
            iconRect.top >= selRect.top && iconRect.bottom <= selRect.bottom) {
          this.selectedIcons.add(id);
          el.classList.add('selected');
        } else if (!e.ctrlKey) {
          this.selectedIcons.delete(id);
          el.classList.remove('selected');
        }
      }
    });

    document.addEventListener('mouseup', () => {
      if (this.isSelecting) {
        this.isSelecting = false;
        const rect = document.getElementById('selection-rect');
        rect.style.display = 'none';
      }
    });

    // Language change → re-render labels
    EventBus.on('lang:changed', () => this.updateLabels());
    window.addEventListener('resize', debounce(() => {
      const positions = this.computeDefaultPositions();
      for (const [id, element] of Object.entries(this.icons)) {
        const position = positions[id];
        if (!position) continue;
        element.style.left = `${position.x}px`;
        element.style.top = `${position.y}px`;
      }
    }, 120));
  },

  updateLabels() {
    for (const def of DESKTOP_ICONS) {
      const el = this.icons[def.id];
      if (el) {
        const label = el.querySelector('.icon-label');
        if (label) label.textContent = currentLang === 'en' ? def.labelEn : def.label;
      }
    }
  },

  activateMentalScan(x, y) {
    const pulse = createEl('span', {
      className: 'mental-scan-pulse',
      style: { left: `${x}px`, top: `${y}px` },
    });
    this.container.appendChild(pulse);
    setTimeout(() => pulse.remove(), 1100);
    EventBus.emit('mental:scan', { x, y });

    const candidates = [...document.querySelectorAll('.memory-node')];
    const nearest = candidates
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          node,
          distance: Math.hypot(rect.left + rect.width / 2 - x, rect.top + rect.height / 2 - y),
        };
      })
      .sort((a, b) => a.distance - b.distance)[0]?.node;
    const id = nearest?.dataset.module;
    if (id) {
      MemoryNetwork.select(id, false);
      nearest.classList.add('is-targeted');
      setTimeout(() => nearest.classList.remove('is-targeted'), 2100);
    }
  },

  /* ─── Refresh all icons (after language change etc) ─── */
  refreshIcons() {
    for (const def of DESKTOP_ICONS) {
      const el = this.icons[def.id];
      if (el) {
        const labelEl = el.querySelector('.icon-label');
        if (labelEl) labelEl.textContent = currentLang === 'en' ? def.labelEn : def.label;
        const imgEl = el.querySelector('.icon-image');
        if (imgEl) imgEl.textContent = def.icon;
      }
    }
  },
};
