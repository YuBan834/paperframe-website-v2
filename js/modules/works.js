Modules.Works = {
  data: [],

  async render(container) {
    container.innerHTML = '<p class="works-loading">PROJECT SIGNAL ACQUIRING...</p>';
    try {
      const resp = await fetch('data/works.json');
      this.data = await resp.json();
      this.renderContent(container);
    } catch (error) {
      container.innerHTML = '<p class="works-loading">作品集加载失败</p>';
    }
  },

  text(item, key) {
    if (currentLang === 'en') return item[`${key}En`] || item[key] || '';
    return item[key] || '';
  },

  openLink(url) {
    if (!url) return;
    if (url === 'index.html') {
      window.location.href = url;
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  createVisual(work) {
    const visual = createEl('div', { className: `project-visual project-visual--${work.id}` });
    if (work.id === 'personal-universe') {
      visual.innerHTML = `
        <div class="project-os-grid"></div>
        <div class="project-os-window project-os-window--v1"><b>V1</b><span>DESKTOP</span></div>
        <div class="project-os-window project-os-window--v2"><b>V2</b><span>MEMORY OS</span></div>
        <div class="project-os-route"><i></i><i></i><i></i><i></i><i></i><i></i></div>`;
    } else if (work.id === 'vrma-lab') {
      visual.innerHTML = `
        <div class="project-rig-figure"><i></i><i></i><i></i><i></i><i></i></div>
        <div class="project-rig-track"><span style="--p:23%"></span><span style="--p:57%"></span><span style="--p:81%"></span></div>
        <div class="project-rig-readout">MOTION / 30 FPS<br><b>AGENT READY</b></div>`;
    } else {
      visual.innerHTML = `
        <div class="project-star-orbit project-star-orbit--one"></div>
        <div class="project-star-orbit project-star-orbit--two"></div>
        <div class="project-star-core">✦</div>
        <div class="project-star-signal"><i></i><i></i><i></i><i></i></div>
        <div class="project-star-readout">FOCUS<br><b>00:25:00</b></div>`;
    }
    return visual;
  },

  createLinks(work) {
    const row = createEl('div', { className: 'project-links' });
    for (const link of work.links || []) {
      const attrs = {
        className: `project-link project-link--${link.kind || 'secondary'}`,
        textContent: this.text(link, 'label'),
      };
      if (!link.url) attrs.disabled = 'disabled';
      const btn = createEl('button', attrs);
      if (link.url) btn.addEventListener('click', () => this.openLink(link.url));
      row.appendChild(btn);
    }
    return row;
  },

  createProject(work) {
    const card = createEl('article', {
      className: `project-channel project-channel--${work.id}`,
    });
    const content = createEl('div', { className: 'project-copy' });
    content.append(
      createEl('div', { className: 'project-kicker' }, [
        createEl('span', { textContent: work.index }),
        createEl('small', { textContent: this.text(work, 'eyebrow') }),
      ]),
      createEl('h2', { textContent: this.text(work, 'name') }),
      createEl('p', { className: 'project-description', textContent: this.text(work, 'description') }),
    );
    if (work.versions) {
      const versions = createEl('div', { className: 'project-versions' });
      work.versions.forEach((version, index) => {
        const button = createEl('button', { className: 'project-version' }, [
          createEl('b', { textContent: version.label }),
          createEl('span', { textContent: this.text(version, 'note') }),
        ]);
        button.addEventListener('click', () => this.openLink(version.url));
        versions.appendChild(button);
        if (index === 0) versions.appendChild(createEl('i', { className: 'project-version-arrow', textContent: '→' }));
      });
      content.appendChild(versions);
    } else if (work.metrics) {
      content.appendChild(createEl('div', { className: 'project-metrics' }, work.metrics.map(metric =>
        createEl('span', { textContent: metric })
      )));
    }
    content.append(
      createEl('div', { className: 'project-tags' }, work.tech.map(tag => createEl('span', { textContent: tag }))),
      this.createLinks(work),
    );
    card.append(this.createVisual(work), content);
    return card;
  },

  renderContent(container) {
    container.innerHTML = '';
    const shell = createEl('section', { className: 'works-archive' });
    shell.appendChild(createEl('header', { className: 'works-archive-header' }, [
      createEl('div', {}, [
        createEl('span', { textContent: 'PROJECT ARCHIVE / 03' }),
        createEl('h1', { textContent: currentLang === 'en' ? 'Things I made real.' : '把想法做成可以运行的东西。' }),
      ]),
      createEl('p', { textContent: currentLang === 'en'
        ? 'Three project families, each keeping its own interface language.'
        : '三个项目家族，各自保留自己的界面语言。' }),
    ]));
    const list = createEl('div', { className: 'project-channel-list' });
    this.data.forEach(work => list.appendChild(this.createProject(work)));
    shell.appendChild(list);
    container.appendChild(shell);
  },
};
