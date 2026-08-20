const FieldConsole = {
  entries: [],
  selectedMemory: null,
  startedAt: Date.now(),

  init() {
    this.root = document.getElementById('field-console');
    if (!this.root) return;
    this.title = document.getElementById('field-memory-title');
    this.detail = document.getElementById('field-memory-detail');
    this.openButton = document.getElementById('field-memory-open');
    this.nextButton = document.getElementById('field-memory-next');
    this.trace = document.getElementById('field-trace-list');
    this.characterState = document.getElementById('field-character-state');
    this.linkState = document.getElementById('field-link-state');
    this.sessionTime = document.getElementById('field-session-time');

    this.openButton?.addEventListener('click', () => {
      if (!this.selectedMemory) return;
      EventBus.emit('desktop:open-window', this.selectedMemory.id);
      this.log(`OPENED ${this.selectedMemory.label} ARCHIVE`);
    });
    this.nextButton?.addEventListener('click', () => MemoryNetwork?.revealNext?.());

    EventBus.on('memory:selected', (memory) => this.selectMemory(memory));
    EventBus.on('memory:activated', ({ id, isNew }) => {
      const memory = MemoryNetwork.definitions.find((item) => item.id === id);
      if (memory) this.log(`${isNew ? 'DISCOVERED' : 'ACCESSED'} ${memory.label}`);
    });
    EventBus.on('window:opened', ({ type }) => this.log(`WINDOW ${String(type || '').toUpperCase()} ONLINE`));
    EventBus.on('character:state-changed', ({ state }) => this.setCharacterState(state));
    EventBus.on('chat:opened', () => this.log('MENTAL LINK CHANNEL OPEN'));
    EventBus.on('chat:phase', ({ phase }) => {
      const label = phase === 'thinking' ? 'DEEPSEEK THINKING' : 'DEEPSEEK RESPONDING';
      this.linkState.textContent = phase === 'thinking' ? 'THINKING' : 'STREAMING';
      this.log(label);
    });
    EventBus.on('chat:response', ({ provider }) => {
      this.linkState.textContent = provider === 'deepseek' ? 'DEEPSEEK' : 'LOCAL';
      this.log(`RESPONSE VIA ${provider === 'deepseek' ? 'DEEPSEEK' : 'LOCAL CORE'}`);
    });
    EventBus.on('easteregg:found', ({ id }) => this.log(`ACHIEVEMENT ${String(id || '').toUpperCase()}`));

    this.log('VISITOR SESSION INITIALIZED');
    this.setCharacterState(typeof AnimationManager !== 'undefined' ? AnimationManager.currentState : 'idle');
    this.updateSession();
    this.sessionTimer = setInterval(() => this.updateSession(), 1000);
    this.checkLink();
  },

  selectMemory(memory) {
    this.selectedMemory = memory;
    if (this.title) this.title.textContent = `${memory.label} // ${memory.title}`;
    if (this.detail) this.detail.textContent = memory.detail;
    if (this.openButton) this.openButton.disabled = false;
    this.log(`SIGNAL FOCUSED ${memory.label}`);
  },

  log(message) {
    const elapsed = Math.floor((Date.now() - this.startedAt) / 1000);
    const stamp = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
    this.entries.unshift({ stamp, message });
    this.entries = this.entries.slice(0, 3);
    if (!this.trace) return;
    this.trace.textContent = '';
    for (const entry of this.entries) {
      const item = document.createElement('li');
      const time = document.createElement('time');
      const text = document.createElement('span');
      time.textContent = entry.stamp;
      text.textContent = entry.message;
      item.append(time, text);
      this.trace.appendChild(item);
    }
  },

  setCharacterState(state) {
    const labels = {
      idle: 'STANDBY', chatting: 'LISTENING', attentive: 'ATTENTIVE',
      greeting: 'GREETING', surprised: 'ALERT', celebrate: 'DELIGHTED',
      shy: 'FLUSTERED', annoyed: 'ANNOYED', sleepy: 'LOW ENERGY', reacting: 'RESPONDING',
    };
    if (this.characterState) this.characterState.textContent = labels[state] || String(state || 'ONLINE').toUpperCase();
  },

  updateSession() {
    if (!this.sessionTime) return;
    const elapsed = Math.floor((Date.now() - this.startedAt) / 1000);
    this.sessionTime.textContent = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  },

  async checkLink() {
    try {
      const response = await fetch('/api/chat/status', { headers: { Accept: 'application/json' } });
      const status = await response.json();
      if (this.linkState) this.linkState.textContent = status.configured ? 'DEEPSEEK' : 'LOCAL';
    } catch (_) {
      if (this.linkState) this.linkState.textContent = 'OFFLINE';
    }
  },
};
