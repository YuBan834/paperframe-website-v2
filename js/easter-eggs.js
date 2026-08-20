const EasterEggs = {
  foundEggs: [],

  // Command line
  cmdLine: null,
  cmdInput: null,

  init() {
    // Keep only the six final records. Removed experiments may remain in an
    // older browser save, but they no longer count or appear in the archive.
    this.foundEggs = loadSetting('found_eggs', []).filter((id) => CORE_ACHIEVEMENT_IDS.includes(id));
    saveSetting('found_eggs', this.foundEggs);
    this.identityElectronReads = new Set(loadSetting('identity_electron_reads', []));
    this.identityNucleusRead = Boolean(loadSetting('identity_nucleus_read', false));
    this.cmdLine = document.getElementById('command-line');
    this.cmdInput = document.getElementById('cmd-input');
    this.cmdOutput = document.getElementById('cmd-output');
    this.achievementDrawer = document.getElementById('achievement-drawer');
    this.achievementList = document.getElementById('achievement-list');

    this.bindKeyboard();
    this.bindCommandLine();
    this.bindTimeEvents();
    this.bindEvents();

    document.getElementById('cmd-close')?.addEventListener('click', () => this.toggleCommandLine(false));
    document.getElementById('achievement-close')?.addEventListener('click', () => this.toggleAchievements(false));
    document.getElementById('egg-counter')?.addEventListener('click', () => this.toggleAchievements(true));

    // Update counter
    EventBus.emit('time:init');
    this.checkIdentityDecoded();
    this.renderAchievements();
  },

  /* ─── Keyboard ─── */
  bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+K: Command line
      if (e.ctrlKey && e.code === 'KeyK') {
        e.preventDefault();
        this.toggleCommandLine();
      }

      // Esc: Close all
      if (e.code === 'Escape') {
        this.toggleCommandLine(false);
        this.toggleAchievements(false);
        // Also close context menu
        document.getElementById('context-menu')?.classList.add('hidden');
        // Close start menu
        document.getElementById('start-menu').classList.add('hidden');
        // Close chat bubble
        if (Character.isChatMode) Character.hideBubble();
      }

    });
  },

  /* ─── Command Line ─── */
  toggleCommandLine(force) {
    const isHidden = this.cmdLine.classList.contains('hidden');
    const shouldShow = typeof force === 'boolean' ? force : isHidden;
    if (shouldShow) {
      this.toggleAchievements(false);
      this.cmdLine.classList.remove('hidden');
      this.cmdLine.setAttribute('aria-hidden', 'false');
      this.cmdInput.value = '';
      this.cmdInput.focus();
    } else {
      this.cmdLine.classList.add('hidden');
      this.cmdLine.setAttribute('aria-hidden', 'true');
    }
  },

  bindCommandLine() {
    this.cmdInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const cmd = this.cmdInput.value.trim().toLowerCase();
        if (!cmd) return;
        this.appendCommand(cmd);
        this.executeCommand(cmd);
        this.cmdInput.value = '';
      }
      if (e.key === 'Escape') {
        this.toggleCommandLine(false);
      }
    });
  },

  executeCommand(cmd) {
    const lang = currentLang;
    let handled = true;

    switch (true) {
      case cmd === 'summon cat':
        this.summonCat();
        break;
      case cmd === 'paperframe':
        this.cmdReply(lang === 'zh'
          ? 'PAPERFRAME // 高中生 · 独立开发者 // 正在把动画、游戏、视觉与代码做成作品'
          : 'PAPERFRAME // Student · Independent Developer // turning animation, games, visuals and code into projects');
        break;
      case cmd.startsWith('open '): {
        const target = cmd.slice(5).trim();
        const aliases = { about: 'about', timeline: 'timeline', works: 'works', site: 'changelog', changelog: 'changelog', contact: 'contact', signal: 'signal' };
        if (aliases[target]) {
          EventBus.emit('desktop:open-window', aliases[target]);
          this.cmdReply(`OPEN ${target.toUpperCase()} // OK`);
        } else {
          handled = false;
          this.cmdReply(`Unknown memory: ${target}`, 'error');
        }
        break;
      }
      case cmd === 'memory': {
        const next = MemoryNetwork.revealNext();
        this.cmdReply(next ? `SIGNAL ${next.label} LOCATED` : 'NO MEMORY SIGNAL');
        break;
      }
      case cmd === 'link':
        Chat.open();
        this.cmdReply('MENTAL LINK CHANNEL OPEN');
        break;
      case cmd === 'status':
        this.cmdReply(`CHARACTER ${Character.loaded ? 'ONLINE' : 'OFFLINE'} // MEMORY ${MemoryNetwork.discovered.size}/06`);
        break;
      case cmd === 'clear':
        if (this.cmdOutput) this.cmdOutput.textContent = '';
        break;
      case cmd === 'star':
        this.triggerEasterEgg('starDivination');
        break;
      case cmd === 'help':
        this.cmdReply('Commands: paperframe, status, memory, open about|timeline|works|site|contact|signal, link, star, summon cat, clear, help');
        break;
      default:
        handled = false;
        this.cmdReply(lang === 'zh'
          ? `未知指令: ${cmd}。输入 "help" 查看可用指令。`
          : `Unknown command: ${cmd}. Type "help" for available commands.`);
    }
    if (handled) this.recordAchievement({ id: 'firstCommand', ...EASTER_EGGS.firstCommand });
  },

  appendCommand(command) {
    if (!this.cmdOutput) return;
    const line = document.createElement('p');
    line.className = 'cmd-user';
    line.textContent = `visitor@paperframe:~$ ${command}`;
    this.cmdOutput.appendChild(line);
    this.cmdOutput.scrollTop = this.cmdOutput.scrollHeight;
  },

  cmdReply(msg, type = 'reply') {
    if (!this.cmdOutput) return;
    const line = document.createElement('p');
    if (type === 'error') line.className = 'cmd-error';
    const prefix = document.createElement('span');
    prefix.textContent = type === 'error' ? 'error ' : 'system ';
    line.append(prefix, document.createTextNode(String(msg)));
    this.cmdOutput.appendChild(line);
    this.cmdOutput.scrollTop = this.cmdOutput.scrollHeight;
  },

  summonCat() {
    document.querySelector('.cyber-cat-protocol')?.remove();
    const cat = createEl('section', {
      className: 'cyber-cat-protocol',
      'aria-label': currentLang === 'en' ? 'Electronic cat inspection protocol' : '电子猫巡检协议',
    });
    cat.innerHTML = `
      <span class="cyber-cat-build" aria-hidden="true"></span>
      <svg class="cyber-cat-body" viewBox="0 0 160 88" aria-hidden="true">
        <defs>
          <linearGradient id="cat-signal" x1="0" x2="1">
            <stop offset="0" stop-color="#59d2e6"/><stop offset=".58" stop-color="#f2c66d"/><stop offset="1" stop-color="#fff4cf"/>
          </linearGradient>
        </defs>
        <path class="cat-tail" d="M126 60c25 2 27-22 11-25-10-2-13 6-7 11"/>
        <path class="cat-shell" d="M47 35 39 17l20 10c8-4 24-4 32 0l20-10-7 19c8 8 12 18 10 31H40c-2-13 0-23 7-32Z"/>
        <path class="cat-core" d="M62 43h31l9 10-9 11H62L51 53Z"/>
        <circle class="cat-eye" cx="61" cy="38" r="3"/><circle class="cat-eye" cx="91" cy="38" r="3"/>
        <path class="cat-leg" d="M52 66v12m42-12v12M66 67v10m15-10v10"/>
        <path class="cat-circuit" d="M66 51h8l4-6 5 15 5-9h8"/>
      </svg>
      <span class="cyber-cat-scan" aria-hidden="true"></span>
      <span class="cyber-cat-status"><b>CAT.PROTOCOL</b><small>MEMORY INSPECTION // 06 NODES</small></span>
      <span class="cyber-cat-pips" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>`;
    document.body.appendChild(cat);
    requestAnimationFrame(() => cat.classList.add('is-active'));
    Particles?.burstAt?.(42, Math.max(80, window.innerHeight - 112));
    setTimeout(() => Character?.say?.(
      currentLang === 'en' ? 'An inspection protocol? You actually summoned it.' : '巡检协议？你还真把它叫出来了。',
      3200
    ), 850);
    setTimeout(() => cat.classList.add('is-exiting'), 10500);
    setTimeout(() => cat.remove(), 11600);
    this.triggerEasterEgg('summonCat');
  },

  /* ─── Time Events ─── */
  bindTimeEvents() {
    EventBus.on('time:hourly', (hour) => {
      if (Character.showBubble && !Character.isChatMode) {
        const msg = currentLang === 'zh'
          ? `现在是${hour}点整~`
          : `It's ${hour} o'clock~`;
        Character.showBubble();
        Character.typeText(msg);
      }
    });

  },

  /* ─── Other Events ─── */
  bindEvents() {
    // Character and particle systems can unlock achievements directly.  Keep
    // one canonical collection so the archive and counter never drift apart.
    EventBus.on('easteregg:found', (data) => this.recordAchievement(data));

    EventBus.on('identity:electron-read', ({ index }) => {
      if (!Number.isInteger(index)) return;
      this.identityElectronReads.add(index);
      saveSetting('identity_electron_reads', [...this.identityElectronReads]);
      this.checkIdentityDecoded();
    });

    EventBus.on('identity:nucleus-read', () => {
      this.identityNucleusRead = true;
      saveSetting('identity_nucleus_read', true);
      this.checkIdentityDecoded();
    });

    EventBus.on('window:aero-shake', () => {
      WindowManager.minimizeAll();
    });

    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) this.recordAchievement({ id: 'fullscreen', ...EASTER_EGGS.fullscreen });
    });
  },

  checkIdentityDecoded() {
    if (this.identityNucleusRead && this.identityElectronReads.size >= 3) {
      this.recordAchievement({ id: 'identityDecoded', ...EASTER_EGGS.identityDecoded });
    }
  },

  /* ─── Trigger ─── */
  triggerEasterEgg(id) {
    const eggDef = EASTER_EGGS[id];
    if (!eggDef || !CORE_ACHIEVEMENT_IDS.includes(id)) return;

    if (id !== 'fullscreen') this.recordAchievement({ id, ...eggDef });

    // Execute the egg action
    switch (id) {
      case 'starDivination':
        this.showDivination();
        break;
      case 'fullscreen':
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen();
        }
        break;
    }

  },

  recordAchievement(data) {
    const id = data?.id;
    if (!id || !CORE_ACHIEVEMENT_IDS.includes(id) || this.foundEggs.includes(id)) return false;
    const definition = EASTER_EGGS[id] || data;
    if (!definition?.name && !definition?.nameEn) return false;
    this.foundEggs.push(id);
    saveSetting('found_eggs', this.foundEggs);
    this.showNotification(definition);
    Sound?.play?.('achievement');
    this.renderAchievements();
    Taskbar?.updateEggCounter?.();
    EventBus.emit('achievement:unlocked', { id, definition });
    AchievementReward?.sync?.();
    return true;
  },

  toggleAchievements(force) {
    if (!this.achievementDrawer) return;
    const isHidden = this.achievementDrawer.classList.contains('hidden');
    const shouldShow = typeof force === 'boolean' ? force : isHidden;
    if (shouldShow) {
      this.toggleCommandLine(false);
      this.renderAchievements();
      this.achievementDrawer.classList.remove('hidden');
      this.achievementDrawer.setAttribute('aria-hidden', 'false');
    } else {
      this.achievementDrawer.classList.add('hidden');
      this.achievementDrawer.setAttribute('aria-hidden', 'true');
    }
  },

  renderAchievements() {
    if (!this.achievementList) return;
    const entries = CORE_ACHIEVEMENT_IDS.map((id) => [id, EASTER_EGGS[id]]).filter(([, definition]) => definition);
    const unlocked = new Set(this.foundEggs.filter((id) => CORE_ACHIEVEMENT_IDS.includes(id)));
    this.achievementList.textContent = '';

    for (const [id, definition] of entries) {
      const isUnlocked = unlocked.has(id);
      const item = document.createElement('article');
      item.className = `achievement-item${isUnlocked ? ' is-unlocked' : ''}`;
      const icon = document.createElement('span');
      icon.className = 'achievement-item-icon';
      icon.textContent = isUnlocked ? (definition.icon || '◆') : '◇';
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      const hint = document.createElement('small');
      title.textContent = isUnlocked
        ? (currentLang === 'en' ? (definition.nameEn || definition.name) : definition.name)
        : 'LOCKED MEMORY';
      hint.textContent = isUnlocked ? this.achievementHint(definition) : this.lockedHint(definition);
      copy.append(title, hint);
      const status = document.createElement('span');
      status.className = 'achievement-item-status';
      status.textContent = isUnlocked ? 'UNLOCKED' : 'UNKNOWN';
      item.append(icon, copy, status);
      this.achievementList.appendChild(item);
    }

    const value = document.getElementById('achievement-progress-value');
    const bar = document.getElementById('achievement-progress-bar');
    if (value) value.textContent = `${String(unlocked.size).padStart(2, '0')} / ${String(entries.length).padStart(2, '0')}`;
    if (bar) bar.style.width = `${Math.min(100, unlocked.size / entries.length * 100)}%`;
    AchievementReward?.sync?.();
  },

  achievementHint(definition) {
    if (definition.hint) return definition.hint;
    const labels = {
      mouse: '通过桌面手势触发', character: '与角色互动触发',
      time: '在特殊时间触发', terminal: '通过终端触发', collection: '收集隐藏信号触发',
    };
    return labels[definition.type] || '通过系统快捷行为触发';
  },

  lockedHint(definition) {
    if (definition.lockedHint) return definition.lockedHint;
    const labels = {
      mouse: '尝试不同的鼠标手势', character: '多观察角色的反应',
      time: '有些记录只在特定时间出现', terminal: '终端里也许藏着协议', collection: '寻找面板上的微弱信号',
    };
    return labels[definition.type] || '继续探索系统行为';
  },

  showNotification(eggDef) {
    const notif = document.getElementById('egg-notification');
    const msg = document.getElementById('egg-message');
    const lang = currentLang;

    msg.textContent = `${t('eggFound')}: ${lang === 'en' ? (eggDef.nameEn || eggDef.name) : eggDef.name} ${eggDef.icon}`;
    notif.classList.remove('hidden');

    // Re-trigger animation
    notif.style.animation = 'none';
    notif.offsetHeight;
    notif.style.animation = '';

    setTimeout(() => {
      notif.classList.add('hidden');
    }, 3000);
  },

  showDivination() {
    const fortunes = currentLang === 'zh'
      ? [
        { code: 'ORBIT 01', mark: '✦', title: '推进', text: '把仍停留在草稿里的想法向前推进一格。完成比完美更接近作品。' },
        { code: 'ORBIT 02', mark: '◇', title: '回看', text: '旧项目里仍保存着可以重新使用的结构。今天适合整理，而不是推倒重来。' },
        { code: 'ORBIT 03', mark: '◉', title: '聚焦', text: '减少一个同时进行的方向，最重要的那条轨道会变得清晰。' },
        { code: 'ORBIT 04', mark: '△', title: '试验', text: '允许一次没有成果压力的小实验。新的风格通常从偏离计划开始。' },
        { code: 'ORBIT 05', mark: '⬡', title: '连接', text: '今天适合把两个原本无关的兴趣连接起来，它们可能会形成新的作品。' },
        { code: 'ORBIT 06', mark: '⌁', title: '休整', text: '暂停并不是失去进度。让注意力归位，再决定下一次迭代。' },
      ]
      : [
        { code: 'ORBIT 01', mark: '✦', title: 'ADVANCE', text: 'Move one unfinished idea forward. Finished is closer to a real work than perfect.' },
        { code: 'ORBIT 02', mark: '◇', title: 'REVISIT', text: 'An older project still contains structures worth reusing. Refine before rebuilding.' },
        { code: 'ORBIT 03', mark: '◉', title: 'FOCUS', text: 'Remove one competing direction and the important orbit will become clearer.' },
        { code: 'ORBIT 04', mark: '△', title: 'EXPERIMENT', text: 'Allow one experiment with no pressure to become a finished result.' },
        { code: 'ORBIT 05', mark: '⬡', title: 'CONNECT', text: 'Connect two unrelated interests. A new project may appear between them.' },
        { code: 'ORBIT 06', mark: '⌁', title: 'RESET', text: 'A pause is not lost progress. Let attention settle before the next iteration.' },
      ];

    const fortune = pick(fortunes);
    document.querySelector('.star-observation')?.remove();
    const overlay = createEl('section', { className: 'star-observation', role: 'dialog', 'aria-modal': 'true' });
    const field = createEl('div', { className: 'star-observation-field', 'aria-hidden': 'true' });
    for (let i = 0; i < 34; i++) {
      const star = createEl('i');
      star.style.setProperty('--sx', `${(i * 37 + 11) % 97}%`);
      star.style.setProperty('--sy', `${(i * 61 + 7) % 93}%`);
      star.style.setProperty('--sd', `${(i % 7) * 90}ms`);
      star.style.setProperty('--ss', `${1 + (i % 3) * .65}px`);
      field.appendChild(star);
    }
    const constellation = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    constellation.setAttribute('class', 'star-observation-map');
    constellation.setAttribute('viewBox', '0 0 720 420');
    constellation.setAttribute('aria-hidden', 'true');
    constellation.innerHTML = `
      <path d="M72 294 190 110 328 176 452 74 633 166 552 332 376 350 212 306Z"/>
      <path d="M190 110 212 306M328 176 376 350M452 74 552 332M328 176 552 332"/>
      <g><circle cx="72" cy="294" r="5"/><circle cx="190" cy="110" r="7"/><circle cx="328" cy="176" r="5"/><circle cx="452" cy="74" r="6"/><circle cx="633" cy="166" r="5"/><circle cx="552" cy="332" r="7"/><circle cx="376" cy="350" r="5"/><circle cx="212" cy="306" r="6"/></g>`;
    const panel = createEl('article', { className: 'star-observation-panel' }, [
      createEl('span', { className: 'star-observation-code', textContent: `MENTAL OBSERVATORY // ${fortune.code}` }),
      createEl('strong', { className: 'star-observation-mark', textContent: fortune.mark }),
      createEl('h2', { textContent: fortune.title }),
      createEl('p', { textContent: fortune.text }),
      createEl('button', { type: 'button', textContent: currentLang === 'zh' ? '结束观测' : 'END OBSERVATION' }),
    ]);
    overlay.append(field, constellation, panel);
    document.body.appendChild(overlay);
    document.body.classList.add('is-star-observing');
    requestAnimationFrame(() => overlay.classList.add('is-active'));
    Particles?.triggerConstellation?.();
    Character?.playAnimation?.('lookAround');
    Sound?.play?.('memory');

    let timer = null;
    const close = () => {
      clearTimeout(timer);
      overlay.classList.remove('is-active');
      overlay.classList.add('is-closing');
      document.body.classList.remove('is-star-observing');
      setTimeout(() => overlay.remove(), 520);
    };
    panel.querySelector('button').addEventListener('click', close);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
    timer = setTimeout(close, 10000);
  },
};
