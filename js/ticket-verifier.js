const TicketVerifier = {
  init() {
    if (this._initialized) return;
    this.panel = document.getElementById('ticket-verifier-panel');
    this.form = document.getElementById('ticket-verifier-form');
    this.input = document.getElementById('ticket-verifier-input');
    this.status = document.getElementById('ticket-verifier-status');
    this.result = document.getElementById('ticket-verifier-result');
    this.importButton = document.getElementById('ticket-verifier-import');
    this.fileInput = document.getElementById('ticket-verifier-file');
    if (!this.panel || !this.form || !this.input) return;
    this._initialized = true;
    this.panel.dataset.initialized = 'true';
    document.getElementById('ticket-verifier-close')?.addEventListener('click', () => this.close());
    this.input.addEventListener('input', () => { this.input.value = this.normalize(this.input.value); });
    this.form.addEventListener('submit', (event) => { event.preventDefault(); this.verify(this.input.value); });
    this.form.querySelector('button[type="submit"]')?.addEventListener('click', (event) => {
      event.preventDefault();
      this.verify(this.input.value);
    });
    this.importButton?.addEventListener('click', () => this.fileInput?.click());
    this.fileInput?.addEventListener('change', () => this.importImage(this.fileInput.files?.[0]));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.panel.classList.contains('is-open')) this.close();
    });
  },

  async importImage(file) {
    if (!file) return;
    this.panel.dataset.state = 'scanning';
    this.status.textContent = 'DECODING';
    this.result.innerHTML = '<p>正在本地读取二维码图像……</p>';
    try {
      const credential = await TicketQrImport.decodeFile(file);
      this.input.value = credential;
      await this.verify(credential);
    } catch (error) {
      this.renderInvalid(error?.message || '二维码图片无法识别。');
    } finally {
      this.fileInput.value = '';
    }
  },

  open(credential = '') {
    if (!this.panel) return;
    this.panel.classList.add('is-open');
    this.panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('ticket-verifier-open');
    if (credential) {
      this.input.value = this.normalize(credential);
      this.verify(this.input.value);
    }
    setTimeout(() => this.input.focus(), 180);
  },

  close() {
    this.panel?.classList.remove('is-open');
    this.panel?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('ticket-verifier-open');
  },

  normalize(value) {
    const hex = String(value || '').toUpperCase().replace(/[^A-F0-9]/g, '').slice(0, 12);
    return hex.match(/.{1,4}/g)?.join('-') || '';
  },

  async verify(raw) {
    const credential = this.normalize(raw);
    this.input.value = credential;
    if (!/^[A-F0-9]{4}(?:-[A-F0-9]{4}){2}$/.test(credential)) {
      this.renderInvalid('校验码格式应为 XXXX-XXXX-XXXX');
      return;
    }
    this.panel.dataset.state = 'scanning';
    this.status.textContent = 'SCANNING';
    this.result.innerHTML = '<p>正在连接签发记录库……</p>';
    try {
      const response = await fetch(`/api/tickets/verify/${encodeURIComponent(credential)}`, {
        headers: { Accept: 'application/json' }, cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.valid || !data.ticket) throw new Error('invalid');
      this.renderValid(data.ticket);
    } catch (_) {
      this.renderInvalid('没有找到与该校验码匹配的服务器签发记录。');
    }
  },

  renderValid(ticket) {
    this.panel.dataset.state = 'valid';
    this.status.textContent = 'VALID';
    const number = `NO.${String(Number(ticket.number) || 0).padStart(5, '0')}`;
    const date = new Date(ticket.issuedAt).toLocaleString('zh-CN', { hour12: false });
    this.result.innerHTML = `
      <div class="ticket-verifier-verdict"><span>SERVER VERIFIED</span><strong>${number}</strong></div>
      <dl>
        <div><dt>ISSUED TO</dt><dd>${this.escape(ticket.displayName)}</dd></div>
        <div><dt>EDITION</dt><dd>${this.escape(String(ticket.style).toUpperCase())}</dd></div>
        <div><dt>ISSUED AT</dt><dd>${this.escape(date)}</dd></div>
        <div><dt>CREDENTIAL</dt><dd>${this.escape(ticket.credential)}</dd></div>
      </dl>`;
    Sound?.play?.('achievement');
  },

  renderInvalid(message) {
    this.panel.dataset.state = 'invalid';
    this.status.textContent = 'INVALID';
    this.result.innerHTML = `<div class="ticket-verifier-verdict"><span>ACCESS DENIED</span><strong>NO RECORD</strong></div><p>${this.escape(message)}</p>`;
  },

  escape(value) {
    const node = document.createElement('span');
    node.textContent = String(value ?? '');
    return node.innerHTML;
  },
};

// The verifier must remain usable even while the heavier 3D character stack is
// still loading. app.js calls init again later; the guard above keeps it safe.
TicketVerifier.init();
