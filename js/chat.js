/* Mental Link chat system
 * The UI owns conversation state; Character only supplies animation/expression
 * reactions. API credentials remain server-side.
 */
const Chat = {
  panel: null,
  messagesEl: null,
  input: null,
  sendButton: null,
  statusEl: null,
  modelEl: null,
  messages: [],
  busy: false,
  controller: null,
  thinkingNode: null,
  remoteConfigured: false,
  maxHistory: 12,

  init() {
    this.panel = document.getElementById('mental-link-panel');
    this.messagesEl = document.getElementById('mental-link-messages');
    this.input = document.getElementById('mental-link-input');
    this.sendButton = document.getElementById('mental-link-send');
    this.statusEl = document.getElementById('mental-link-status');
    this.modelEl = document.getElementById('mental-link-model');
    if (!this.panel || !this.messagesEl || !this.input) return;

    document.getElementById('mental-link-launcher')?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.open();
    });
    document.getElementById('mental-link-close')?.addEventListener('click', () => this.close());
    document.getElementById('mental-link-reset')?.addEventListener('click', () => this.reset());
    document.getElementById('mental-link-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.send();
    });
    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.send();
      }
    });
    document.getElementById('mental-link-suggestions')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-message]');
      if (button) this.send(button.dataset.message);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen()) this.close();
    });

    EventBus.on('chat:send', (message) => this.send(message));
    EventBus.on('lang:changed', () => this.render());

    this.restore();
    if (!this.messages.length) {
      this.messages.push({
        role: 'assistant',
        content: 'Mental Link 已建立。想先聊聊，还是让我带你探索这里？',
      });
    }
    this.render();
    this.checkStatus();
  },

  isOpen() {
    return this.panel?.classList.contains('is-open') || false;
  },

  open() {
    if (!this.panel) return;
    const wasOpen = this.isOpen();
    this.panel.classList.add('is-open');
    this.panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('mental-link-open');
    Character.isChatMode = true;
    Character.bubble?.classList.add('hidden');
    Character.playAnimation?.('thinking', { state: 'chatting' });
    if (!wasOpen) EventBus.emit('chat:opened');
    setTimeout(() => this.input?.focus(), 260);
  },

  close() {
    if (!this.panel) return;
    const wasOpen = this.isOpen();
    this.panel.classList.remove('is-open');
    this.panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('mental-link-open');
    Character.isChatMode = false;
    Character.returnToIdle?.();
    if (wasOpen) EventBus.emit('chat:closed');
  },

  async checkStatus() {
    try {
      const response = await fetch('/api/chat/status', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('status unavailable');
      const data = await response.json();
      this.remoteConfigured = Boolean(data.configured);
      this.setStatus(data.configured ? 'online' : 'local', data.configured ? 'AI 在线' : '本地模式');
      if (this.modelEl) this.modelEl.textContent = data.configured ? String(data.model).toUpperCase() : 'SAFE LOCAL FALLBACK';
    } catch (_) {
      this.setStatus('local', '本地模式');
    }
  },

  async send(message) {
    const text = String(message ?? this.input?.value ?? '').trim();
    if (!text || this.busy) return;
    if (this.input) this.input.value = '';

    this.busy = true;
    this.sendButton.disabled = true;
    this.setStatus('busy', '思考中');
    this.messages.push({ role: 'user', content: text.slice(0, 240) });
    this.trimHistory();
    this.render();
    this.showThinking();
    Character.playAnimation?.('thinking', { state: 'chatting' });

    const preset = this.findPreset(text);
    try {
      let payload;
      if (preset && !this.remoteConfigured) {
        await this.pause(320);
        payload = { reply: preset, emotion: 'joy', action: 'idle', provider: 'local' };
      } else {
        payload = await this.requestRemote(text);
      }

      this.hideThinking();
      const reply = String(payload.reply || '信号有些模糊，请再说一次。').slice(0, 260);
      const messageRecord = { role: 'assistant', content: '' };
      this.messages.push(messageRecord);
      this.trimHistory();
      Character.playAnimation?.('talking', { state: 'chatting' });
      await this.typeMessage(messageRecord, reply);
      this.react(payload.emotion, payload.action);
      EventBus.emit('chat:response', { provider: payload.provider || 'local', emotion: payload.emotion, action: payload.action });
      this.setStatus(payload.provider === 'deepseek' ? 'online' : 'local', payload.provider === 'deepseek' ? 'AI 在线' : '本地模式');
      if (this.modelEl && payload.model) this.modelEl.textContent = String(payload.model).toUpperCase();
      if (!this.isOpen()) Character.say?.(reply, 4200);
      this.persist();
    } catch (error) {
      this.hideThinking();
      if (error.name !== 'AbortError') {
        const fallback = 'Mental Link 暂时受到干扰。不过别担心，我还在这里。你可以先让我带你看看网站。';
        this.messages.push({ role: 'assistant', content: fallback });
        this.trimHistory();
        this.render();
        if (!this.isOpen()) Character.say?.(fallback, 3800);
        this.setStatus('error', '信号中断');
      }
    } finally {
      this.busy = false;
      this.sendButton.disabled = false;
      this.controller = null;
      if (this.isOpen()) this.input?.focus();
    }
  },

  async requestRemote(message) {
    this.controller?.abort();
    this.controller = new AbortController();
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
      body: JSON.stringify({
        message,
        history: this.messages.slice(0, -1).slice(-6),
        lang: typeof currentLang === 'string' ? currentLang : 'zh',
      }),
      signal: this.controller.signal,
    });
    if (!response.body) throw new Error('Mental Link stream unavailable');

    let buffer = '';
    let result = null;
    let serverError = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = done ? '' : lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === 'phase') this.setPhase(event.phase);
        if (event.type === 'result') result = event;
        if (event.type === 'error') serverError = event.message || 'Mental Link unavailable';
      }
      if (done) break;
    }
    if (!response.ok || serverError) throw new Error(serverError || `Mental Link HTTP ${response.status}`);
    if (!result) throw new Error('Mental Link returned no result');
    return result;
  },

  setPhase(phase) {
    EventBus.emit('chat:phase', { phase });
    if (phase === 'thinking') {
      this.setStatus('thinking', '思考中');
      this.showThinking();
      Character.playAnimation?.('thinking', { state: 'chatting' });
      return;
    }
    if (phase === 'responding') {
      this.setStatus('responding', '回应中');
      this.hideThinking();
      Character.playAnimation?.('talking', { state: 'chatting' });
    }
  },

  showThinking() {
    if (!this.messagesEl || this.thinkingNode?.isConnected) return;
    const node = document.createElement('div');
    node.className = 'mental-message assistant is-thinking';
    node.setAttribute('aria-label', '食蜂操祈正在思考');
    node.innerHTML = '<span>正在思考</span><i></i><i></i><i></i>';
    this.messagesEl.appendChild(node);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    this.thinkingNode = node;
  },

  hideThinking() {
    this.thinkingNode?.remove();
    this.thinkingNode = null;
  },

  findPreset(message) {
    try {
      const presets = I18N?.[currentLang]?.charReplies || {};
      const lower = message.toLowerCase();
      for (const [trigger, reply] of Object.entries(presets)) {
        if (lower.includes(trigger.toLowerCase())) return reply;
      }
    } catch (_) {}
    return null;
  },

  react(emotion = 'neutral', action = 'idle') {
    const expressionMap = {
      neutral: 'neutral', joy: 'joy', amused: 'fun', curious: 'surprised',
      surprised: 'surprised', annoyed: 'angry', sad: 'sorrow', shy: 'fun',
    };
    const animationMap = {
      idle: 'idle', greeting: 'greeting', thinking: 'thinking', surprised: 'surprised',
      clapping: 'clapping', laughing: 'laughing', talking: 'talking',
      shy: 'tsundere', tsundere: 'tsundere', annoyed: 'angry', sleepy: 'yawn', yawn: 'yawn',
    };
    Character.setExpression?.(expressionMap[emotion] || 'neutral', 0.22);
    const animation = animationMap[action] || 'idle';
    Character.playAnimation?.(animation, { state: animation === 'idle' ? 'idle' : 'reacting' });
    if (animation !== 'thinking') {
      setTimeout(() => {
        if (!this.busy) {
          Character.resetExpression?.(0.45);
          if (!this.isOpen()) Character.returnToIdle?.();
        }
      }, 2800);
    }
  },

  appendMessage(record) {
    const node = document.createElement('div');
    node.className = `mental-message ${record.role === 'user' ? 'user' : 'assistant'}`;
    node.textContent = record.content;
    this.messagesEl.appendChild(node);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return node;
  },

  render() {
    if (!this.messagesEl) return;
    this.messagesEl.textContent = '';
    this.messages.forEach((record) => this.appendMessage(record));
  },

  async typeMessage(record, text) {
    const node = this.appendMessage(record);
    node.classList.add('is-typing');
    const step = Math.max(1, Math.ceil(text.length / 90));
    for (let index = 0; index < text.length; index += step) {
      record.content = text.slice(0, index + step);
      node.textContent = record.content;
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
      await this.pause(18);
    }
    record.content = text;
    node.textContent = text;
    node.classList.remove('is-typing');
  },

  setStatus(state, label) {
    if (!this.statusEl) return;
    this.statusEl.dataset.state = state;
    this.statusEl.textContent = label;
  },

  trimHistory() {
    if (this.messages.length > this.maxHistory) {
      this.messages = this.messages.slice(-this.maxHistory);
    }
  },

  persist() {
    try { sessionStorage.setItem('mental_link_history', JSON.stringify(this.messages)); } catch (_) {}
  },

  restore() {
    try {
      const records = JSON.parse(sessionStorage.getItem('mental_link_history') || '[]');
      if (Array.isArray(records)) {
        this.messages = records.filter((item) =>
          ['user', 'assistant'].includes(item?.role) && typeof item.content === 'string'
        ).slice(-this.maxHistory);
      }
    } catch (_) { this.messages = []; }
  },

  reset() {
    this.controller?.abort();
    this.hideThinking();
    this.busy = false;
    this.messages = [{ role: 'assistant', content: '这次的记忆已经清空。重新认识一下吧？' }];
    try { sessionStorage.removeItem('mental_link_history'); } catch (_) {}
    this.render();
    this.setStatus('local', '记忆已清除');
  },

  pause(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
};
