(function () {
  'use strict';
  const form = document.getElementById('gate-verify-form');
  const input = document.getElementById('gate-credential');
  const message = document.getElementById('gate-message');
  const result = document.getElementById('gate-result');
  const button = form?.querySelector('button');
  const importButton = document.getElementById('gate-import-button');
  const fileInput = document.getElementById('gate-import-file');
  const systemState = document.getElementById('gate-system-state');

  function normalize(value) {
    const hex = String(value || '').toUpperCase().replace(/[^A-F0-9]/g, '').slice(0, 12);
    return hex.match(/.{1,4}/g)?.join('-') || '';
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function resetFields() {
    setText('gate-result-number', 'NO.-----');
    setText('gate-result-name', '—');
    setText('gate-result-style', '—');
    setText('gate-result-date', '—');
    setText('gate-result-credential', '—');
  }

  async function verify(raw) {
    const credential = normalize(raw);
    input.value = credential;
    if (!/^[A-F0-9]{4}(?:-[A-F0-9]{4}){2}$/.test(credential)) {
      result.dataset.state = 'invalid';
      setText('gate-result-label', 'INVALID FORMAT');
      message.textContent = '校验码应为三组四位字符。';
      resetFields();
      return;
    }

    result.dataset.state = 'scanning';
    setText('gate-result-label', 'VERIFYING');
    message.textContent = '正在连接签发服务器……';
    button.disabled = true;
    try {
      const response = await fetch(`/api/tickets/verify/${encodeURIComponent(credential)}`, {
        headers: { Accept: 'application/json' }, cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.valid || !data.ticket) throw new Error('NOT_FOUND');
      const ticket = data.ticket;
      result.dataset.state = 'valid';
      setText('gate-result-label', 'VALID / SERVER VERIFIED');
      setText('gate-result-number', `NO.${String(Number(ticket.number) || 0).padStart(5, '0')}`);
      setText('gate-result-name', ticket.displayName || '—');
      setText('gate-result-style', String(ticket.style || '—').toUpperCase());
      setText('gate-result-date', new Date(ticket.issuedAt).toLocaleString('zh-CN', { hour12: false }));
      setText('gate-result-credential', ticket.credential || credential);
      message.textContent = '凭证存在，签名与服务器记录一致。';
      systemState.textContent = 'ACCESS GRANTED';
    } catch (_) {
      result.dataset.state = 'invalid';
      setText('gate-result-label', 'INVALID / NO RECORD');
      resetFields();
      setText('gate-result-credential', credential);
      message.textContent = '未找到有效签发记录，或票面凭证已被修改。';
      systemState.textContent = 'ACCESS DENIED';
    } finally {
      button.disabled = false;
    }
  }

  input?.addEventListener('input', () => { input.value = normalize(input.value); });
  form?.addEventListener('submit', (event) => { event.preventDefault(); verify(input.value); });
  importButton?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    result.dataset.state = 'scanning';
    systemState.textContent = 'DECODING';
    setText('gate-result-label', 'READING QR IMAGE');
    message.textContent = '正在本地读取二维码图像……';
    try {
      const credential = await TicketQrImport.decodeFile(file);
      input.value = credential;
      await verify(credential);
    } catch (error) {
      result.dataset.state = 'invalid';
      systemState.textContent = 'ACCESS DENIED';
      setText('gate-result-label', 'INVALID / QR UNREADABLE');
      resetFields();
      message.textContent = error?.message || '二维码图片无法识别。';
    } finally {
      fileInput.value = '';
    }
  });

  const pathMatch = location.pathname.match(/\/ticket\/verify\/([^/]+)/i);
  const initial = pathMatch?.[1] || new URLSearchParams(location.search).get('credential');
  if (initial) verify(decodeURIComponent(initial));
})();
