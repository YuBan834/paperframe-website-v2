Modules.Signal = {
  async render(container) {
    container.innerHTML = '<p class="signal-loading">CURRENT SIGNAL / TUNING…</p>';
    try {
      const response = await fetch('data/signal.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      this.renderContent(container, data);
    } catch (error) {
      console.error('[Signal] Failed to load:', error);
      container.innerHTML = '<p class="signal-loading">最近的内容暂时无法读取。</p>';
    }
  },

  renderContent(container, data) {
    const lang = currentLang === 'en' ? 'en' : 'zh';
    container.textContent = '';
    const root = createEl('section', { className: 'current-signal' });
    root.appendChild(createEl('header', { className: 'signal-hero' }, [
      createEl('div', {}, [
        createEl('span', { className: 'signal-kicker', textContent: 'CURRENT SIGNAL // 06' }),
        createEl('h2', { textContent: lang === 'en' ? 'What is happening now' : '最近在做什么' }),
        createEl('p', { textContent: lang === 'en' ? data.headlineEn : data.headline }),
      ]),
      createEl('div', { className: 'signal-online' }, [
        createEl('i'),
        createEl('span', { textContent: data.status || 'ONLINE' }),
        createEl('small', { textContent: data.updated || '—' }),
      ]),
    ]));

    const grid = createEl('div', { className: 'signal-grid' });
    (data.signals || []).forEach((item, index) => {
      grid.appendChild(createEl('article', { className: 'signal-card' }, [
        createEl('span', { className: 'signal-card-index', textContent: String(index + 1).padStart(2, '0') }),
        createEl('small', { textContent: `${item.code} / ${lang === 'en' ? item.labelEn : item.label}` }),
        createEl('strong', { textContent: item.value }),
        createEl('p', { textContent: item.detail }),
      ]));
    });
    root.appendChild(grid);
    root.appendChild(createEl('footer', { className: 'signal-footer' }, [
      createEl('span', { textContent: 'MENTAL OUT // LIVE PERSONAL TRACE' }),
      createEl('span', { textContent: lang === 'en' ? 'This panel changes with its owner.' : '这里会随着站长一起变化。' }),
    ]));
    container.appendChild(root);
  },
};
