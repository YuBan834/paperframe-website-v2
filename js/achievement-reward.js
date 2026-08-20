const AchievementReward = {
  storageKey: 'paperframe_visitor_ticket',
  deviceKey: 'paperframe_ticket_device',
  ticket: null,

  init() {
    this.root = document.getElementById('achievement-reward');
    this.form = document.getElementById('ticket-claim-form');
    this.nameInput = document.getElementById('ticket-display-name');
    this.claimButton = document.getElementById('ticket-claim-button');
    this.message = document.getElementById('ticket-claim-message');
    this.claimedCard = document.getElementById('ticket-claimed-card');
    if (!this.root || !this.form) return;

    this.ticket = loadSetting(this.storageKey, null);
    this.form.addEventListener('submit', (event) => this.claim(event));
    document.getElementById('ticket-redownload')?.addEventListener('click', () => this.download(this.ticket));
    EventBus.on('achievement:unlocked', () => this.sync());
    this.sync();
  },

  progress() {
    const found = new Set(loadSetting('found_eggs', []));
    const complete = CORE_ACHIEVEMENT_IDS.filter((id) => found.has(id));
    return { count: complete.length, total: CORE_ACHIEVEMENT_IDS.length, complete };
  },

  sync() {
    const state = this.progress();
    const ratio = state.total ? state.count / state.total : 0;
    const ready = state.count === state.total;
    const claimed = Boolean(this.ticket?.credential);
    const trophy = document.getElementById('achievement-trophy');
    const stateLabel = document.getElementById('achievement-reward-state');
    const copy = document.getElementById('achievement-reward-copy');
    const dots = document.getElementById('achievement-reward-dots');

    if (trophy) {
      trophy.style.setProperty('--achievement-fill', `${Math.round(ratio * 100)}%`);
      trophy.classList.toggle('is-complete', ready);
      trophy.classList.toggle('is-claimable', ready && !claimed);
      trophy.classList.toggle('is-claimed', claimed);
      trophy.title = claimed ? '数字访问票已领取' : `成就进度 ${state.count} / ${state.total}`;
      trophy.setAttribute('aria-label', trophy.title);
      const count = trophy.querySelector('.achievement-trophy-count');
      if (count) count.textContent = `${state.count}/${state.total}`;
    }

    this.root?.classList.toggle('is-locked', !ready);
    this.root?.classList.toggle('is-ready', ready && !claimed);
    this.root?.classList.toggle('is-claimed', claimed);
    if (stateLabel) stateLabel.textContent = claimed ? 'CLAIMED' : (ready ? 'READY TO ISSUE' : 'LOCKED');
    if (copy) {
      copy.textContent = claimed
        ? `访问票已签发给「${this.ticket.displayName}」。复制图片不会产生新的编号。`
        : ready
          ? '六项信号已经同步。输入票面名称，系统会随机签发四张票中的一张。'
          : `还差 ${state.total - state.count} 项核心成就。奖杯会随着进度逐级点亮。`;
    }

    if (dots) {
      dots.textContent = '';
      CORE_ACHIEVEMENT_IDS.forEach((id) => {
        const dot = document.createElement('i');
        dot.className = `achievement-reward-dot${state.complete.includes(id) ? ' is-complete' : ''}`;
        dot.title = EASTER_EGGS[id]?.name || id;
        dots.appendChild(dot);
      });
    }

    this.form?.classList.toggle('hidden', !ready || claimed);
    this.claimedCard?.classList.toggle('hidden', !claimed);
    const number = document.getElementById('ticket-issued-number');
    if (number && claimed) number.textContent = this.formatNumber(this.ticket.number);
    const issuedStyle = document.getElementById('ticket-issued-style');
    if (issuedStyle && claimed) {
      const definition = ACHIEVEMENT_TICKETS.find((item) => item.id === this.ticket.style);
      issuedStyle.textContent = `ISSUED // ${definition?.label || 'RANDOM'}`;
    }
  },

  async claim(event) {
    event.preventDefault();
    if (this.progress().count !== CORE_ACHIEVEMENT_IDS.length) return;
    const displayName = String(this.nameInput?.value || '').trim();
    if (!displayName || displayName.length > 18) {
      this.setMessage('请输入 1–18 个字符的票面名称。', true);
      return;
    }

    this.claimButton.disabled = true;
    this.setMessage('正在向服务器申请唯一编号……');
    try {
      const response = await fetch('/api/tickets/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          deviceId: this.deviceId(),
          achievements: [...CORE_ACHIEVEMENT_IDS],
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || '票券签发失败');
      this.ticket = result.ticket;
      saveSetting(this.storageKey, this.ticket);
      this.sync();
      await this.download(this.ticket);
      Sound?.play?.('achievement');
      Character?.playAnimation?.('clapping', { state: 'reward' });
      Character?.say?.(`访问票已经签发给「${this.ticket.displayName}」。收好就行。`, 4200);
    } catch (error) {
      this.setMessage(`${error.message}。请确认网站由项目服务器启动。`, true);
    } finally {
      this.claimButton.disabled = false;
    }
  },

  async download(ticket) {
    if (!ticket) return;
    const style = ACHIEVEMENT_TICKETS.find((item) => item.id === ticket.style) || ACHIEVEMENT_TICKETS[0];
    this.setMessage('正在打印票面……');
    try {
      const image = await this.loadImage(style.src);
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      this.printPersonalization(context, canvas, ticket);
      await this.printVerificationQr(context, canvas, ticket);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('浏览器无法生成图片');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `PaperFrame-${this.formatNumber(ticket.number).replace('.', '-')}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      this.setMessage('访问票已下载。');
    } catch (error) {
      this.setMessage(error.message || '票面生成失败', true);
    }
  },

  printPersonalization(context, canvas, ticket) {
    const width = canvas.width;
    const height = canvas.height;
    const paper = '#f5f0e7';
    const ink = '#111315';
    const cyan = '#3aaebb';

    // Replace the template name while preserving the surrounding ISSUED TO label and rule.
    context.fillStyle = paper;
    // The printable name belongs to the narrow information column. The old
    // clearing rectangle extended into Misaki's face on poses that lean left.
    // Keep both the eraser and the text strictly inside the original
    // "YOUR NAME" footprint, then scale long names down within that column.
    const nameX = width * .315;
    const nameWidth = width * .16;
    context.fillRect(nameX, height * .16, nameWidth, height * .045);
    context.fillStyle = '#b47b17';
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    this.fitText(
      context,
      ticket.displayName,
      width * .145,
      width * .325,
      height * .192,
      Math.round(width * .027),
      Math.round(width * .014)
    );

    // Every valid image carries its server-issued sequential number.
    context.fillStyle = paper;
    context.fillRect(width * .188, height * .817, width * .41, height * .092);
    context.fillStyle = ink;
    context.font = `800 ${Math.round(width * .085)}px "Arial Narrow", "Consolas", sans-serif`;
    context.fillText(this.formatNumber(ticket.number), width * .198, height * .891);

    // The short server signature is the verifiable credential printed on the ticket.
    context.fillStyle = paper;
    context.fillRect(width * .505, height * .922, width * .245, height * .025);
    context.fillStyle = cyan;
    context.font = `700 ${Math.round(width * .016)}px "Consolas", monospace`;
    context.fillText(String(ticket.credential || '').toUpperCase(), width * .51, height * .941);
  },

  async printVerificationQr(context, canvas, ticket) {
    if (!ticket?.credential) throw new Error('票券缺少检票凭证');
    const qr = await this.loadImage(`/api/tickets/qr/${encodeURIComponent(ticket.credential)}`);
    const size = Math.round(canvas.width * .108);
    const x = Math.round(canvas.width * .615);
    const y = Math.round(canvas.height * .835);
    context.fillStyle = '#f5f0e7';
    context.fillRect(x - 5, y - 5, size + 10, size + 10);
    context.drawImage(qr, x, y, size, size);
  },

  fitText(context, text, maxWidth, x, y, maxFontSize = 24, minFontSize = 12) {
    const family = '"Arial Narrow", "Microsoft YaHei", sans-serif';
    let fontSize = maxFontSize;
    let output = String(text);
    context.font = `700 ${fontSize}px ${family}`;
    while (fontSize > minFontSize && context.measureText(output).width > maxWidth) {
      fontSize -= 1;
      context.font = `700 ${fontSize}px ${family}`;
    }
    if (context.measureText(output).width > maxWidth) {
      while (output.length > 1 && context.measureText(`${output}…`).width > maxWidth) output = output.slice(0, -1);
      output += '…';
    }
    context.fillText(output, x, y);
  },

  loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('票面素材加载失败'));
      image.src = src;
    });
  },

  formatNumber(value) {
    return `NO.${String(Number(value) || 0).padStart(5, '0')}`;
  },

  deviceId() {
    let id = localStorage.getItem(this.deviceKey);
    if (!id) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      id = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(this.deviceKey, id);
    }
    return id;
  },

  setMessage(text, isError = false) {
    if (!this.message) return;
    this.message.textContent = text || '';
    this.message.classList.toggle('is-error', isError);
  },
};
