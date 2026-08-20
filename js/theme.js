const ThemeManager = {
  currentPhase: 'day',
  currentLang: 'zh',
  timer: null,

  init() {
    this.currentLang = loadSetting('lang', DEFAULT_SETTINGS.lang);
    currentLang = this.currentLang;
    document.body.classList.remove('night');
    this.applyCurrentPhase(true);

    EventBus.on('lang:changed', (lang) => this.onLangChanged(lang));
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyL') {
        event.preventDefault();
        const next = currentLang === 'zh' ? 'en' : 'zh';
        setLang(next);
        EventBus.emit('lang:changed', next);
      }
    });

    this.timer = window.setInterval(() => this.applyCurrentPhase(), 60_000);
  },

  getPhase(date = new Date()) {
    const hour = date.getHours() + date.getMinutes() / 60;
    if (hour >= 5 && hour < 8.5) return 'dawn';
    if (hour >= 8.5 && hour < 16.5) return 'day';
    if (hour >= 16.5 && hour < 20) return 'dusk';
    return 'night';
  },

  applyCurrentPhase(force = false) {
    const next = this.getPhase();
    if (!force && next === this.currentPhase) return;
    this.currentPhase = next;
    document.body.dataset.timePhase = next;
    EventBus.emit('time:phase-changed', next);
  },

  onLangChanged(lang) {
    this.currentLang = lang;
    currentLang = lang;
    const label = document.getElementById('su-lang-label') || document.getElementById('lang-label');
    if (label) label.textContent = lang === 'zh' ? '中' : 'EN';

    Desktop?.updateLabels?.();
    Taskbar?.updateStartMenuLabels?.();

    if (WindowManager?.windows) {
      for (const windowData of Object.values(WindowManager.windows)) {
        const definition = DESKTOP_ICONS.find((item) => item.windowType === windowData.type);
        const title = windowData.el.querySelector('.window-title-text');
        if (definition && title) title.textContent = lang === 'en' ? definition.labelEn : definition.label;
      }
    }
    Taskbar?.updateAllButtonLabels?.();
  },
};
