const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const QRCode = require('qrcode');

const ROOT = __dirname;
loadLocalEnv(path.join(ROOT, '.env'));

const app = express();
const PORT = Number(process.env.PORT || 8080);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const HOST = String(process.env.HOST || (IS_PRODUCTION ? '127.0.0.1' : '0.0.0.0'));
const DEEPSEEK_API_KEY = String(process.env.DEEPSEEK_API_KEY || '').trim();
// Product decision: Mental Link always uses Flash. Do not let a deployment
// environment silently switch visitors to a more expensive model.
const DEEPSEEK_MODEL = 'deepseek-v4-flash';
const DEEPSEEK_BASE_URL = String(process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
const PUBLIC_BASE_URL = normalizePublicBaseUrl(process.env.PUBLIC_BASE_URL);
const PRIVATE_DATA_DIR = path.resolve(process.env.DATA_DIR || process.env.TICKET_DATA_DIR || path.join(ROOT, '.private'));
const CHAT_LIMITS = Object.freeze({
  messageChars: 240,
  historyTurns: 6,
  historyItemChars: 360,
  historyTotalChars: 1800,
  responseChars: 260,
  outputTokens: 640,
});

validateProductionConfig();

app.disable('x-powered-by');
if (IS_PRODUCTION) app.set('trust proxy', 1);
app.use(express.json({ limit: '32kb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "media-src 'self' blob:",
    "connect-src 'self' blob:",
    "form-action 'self'",
  ].join('; '));
  if (IS_PRODUCTION && req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Expose only the browser build required for local QR image decoding.
app.use('/vendor/jsqr', express.static(path.join(ROOT, 'node_modules', 'jsqr', 'dist'), {
  etag: true,
  maxAge: IS_PRODUCTION ? '7d' : 0,
}));

const staticOptions = {
  etag: true,
  fallthrough: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    } else if (/\.(json|js|css)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else if (/\.(vrm|vrma|woff2?|ttf|png|jpe?g|gif|webp|mp4|webm|mp3|ogg)$/i.test(filePath)) {
      res.setHeader('Cache-Control', IS_PRODUCTION ? 'public, max-age=604800' : 'no-cache');
    }
    if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    if (filePath.endsWith('.vrm') || filePath.endsWith('.vrma')) res.setHeader('Content-Type', 'application/octet-stream');
    if (filePath.endsWith('.glb') || filePath.endsWith('.gltf')) res.setHeader('Content-Type', 'model/gltf-binary');
  },
};

// Production serves a strict browser-asset allowlist. Never expose the
// repository root: it contains environment files, private ticket records,
// source packs, reports and the append-only contact log.
for (const directory of ['assets', 'css', 'js', 'data']) {
  app.use(`/${directory}`, express.static(path.join(ROOT, directory), staticOptions));
}
app.get('/shokuhou.vrm', (req, res) => sendPublicFile(res, path.join(ROOT, 'shokuhou.vrm')));

app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(ROOT, 'index.html'));
});
app.get('/index.html', (req, res) => res.redirect(308, '/'));
app.get(['/ticket/verify', '/ticket/verify/:credential'], (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(ROOT, 'ticket.html'));
});

/* Contact form */
const MESSAGES_FILE = path.resolve(process.env.MESSAGES_FILE || path.join(PRIVATE_DATA_DIR, 'messages.txt'));
const contactLimiter = createRateLimiter(60_000, 1);
let messageWriteQueue = Promise.resolve();

app.post('/api/submit', requireSameOrigin, requireJson, async (req, res) => {
  const body = req.body || {};
  const name = cleanText(body.name, 10);
  const contact = cleanText(body.contact, 30);
  const message = cleanText(body.message, 1000);
  if (!name || !contact || !message) return res.status(400).json({ error: '内容不能为空' });
  if (!contactLimiter.allow(req.ip)) return res.status(429).json({ error: '提交太频繁，请一分钟后再试' });

  const singleLine = `${new Date().toISOString()} | ${oneLine(name)} | ${oneLine(contact)} | ${oneLine(message)}\n`;
  try {
    fs.mkdirSync(path.dirname(MESSAGES_FILE), { recursive: true });
    messageWriteQueue = messageWriteQueue.catch(() => {}).then(() => fs.promises.appendFile(MESSAGES_FILE, singleLine, { encoding: 'utf8', mode: 0o600 }));
    await messageWriteQueue;
    res.json({ success: true });
  } catch (error) {
    console.error('[Contact] append failed:', error.message);
    res.status(500).json({ error: '写入失败' });
  }
});

/* Mental Link / DeepSeek adapter */
const chatLimiter = createRateLimiter(60_000, 12);
const ALLOWED_EMOTIONS = new Set(['neutral', 'joy', 'amused', 'curious', 'surprised', 'annoyed', 'sad', 'shy']);
const ALLOWED_ACTIONS = new Set([
  'idle', 'greeting', 'thinking', 'talking', 'laughing', 'surprised',
  'clapping', 'tsundere', 'shy', 'annoyed', 'yawn', 'sleepy',
]);

app.get('/api/chat/status', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    configured: Boolean(DEEPSEEK_API_KEY),
    model: DEEPSEEK_MODEL,
    thinking: true,
    limits: CHAT_LIMITS,
  });
});

app.post('/api/chat', requireSameOrigin, requireJson, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!chatLimiter.allow(req.ip)) return res.status(429).json({ error: 'Mental Link 请求过于频繁，请稍后再试。' });

  const message = cleanText(req.body.message, CHAT_LIMITS.messageChars);
  if (!message) return res.status(400).json({ error: '消息不能为空' });
  const lang = req.body.lang === 'en' ? 'en' : 'zh';
  const history = sanitizeHistory(req.body.history);

  if (!DEEPSEEK_API_KEY) {
    return res.json({ ...localCharacterReply(message, lang), provider: 'local' });
  }

  try {
    const result = await requestDeepSeek({ message, history, lang });
    res.json({ ...result, provider: 'deepseek', model: DEEPSEEK_MODEL });
  } catch (error) {
    console.warn('[MentalLink] DeepSeek unavailable:', error.message);
    res.json({ ...localCharacterReply(message, lang), provider: 'local', degraded: true });
  }
});

app.post('/api/chat/stream', requireSameOrigin, requireJson, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('X-Accel-Buffering', 'no');
  if (!chatLimiter.allow(req.ip)) {
    res.status(429);
    return sendChatEvent(res, { type: 'error', message: 'Mental Link 请求过于频繁，请稍后再试。' }, true);
  }

  const message = cleanText(req.body.message, CHAT_LIMITS.messageChars);
  if (!message) {
    res.status(400);
    return sendChatEvent(res, { type: 'error', message: '消息不能为空' }, true);
  }
  const lang = req.body.lang === 'en' ? 'en' : 'zh';
  const history = sanitizeHistory(req.body.history);

  if (!DEEPSEEK_API_KEY) {
    sendChatEvent(res, { type: 'phase', phase: 'thinking' });
    return sendChatEvent(res, {
      type: 'result',
      ...localCharacterReply(message, lang),
      provider: 'local',
      model: null,
    }, true);
  }

  try {
    const result = await requestDeepSeek({
      message,
      history,
      lang,
      onPhase: (phase) => sendChatEvent(res, { type: 'phase', phase }),
    });
    sendChatEvent(res, {
      type: 'result',
      ...result,
      provider: 'deepseek',
      model: DEEPSEEK_MODEL,
    }, true);
  } catch (error) {
    console.warn('[MentalLink] DeepSeek stream unavailable:', error.message);
    sendChatEvent(res, {
      type: 'result',
      ...localCharacterReply(message, lang),
      provider: 'local',
      degraded: true,
    }, true);
  }
});

/* Full-achievement visitor tickets */
const CORE_ACHIEVEMENTS = new Set([
  'identityDecoded', 'starDivination', 'fullscreen',
  'firstCommand', 'characterAnnoyed', 'summonCat',
]);
const TICKET_STYLES = ['classic', 'welcome', 'mentalout', 'encore'];
const TICKET_PRIVATE_DIR = PRIVATE_DATA_DIR;
const TICKET_STORE_FILE = path.join(TICKET_PRIVATE_DIR, 'visitor-tickets.json');
const TICKET_SECRET_FILE = path.join(TICKET_PRIVATE_DIR, 'ticket-secret');
const ticketLimiter = createRateLimiter(60_000, 4);
const ticketVerifyLimiter = createRateLimiter(60_000, 30);
const ticketSecret = loadTicketSecret();

app.post('/api/tickets/issue', requireSameOrigin, requireJson, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!ticketLimiter.allow(req.ip)) return res.status(429).json({ error: '签发请求过于频繁，请稍后再试' });

  const body = req.body || {};
  const displayName = cleanText(body.displayName, 18);
  const deviceId = cleanText(body.deviceId, 128);
  const achievements = Array.isArray(body.achievements) ? new Set(body.achievements) : new Set();
  if (!displayName) return res.status(400).json({ error: '票面名称不能为空' });
  if (!/^[a-f0-9]{32,128}$/i.test(deviceId)) return res.status(400).json({ error: '无效的浏览器身份' });
  if ([...CORE_ACHIEVEMENTS].some((id) => !achievements.has(id))) {
    return res.status(403).json({ error: '六项核心成就尚未同步完成' });
  }

  const store = loadTicketStore();
  const deviceHash = secureHash(deviceId);
  const existing = store.tickets.find((ticket) => ticket.deviceHash === deviceHash);
  if (existing) return res.json({ ticket: publicTicket(existing), reused: true });

  // A device reset cannot mint unlimited serials from one address in a day.
  const ipHash = secureHash(req.ip || 'unknown');
  const since = Date.now() - 86_400_000;
  const dailyFromIp = store.tickets.filter((ticket) => ticket.ipHash === ipHash && Date.parse(ticket.issuedAt) >= since).length;
  if (dailyFromIp >= 3) return res.status(429).json({ error: '该网络今天的票券签发次数已达上限' });

  const number = Math.max(Number(store.nextNumber) || Number(process.env.TICKET_NUMBER_START || 1), 1);
  const style = TICKET_STYLES[crypto.randomInt(0, TICKET_STYLES.length)];
  const issuedAt = new Date().toISOString();
  const credential = signTicket({ number, displayName, style, issuedAt });
  const ticket = { number, displayName, style, issuedAt, credential, deviceHash, ipHash };
  store.tickets.push(ticket);
  store.nextNumber = number + 1;
  saveTicketStore(store);
  res.status(201).json({ ticket: publicTicket(ticket), reused: false });
});

app.get('/api/tickets/verify/:credential', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!ticketVerifyLimiter.allow(req.ip)) return res.status(429).json({ valid: false });
  const ticket = findVerifiedTicket(req.params.credential);
  if (!ticket) return res.status(404).json({ valid: false });
  res.json({ valid: true, ticket: publicTicket(ticket) });
});

app.get('/api/tickets/qr/:credential', async (req, res) => {
  if (!ticketVerifyLimiter.allow(req.ip)) return res.status(429).send('Too many requests');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  const ticket = findVerifiedTicket(req.params.credential);
  if (!ticket) return res.status(404).send('Ticket not found');
  try {
    const verifyUrl = `${publicOrigin(req)}/ticket/verify/${encodeURIComponent(ticket.credential)}`;
    const svg = await QRCode.toString(verifyUrl, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      color: { dark: '#111315', light: '#f5f0e7' },
    });
    res.type('image/svg+xml').send(svg);
  } catch (_) {
    res.status(500).send('QR generation failed');
  }
});

app.use('/api', (req, res) => res.status(404).json({ error: 'API not found' }));
app.use((req, res) => res.status(404).type('text/plain').send('Not found'));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = Number(error.status || error.statusCode) || 500;
  if (status >= 500) console.error('[Server]', error.message);
  res.status(status).json({ error: status === 400 ? 'Invalid request body' : 'Request failed' });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
  console.log(`VRM: ${fs.existsSync(path.join(ROOT, 'shokuhou.vrm')) ? 'ready' : 'missing'}`);
  console.log(`Mental Link: ${DEEPSEEK_API_KEY ? DEEPSEEK_MODEL : 'local fallback'}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}

async function requestDeepSeek({ message, history, lang, onPhase = null }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  const languageRule = lang === 'en' ? 'Reply in natural English.' : '使用自然、简洁的中文回答。';
  const system = [
    '你是个人网站中的虚构角色“食蜂操祈”式智能向导，自信、聪明、略带俏皮，但对访客友善。',
    '你可以介绍站长、作品、时间线、迭代记录和留言功能；不知道的事实要坦率说明，不能编造站长经历。',
    '不要声称自己是真人，不索取密码、密钥或敏感个人信息。',
    languageRule,
    '只输出 JSON 对象，字段必须是 text、emotion、action。',
    `emotion 只能是: ${[...ALLOWED_EMOTIONS].join(', ')}。`,
    `action 只能是: ${[...ALLOWED_ACTIONS].join(', ')}。`,
    'text 控制在 140 个汉字或 240 个英文字符以内。',
  ].join('\n');

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: system },
          ...history,
          { role: 'user', content: message },
        ],
        response_format: { type: 'json_object' },
        thinking: { type: 'enabled' },
        reasoning_effort: 'high',
        max_tokens: CHAT_LIMITS.outputTokens,
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error?.message || `DeepSeek HTTP ${response.status}`);
    }
    if (!response.body) throw new Error('DeepSeek returned no stream');

    let content = '';
    let buffer = '';
    let phase = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = done ? '' : lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        let chunk;
        try { chunk = JSON.parse(data); } catch (_) { continue; }
        const delta = chunk.choices?.[0]?.delta || {};
        if (delta.reasoning_content && phase !== 'thinking') {
          phase = 'thinking';
          onPhase?.(phase);
        }
        if (delta.content) {
          if (phase !== 'responding') {
            phase = 'responding';
            onPhase?.(phase);
          }
          content += delta.content;
        }
      }
      if (done) break;
    }
    if (!content) throw new Error('DeepSeek returned no content');
    return validateCharacterPayload(parseJsonObject(content));
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonObject(value) {
  const cleaned = String(value).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

function validateCharacterPayload(payload) {
  const text = cleanText(payload?.text, CHAT_LIMITS.responseChars);
  if (!text) throw new Error('Character response text missing');
  return {
    reply: text,
    emotion: ALLOWED_EMOTIONS.has(payload.emotion) ? payload.emotion : 'neutral',
    action: ALLOWED_ACTIONS.has(payload.action) ? payload.action : 'idle',
  };
}

function sanitizeHistory(value) {
  if (!Array.isArray(value)) return [];
  const sanitized = value.slice(-CHAT_LIMITS.historyTurns).flatMap((item) => {
    const role = item?.role === 'assistant' ? 'assistant' : (item?.role === 'user' ? 'user' : null);
    const content = cleanText(item?.content, CHAT_LIMITS.historyItemChars);
    return role && content ? [{ role, content }] : [];
  });
  let remaining = CHAT_LIMITS.historyTotalChars;
  return sanitized.reverse().flatMap((item) => {
    if (remaining <= 0) return [];
    const content = item.content.slice(-remaining);
    remaining -= content.length;
    return content ? [{ ...item, content }] : [];
  }).reverse();
}

function sendChatEvent(res, payload, end = false) {
  if (res.writableEnded || res.destroyed) return;
  res.write(`${JSON.stringify(payload)}\n`);
  if (end) res.end();
}

function localCharacterReply(message, lang) {
  const lower = message.toLowerCase();
  if (lang === 'en') {
    if (/hello|hi|hey/.test(lower)) return { reply: 'Mental Link established. I was wondering when you would say hello.', emotion: 'joy', action: 'greeting' };
    if (/site|website|explore|show/.test(lower)) return { reply: 'Start with About, then follow the timeline to Works. I will keep an eye on what you open.', emotion: 'curious', action: 'thinking' };
    return { reply: 'The full intelligence channel is not connected yet, but I can still guide you around the site.', emotion: 'amused', action: 'idle' };
  }
  if (/你好|嗨|早上好|晚上好/.test(message)) return { reply: 'Mental Link 已建立。哼，我还以为你要更久才会来打招呼呢。', emotion: 'joy', action: 'greeting' };
  if (/网站|探索|带我|看看|作品/.test(message)) return { reply: '先从“关于我”开始，再沿时间线走到作品集吧。你打开什么，我都会注意到。', emotion: 'curious', action: 'thinking' };
  if (/你是谁|介绍.*你/.test(message)) return { reply: '我是这里的 Mental Out 导航员。负责陪你探索，也负责提醒你不要乱点太多次。', emotion: 'amused', action: 'greeting' };
  return { reply: '完整的智能频道还没有接通，不过基本引导已经由我接管。想先看看作品，还是时间线？', emotion: 'neutral', action: 'idle' };
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/\u0000/g, '').trim().slice(0, maxLength);
}

function oneLine(value) {
  return String(value).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function requireSameOrigin(req, res, next) {
  const fetchSite = String(req.get('sec-fetch-site') || '').toLowerCase();
  if (fetchSite === 'cross-site') return res.status(403).json({ error: 'Cross-site request rejected' });
  const origin = req.get('origin');
  if (!origin) return next();
  const allowed = PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  try {
    if (new URL(origin).origin !== new URL(allowed).origin) {
      return res.status(403).json({ error: 'Origin rejected' });
    }
  } catch (_) {
    return res.status(403).json({ error: 'Origin rejected' });
  }
  next();
}

function requireJson(req, res, next) {
  if (!req.is('application/json')) return res.status(415).json({ error: 'JSON body required' });
  next();
}

function createRateLimiter(windowMs, maxRequests) {
  const buckets = new Map();
  return {
    allow(key) {
      const now = Date.now();
      const recent = (buckets.get(key) || []).filter((time) => now - time < windowMs);
      if (recent.length >= maxRequests) return false;
      recent.push(now);
      buckets.set(key, recent);
      if (buckets.size > 500) {
        for (const [bucketKey, times] of buckets) {
          if (!times.some((time) => now - time < windowMs)) buckets.delete(bucketKey);
        }
      }
      return true;
    },
  };
}

function loadTicketSecret() {
  const configured = String(process.env.TICKET_SIGNING_SECRET || '').trim();
  if (configured) return configured;
  fs.mkdirSync(TICKET_PRIVATE_DIR, { recursive: true });
  if (!fs.existsSync(TICKET_SECRET_FILE)) fs.writeFileSync(TICKET_SECRET_FILE, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(TICKET_SECRET_FILE, 'utf8').trim();
}

function loadTicketStore() {
  fs.mkdirSync(TICKET_PRIVATE_DIR, { recursive: true });
  try {
    const parsed = JSON.parse(fs.readFileSync(TICKET_STORE_FILE, 'utf8'));
    return { nextNumber: Number(parsed.nextNumber) || 1, tickets: Array.isArray(parsed.tickets) ? parsed.tickets : [] };
  } catch (_) {
    return { nextNumber: Number(process.env.TICKET_NUMBER_START || 1), tickets: [] };
  }
}

function saveTicketStore(store) {
  fs.mkdirSync(TICKET_PRIVATE_DIR, { recursive: true });
  const temporary = `${TICKET_STORE_FILE}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(store, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, TICKET_STORE_FILE);
}

function secureHash(value) {
  return crypto.createHmac('sha256', ticketSecret).update(String(value)).digest('hex');
}

function signTicket(ticket) {
  const source = [ticket.number, ticket.displayName, ticket.style, ticket.issuedAt].join('|');
  const compact = crypto.createHmac('sha256', ticketSecret).update(source).digest('hex').slice(0, 12).toUpperCase();
  return compact.match(/.{1,4}/g).join('-');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function findVerifiedTicket(rawCredential) {
  const credential = cleanText(rawCredential, 32).toUpperCase();
  if (!/^[A-F0-9]{4}(?:-[A-F0-9]{4}){2}$/.test(credential)) return null;
  const ticket = loadTicketStore().tickets.find((item) => item.credential === credential);
  if (!ticket) return null;
  return safeEqual(credential, signTicket(ticket)) ? ticket : null;
}

function publicOrigin(req) {
  return PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

function normalizePublicBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    return url.origin;
  } catch (_) {
    throw new Error('PUBLIC_BASE_URL must be an absolute http(s) origin');
  }
}

function validateProductionConfig() {
  if (!IS_PRODUCTION) return;
  if (!PUBLIC_BASE_URL || !PUBLIC_BASE_URL.startsWith('https://')) {
    throw new Error('Production requires an https PUBLIC_BASE_URL');
  }
  let deepSeekUrl;
  try { deepSeekUrl = new URL(DEEPSEEK_BASE_URL); } catch (_) { throw new Error('DEEPSEEK_BASE_URL is invalid'); }
  if (deepSeekUrl.protocol !== 'https:') throw new Error('Production DEEPSEEK_BASE_URL must use https');
  const signingSecret = String(process.env.TICKET_SIGNING_SECRET || '').trim();
  if (signingSecret && signingSecret.length < 32) {
    throw new Error('TICKET_SIGNING_SECRET must contain at least 32 characters');
  }
}

function sendPublicFile(res, filePath) {
  res.setHeader('Cache-Control', IS_PRODUCTION ? 'public, max-age=604800' : 'no-cache');
  res.setHeader('Content-Type', 'application/octet-stream');
  return res.sendFile(filePath);
}

function publicTicket(ticket) {
  return {
    number: ticket.number,
    displayName: ticket.displayName,
    style: ticket.style,
    issuedAt: ticket.issuedAt,
    credential: ticket.credential,
  };
}

function loadLocalEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
