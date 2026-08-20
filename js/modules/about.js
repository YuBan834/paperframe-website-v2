Modules.About = {
  async render(container) {
    container.innerHTML = '<p style="text-align:center;color:var(--window-text-secondary)">✦ 正在读取身份信号...</p>';
    try {
      const response = await fetch('data/profile.json?v=20260818-identity3');
      const data = await response.json();
      this.renderContent(container, data);
    } catch (_) {
      container.innerHTML = '<p>加载个人信息失败</p>';
    }
  },

  renderContent(container, data) {
    const lang = currentLang;
    container.textContent = '';

    const dossier = createEl('div', { className: 'about-dossier' });
    const stage = createEl('section', { className: 'about-identity-stage' });
    const orbitZone = createEl('div', {
      className: 'about-atom-zone',
      'aria-label': lang === 'en' ? 'Ten-skill atomic orbit' : '十项技能电子轨道',
    });
    orbitZone.innerHTML = `
      <svg class="about-atom-rings" viewBox="0 0 360 286" aria-hidden="true">
        <ellipse cx="180" cy="132" rx="154" ry="54" transform="rotate(-14 180 132)"></ellipse>
        <ellipse cx="180" cy="132" rx="124" ry="76" transform="rotate(34 180 132)"></ellipse>
        <ellipse cx="180" cy="132" rx="92" ry="43" transform="rotate(102 180 132)"></ellipse>
      </svg>
    `;
    const nucleus = createEl('button', {
      className: 'about-atom-nucleus',
      type: 'button',
      title: lang === 'en' ? 'PaperFrame identity nucleus' : 'PaperFrame 身份原子核',
    }, [
      createEl('img', {
        src: data.avatar,
        alt: lang === 'en' ? 'Profile avatar' : '个人头像',
        onerror: function() { this.style.visibility = 'hidden'; },
      }),
      createEl('span', { textContent: 'PAPERFRAME' }),
    ]);
    orbitZone.appendChild(nucleus);

    const orbitData = (data.orbitSkills || data.languages || []).slice(0, 10);
    const electrons = orbitData.map((item, index) => {
      const button = createEl('button', {
        className: 'about-electron',
        type: 'button',
        title: `${item.name} — ${lang === 'en' ? (item.noteEn || item.note || '') : (item.note || '')}`,
        'aria-label': item.name,
      }, [
        createEl('strong', { textContent: item.short || item.name.slice(0, 4).toUpperCase() }),
        createEl('span', { textContent: item.name }),
      ]);
      button.style.setProperty('--tech-color', item.color || '#59d2e6');
      button.dataset.index = String(index);
      orbitZone.appendChild(button);
      return button;
    });
    const readout = createEl('div', { className: 'about-atom-readout' }, [
      createEl('span', { textContent: 'ORBITAL SIGNAL // IDLE' }),
      createEl('strong', { textContent: lang === 'en' ? 'Hover an electron' : '悬停电子读取技能' }),
      createEl('p', { textContent: lang === 'en' ? 'Ten skills move through three stages of practice.' : '十项技能沿三种实践阶段持续运行。' }),
    ]);
    orbitZone.appendChild(readout);
    this.startAtomicOrbit(orbitZone, electrons, orbitData, readout, lang);
    nucleus.addEventListener('click', () => {
      orbitZone.classList.remove('is-pulsing');
      void orbitZone.offsetWidth;
      orbitZone.classList.add('is-pulsing');
      EventBus.emit('identity:nucleus-read');
    });
    stage.appendChild(orbitZone);

    const identity = createEl('div', { className: 'about-identity-copy' }, [
      createEl('p', {
        className: 'about-kicker',
        textContent: 'IDENTITY FILE // SECTOR 07',
      }),
      createEl('h2', {
        className: 'about-name',
        textContent: lang === 'en' ? data.nicknameEn : data.nickname,
      }),
      createEl('p', {
        className: 'about-role',
        textContent: lang === 'en' ? data.identityEn : data.identity,
      }),
      createEl('dl', { className: 'about-meta-grid' }, [
        this.meta('REGION', data.ip),
        this.meta('AGE', String(data.age)),
        this.meta('ROLE', lang === 'en' ? data.identityEn : data.identity),
        this.meta('STATUS', lang === 'en' ? 'LEARNING' : '持续学习中'),
      ]),
    ]);
    stage.appendChild(identity);
    dossier.appendChild(stage);

    dossier.appendChild(createEl('section', { className: 'about-bio-band' }, [
      createEl('span', { textContent: '01' }),
      createEl('p', { textContent: lang === 'en' ? data.bioEn : data.bio }),
    ]));

    if (orbitData.length) {
      const capability = createEl('section', { className: 'about-capability-section about-stage-section' }, [
        createEl('header', {}, [
          createEl('span', { textContent: '02' }),
          createEl('div', {}, [
            createEl('small', { textContent: 'DEVELOPMENT STAGES // 10 SIGNALS' }),
            createEl('h3', { textContent: lang === 'en' ? 'Where each skill currently sits' : '十项技能的当前阶段' }),
          ]),
        ]),
      ]);
      const stageDefinitions = [
        {
          id: 'primary', number: 'A', zh: '主要使用', en: 'PRIMARY',
          match: (item) => item.stage === '主要使用',
        },
        {
          id: 'project', number: 'B', zh: '项目与实验', en: 'PROJECT / EXPERIMENT',
          match: (item) => ['项目实践', '实验方向'].includes(item.stage),
        },
        {
          id: 'learning', number: 'C', zh: '学习与探索', en: 'LEARNING / EXPLORING',
          match: (item) => ['正在学习', '入门探索'].includes(item.stage),
        },
      ];
      const grid = createEl('div', { className: 'about-stage-grid' });
      stageDefinitions.forEach((definition) => {
        const items = orbitData.filter(definition.match);
        if (!items.length) return;
        const list = createEl('div', { className: 'about-stage-signals' });
        items.forEach((item) => {
          list.appendChild(createEl('button', {
            className: 'about-stage-signal',
            type: 'button',
            textContent: item.name,
            title: lang === 'en' ? (item.noteEn || item.note) : item.note,
            onclick: () => electrons[orbitData.indexOf(item)]?.click(),
          }));
        });
        grid.appendChild(createEl('article', {
          className: `about-stage-card is-${definition.id}`,
        }, [
          createEl('span', { textContent: definition.number }),
          createEl('div', {}, [
            createEl('small', { textContent: definition.en }),
            createEl('strong', { textContent: lang === 'en' ? definition.en : definition.zh }),
          ]),
          list,
        ]));
      });
      capability.appendChild(grid);
      dossier.appendChild(capability);
    }

    const socialLinks = (data.socials || []).filter((link) => {
      const url = String(link.url || '');
      return url && url !== 'https://github.com/' && !url.includes('example@example.com');
    });
    if (socialLinks.length) {
      const links = createEl('footer', { className: 'about-links' });
      socialLinks.forEach((link) => {
        links.appendChild(createEl('a', {
          className: `about-social about-social--${link.theme || 'default'}`,
          href: link.url,
          target: '_blank',
          rel: 'noopener',
          'aria-label': `${link.platform}：${link.note || '个人主页'}`,
        }, [
          createEl('span', { className: 'about-social-icon', textContent: link.icon || '↗' }),
          createEl('span', { className: 'about-social-copy' }, [
            createEl('strong', { textContent: link.platform }),
            createEl('small', { textContent: link.note || '个人主页' }),
          ]),
          createEl('i', { textContent: '↗' }),
        ]));
      });
      dossier.appendChild(links);
    }

    container.appendChild(dossier);
  },

  meta(label, value) {
    return createEl('div', {}, [
      createEl('dt', { textContent: label }),
      createEl('dd', { textContent: value }),
    ]);
  },

  startAtomicOrbit(zone, elements, data, readout, lang = 'zh') {
    const shells = [
      { rx: 92, ry: 43, tilt: 102, speed: 0.00023, count: 3 },
      { rx: 124, ry: 76, tilt: 34, speed: -0.00015, count: 4 },
      { rx: 154, ry: 54, tilt: -14, speed: 0.00019, count: 3 },
    ];
    let activeIndex = -1;
    let selectedIndex = -1;
    let previousFrame = performance.now();
    let cursor = 0;
    const assignments = shells.flatMap((shell, shellIndex) =>
      Array.from({ length: shell.count }, (_, position) => ({
        shell,
        shellIndex,
        angle: position * (Math.PI * 2 / shell.count) + shellIndex * 0.52,
      }))
    );

    const select = (index, record = false) => {
      activeIndex = index;
      elements.forEach((element, i) => element.classList.toggle('is-active', i === index));
      const item = data[index];
      if (!item) return;
      readout.querySelector('span').textContent = `ORBITAL SIGNAL // ${lang === 'en' ? (item.stageEn || 'ACTIVE') : (item.stage || '读取中')}`;
      readout.querySelector('strong').textContent = item.name;
      readout.querySelector('p').textContent = lang === 'en' ? (item.noteEn || item.note || 'TECHNICAL SIGNAL') : (item.note || 'TECHNICAL SIGNAL');
      if (record) EventBus.emit('identity:electron-read', { index, name: item.name });
    };
    const clear = () => {
      if (selectedIndex >= 0) {
        select(selectedIndex, false);
        return;
      }
      activeIndex = -1;
      elements.forEach((element) => element.classList.remove('is-active'));
      readout.querySelector('span').textContent = 'ORBITAL SIGNAL // IDLE';
      readout.querySelector('strong').textContent = lang === 'en' ? 'Select an electron' : '点击电子读取技能';
      readout.querySelector('p').textContent = lang === 'en' ? 'Ten skills are grouped by real practice stages.' : '十项技能按真实实践阶段分类。';
    };
    elements.forEach((element, index) => {
      element.addEventListener('pointerenter', () => select(index, false));
      element.addEventListener('pointerleave', clear);
      element.addEventListener('focus', () => select(index, true));
      element.addEventListener('blur', clear);
      element.addEventListener('click', () => {
        selectedIndex = index;
        select(index, true);
      });
    });

    const animate = (now) => {
      if (!zone.isConnected) return;
      const delta = Math.min(48, now - previousFrame);
      previousFrame = now;
      const centerX = zone.clientWidth / 2;
      const centerY = Math.min(132, zone.clientHeight * 0.46);
      elements.forEach((element, index) => {
        const assignment = assignments[index % assignments.length];
        const { shell } = assignment;
        const speed = activeIndex >= 0 ? shell.speed * 0.12 : shell.speed;
        assignment.angle += delta * speed;
        const angle = assignment.angle;
        const baseX = Math.cos(angle) * shell.rx;
        const baseY = Math.sin(angle) * shell.ry;
        const tilt = shell.tilt * Math.PI / 180;
        const x = baseX * Math.cos(tilt) - baseY * Math.sin(tilt);
        const y = baseX * Math.sin(tilt) + baseY * Math.cos(tilt);
        const depth = (Math.sin(angle) + 1) / 2;
        const scale = 0.72 + depth * 0.34 + (index === activeIndex ? 0.15 : 0);
        element.style.left = `${centerX + x}px`;
        element.style.top = `${centerY + y}px`;
        element.style.zIndex = String(5 + Math.round(depth * 20));
        element.style.opacity = String(0.48 + depth * 0.52);
        element.style.transform = `translate(-50%, -50%) scale(${scale})`;
      });
      cursor = requestAnimationFrame(animate);
    };
    cursor = requestAnimationFrame(animate);
    zone._orbitCleanup = () => cancelAnimationFrame(cursor);
  },
};
