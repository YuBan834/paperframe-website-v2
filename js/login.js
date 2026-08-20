/* Mental Out entry gate: three memory channels + weighted boot sequence. */
const Login = {
  overlay: null,
  particlesCanvas: null,
  particlesCtx: null,
  loginParticles: [],
  dismissed: false,
  entering: false,
  accent: [89, 210, 230],
  _boundResize: null,

  async init() {
    this.overlay = document.getElementById('login-overlay');
    if (!this.overlay) return;

    const forceLogin = new URLSearchParams(window.location.search).has('login');
    if (!forceLogin && sessionStorage.getItem('login_dismissed') === 'true') {
      this.dismissed = true;
      this.overlay.style.display = 'none';
      return;
    }

    this.particlesCanvas = document.getElementById('login-particles');
    this.particlesCtx = this.particlesCanvas?.getContext('2d');
    document.getElementById('login-enter-label').textContent = 'INITIALIZE';
    document.getElementById('login-enter')?.addEventListener('click', () => this.onEnter());
    EventBus.on('login:wallpaper-changed', (scene) => this.updateAccent(scene.id));

    await LoginWallpaperManager.init();
    this.initParticles();

    return new Promise((resolve) => { this._resolve = resolve; });
  },

  initParticles() {
    if (!this.particlesCanvas || !this.particlesCtx) return;
    this.resizeParticles();
    this.loginParticles = Array.from({ length: 72 }, () => ({
      x: Math.random() * this.particlesCanvas.width,
      y: Math.random() * this.particlesCanvas.height,
      vx: (Math.random() - 0.5) * 0.16,
      vy: -0.04 - Math.random() * 0.12,
      size: 0.6 + Math.random() * 1.5,
      alpha: 0.18 + Math.random() * 0.48,
    }));
    this._boundResize = () => this.resizeParticles();
    window.addEventListener('resize', this._boundResize, { passive: true });
    this.loopLoginParticles();
  },

  resizeParticles() {
    if (!this.particlesCanvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.particlesCanvas.width = Math.round(window.innerWidth * ratio);
    this.particlesCanvas.height = Math.round(window.innerHeight * ratio);
    this.particlesCanvas.style.width = `${window.innerWidth}px`;
    this.particlesCanvas.style.height = `${window.innerHeight}px`;
  },

  loopLoginParticles() {
    if (this.dismissed || !this.particlesCtx) return;
    requestAnimationFrame(() => this.loopLoginParticles());
    if (document.hidden) return;

    const ctx = this.particlesCtx;
    const width = this.particlesCanvas.width;
    const height = this.particlesCanvas.height;
    const [r, g, b] = this.accent;
    ctx.clearRect(0, 0, width, height);

    for (const particle of this.loginParticles) {
      particle.x += particle.vx;
      particle.y += particle.vy;
      if (particle.x < 0) particle.x = width;
      if (particle.x > width) particle.x = 0;
      if (particle.y < 0) particle.y = height;
      ctx.fillStyle = `rgba(${r},${g},${b},${particle.alpha})`;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
  },

  updateAccent(sceneId) {
    const accents = {
      arona: [242, 198, 109],
      elaina: [126, 183, 255],
      miku: [89, 210, 230],
    };
    this.accent = accents[sceneId] || accents.miku;
  },

  async onEnter() {
    if (this.dismissed || this.entering) return;
    this.entering = true;
    this.overlay.classList.add('is-loading');
    document.getElementById('login-loader')?.setAttribute('aria-hidden', 'false');
    document.getElementById('login-enter')?.setAttribute('disabled', 'true');
    clearInterval(LoginWallpaperManager.interval);
    Sound?.play?.('login');

    const percent = document.getElementById('login-loader-percent');
    const bar = document.getElementById('login-loader-bar');
    const step = document.getElementById('login-loader-step');
    const detail = document.getElementById('login-loader-detail');

    await AssetPreloader.run({
      minDuration: 2400,
      onProgress: (value) => {
        const rounded = Math.max(0, Math.min(100, Math.round(value)));
        if (percent) percent.textContent = `${String(rounded).padStart(2, '0')}%`;
        if (bar) bar.style.transform = `scaleX(${rounded / 100})`;
      },
      onStep: (label, file) => {
        if (step) step.textContent = label;
        if (detail) detail.textContent = String(file).split('/').pop().toUpperCase();
      },
    });

    await this.finishTransition();
  },

  async finishTransition() {
    this.overlay.classList.remove('is-loading');
    this.overlay.classList.add('is-leaving');
    await AssetPreloader.delay(880);

    this.dismissed = true;
    sessionStorage.setItem('login_dismissed', 'true');
    if (this._boundResize) {
      window.removeEventListener('resize', this._boundResize);
      this._boundResize = null;
    }
    LoginWallpaperManager.dispose();
    this.overlay.style.display = 'none';
    EventBus.emit('login:dismissed');
    this._resolve?.();
  },
};
