const MemoryNetwork = {
  definitions: [
    { id: 'about', label: 'IDENTITY', title: '身份档案', detail: '站长是谁，以及他正在学习什么。', x: 50, y: 12 },
    { id: 'timeline', label: 'ARCHIVE', title: '游戏与番剧', detail: '我看过的番、玩过的游戏，还有非常主观的评分。', x: 82, y: 31 },
    { id: 'works', label: 'WORKS', title: '作品集', detail: '这里放着我做过的项目。', x: 82, y: 69 },
    { id: 'changelog', label: 'SITE', title: '关于本站', detail: 'V1.0 到 V2.0 的制作方式、技术与署名。', x: 50, y: 88 },
    { id: 'contact', label: 'CONTACT', title: '留言', detail: '想联系我的话，可以在这里给我留言。', x: 18, y: 69 },
    { id: 'signal', label: 'CURRENT', title: '最近在做', detail: '最近在开发、看什么、玩什么，以及学什么。', x: 18, y: 31 },
  ],
  links: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]],
  discovered: new Set(),
  time: 0,
  lastFrame: 0,

  init() {
    this.root = document.getElementById('memory-network');
    this.canvas = document.getElementById('memory-network-canvas');
    this.nodesRoot = document.getElementById('memory-network-nodes');
    this.progress = document.getElementById('memory-network-progress');
    if (!this.root || !this.canvas || !this.nodesRoot) return;
    this.ctx = this.canvas.getContext('2d');
    this.restore();
    this.renderNodes();
    this.resize();
    this.loop();

    window.addEventListener('resize', debounce(() => this.resize(), 120));
    EventBus.on('window:opened', ({ type }) => {
      this.discover(type, false);
      this.syncWindowState();
    });
    EventBus.on('window:closed', () => setTimeout(() => this.syncWindowState(), 280));
    EventBus.on('window:minimized', () => setTimeout(() => this.syncWindowState(), 420));
    EventBus.on('window:restored', () => this.syncWindowState());
  },

  renderNodes() {
    this.nodesRoot.textContent = '';
    const core = document.createElement('button');
    core.id = 'achievement-trophy';
    core.type = 'button';
    core.className = 'memory-network-core achievement-trophy';
    core.setAttribute('aria-label', '查看成就进度');
    core.setAttribute('title', '成就进度 0 / 6');
    core.style.setProperty('--achievement-fill', '0%');
    core.innerHTML = `
      <span class="achievement-trophy-art" aria-hidden="true">
        <svg viewBox="0 0 64 64" focusable="false">
          <path d="M19 10h26v10c0 11-5 19-13 22-8-3-13-11-13-22V10Zm0 5H10v7c0 7 4 12 11 14m24-21h9v7c0 7-4 12-11 14M27 42h10v8H27zm-8 8h26v6H19z"/>
        </svg>
        <span class="achievement-trophy-fill"><svg viewBox="0 0 64 64" focusable="false"><path d="M19 10h26v10c0 11-5 19-13 22-8-3-13-11-13-22V10Zm0 5H10v7c0 7 4 12 11 14m24-21h9v7c0 7-4 12-11 14M27 42h10v8H27zm-8 8h26v6H19z"/></svg></span>
      </span>
      <span class="achievement-trophy-count">0/6</span>`;
    core.addEventListener('click', () => {
      if (typeof EasterEggs !== 'undefined') EasterEggs.toggleAchievements(true);
    });
    this.nodesRoot.appendChild(core);
    this.definitions.forEach((definition, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'memory-node';
      button.dataset.label = definition.label;
      button.dataset.module = definition.id;
      button.setAttribute('aria-label', `查看 ${definition.label}`);
      button.style.left = `${definition.x}%`;
      button.style.top = `${definition.y}%`;
      button.style.setProperty('--node-index', `'0${index + 1}'`);
      button.classList.toggle('is-discovered', this.discovered.has(definition.id));
      button.addEventListener('click', () => {
        this.select(definition.id, true);
      });
      button.addEventListener('dblclick', () => EventBus.emit('desktop:open-window', definition.id));
      this.nodesRoot.appendChild(button);
    });
    this.updateProgress();
  },

  discover(id, announce) {
    if (!this.definitions.some((item) => item.id === id)) return;
    const isNew = !this.discovered.has(id);
    this.discovered.add(id);
    this.nodesRoot?.querySelector(`[data-module="${id}"]`)?.classList.add('is-discovered');
    this.persist();
    this.updateProgress();
    if (announce) EventBus.emit('memory:activated', { id, isNew });
    if (isNew && this.discovered.size === this.definitions.length) {
      this.root?.classList.add('is-synchronized');
      setTimeout(() => this.root?.classList.remove('is-synchronized'), 2600);
      EventBus.emit('easteregg:found', {
        id: 'memoryHexagon',
        name: '六相同步',
        nameEn: 'Hexagonal Sync',
        icon: '⬡',
      });
      Character?.say?.(
        currentLang === 'en'
          ? 'All six signals are synchronized. That is a rather beautiful shape.'
          : '六个信号全部同步了。这个形状，还挺漂亮的嘛。',
        4200
      );
    }
  },

  select(id, discover = false) {
    const definition = this.definitions.find((item) => item.id === id);
    if (!definition) return null;
    this.selected = id;
    this.nodesRoot?.querySelectorAll('.memory-node').forEach((node) => {
      node.classList.toggle('is-selected', node.dataset.module === id);
    });
    if (discover) this.discover(id, true);
    Sound?.play?.('memory');
    EventBus.emit('memory:selected', { ...definition, discovered: this.discovered.has(id) });
    return definition;
  },

  revealNext() {
    const next = this.definitions.find((item) => !this.discovered.has(item.id)) || this.definitions[0];
    const definition = this.select(next.id, false);
    const node = this.nodesRoot?.querySelector(`[data-module="${next.id}"]`);
    node?.classList.add('is-targeted');
    setTimeout(() => node?.classList.remove('is-targeted'), 2200);
    if (definition && typeof Character !== 'undefined') {
      Character.say(
        this.discovered.size >= this.definitions.length
          ? '所有记忆都已连接。你可以随时重新访问任何节点。'
          : `下一个未连接信号是「${definition.title}」。先看看它留下的提示吧。`,
        3600
      );
    }
    return definition;
  },

  resize() {
    if (!this.canvas || !this.root) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.width = this.root.clientWidth;
    this.height = this.root.clientHeight;
    this.canvas.width = Math.max(1, Math.round(this.width * ratio));
    this.canvas.height = Math.max(1, Math.round(this.height * ratio));
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  },

  loop(now = performance.now()) {
    requestAnimationFrame((next) => this.loop(next));
    if (!this.ctx || document.hidden) return;
    if (now - this.lastFrame < 32) return;
    this.lastFrame = now;
    this.time += 0.012;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    for (const [aIndex, bIndex] of this.links) {
      const a = this.point(this.definitions[aIndex]);
      const b = this.point(this.definitions[bIndex]);
      const active = this.discovered.has(this.definitions[aIndex].id) && this.discovered.has(this.definitions[bIndex].id);
      ctx.strokeStyle = active ? 'rgba(242,198,109,0.38)' : 'rgba(232,245,248,0.18)';
      ctx.lineWidth = active ? 1.2 : 0.7;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      const phase = (this.time + aIndex * 0.17 + bIndex * 0.11) % 1;
      const x = a.x + (b.x - a.x) * phase;
      const y = a.y + (b.y - a.y) * phase;
      ctx.fillStyle = active ? 'rgba(242,198,109,0.8)' : 'rgba(89,210,230,0.55)';
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  },

  point(definition) {
    return { x: this.width * definition.x / 100, y: this.height * definition.y / 100 };
  },

  syncWindowState() {
    const visible = Object.values(WindowManager.windows || {}).some((item) => item.state !== 'minimized');
    document.body.classList.toggle('memory-window-open', visible);
  },

  updateProgress() {
    if (this.progress) this.progress.textContent = `${String(this.discovered.size).padStart(2,'0')} / 06`;
  },

  persist() {
    try { localStorage.setItem('memory_network_discovered', JSON.stringify([...this.discovered])); } catch (_) {}
  },

  restore() {
    try {
      const saved = JSON.parse(localStorage.getItem('memory_network_discovered') || '[]');
      if (Array.isArray(saved)) this.discovered = new Set(saved);
    } catch (_) { this.discovered = new Set(); }
  },
};
