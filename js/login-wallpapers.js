/* Three-channel login wallpaper controller. */
const LoginWallpaperManager = {
  scenes: [
    { id: 'arona', channel: 'CHANNEL 01 // BLUE ARCHIVE' },
    { id: 'elaina', channel: 'CHANNEL 02 // NIGHT WITCH' },
    { id: 'miku', channel: 'CHANNEL 03 // STARRY LAKESIDE' },
  ],
  currentIndex: 0,
  interval: null,
  rotationMs: 9000,
  disposed: false,
  _boundVisibility: null,

  async init() {
    this.disposed = false;
    this.sceneEls = [...document.querySelectorAll('.login-scene')];
    this.nav = document.getElementById('login-scene-nav');
    this.channel = document.getElementById('login-channel');
    this.video = document.getElementById('elaina-wallpaper');

    await AronaWallpaper.init();
    AronaWallpaper.setActive(true);

    this.nav?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-scene-index]');
      if (!button) return;
      this.setScene(Number(button.dataset.sceneIndex), true);
    });

    this._boundVisibility = () => {
      if (document.hidden) this.video?.pause();
      else if (this.currentIndex === 1) this.video?.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', this._boundVisibility);

    // Prepare the next channel without delaying first paint.
    setTimeout(() => this.prepareElaina(), 1200);
    this.startRotation();
  },

  setScene(index, manual = false) {
    if (this.disposed || !this.sceneEls?.length) return;
    const normalized = ((index % this.scenes.length) + this.scenes.length) % this.scenes.length;
    this.currentIndex = normalized;

    this.sceneEls.forEach((element, sceneIndex) => element.classList.toggle('is-active', sceneIndex === normalized));
    this.nav?.querySelectorAll('[data-scene-index]').forEach((button, sceneIndex) => {
      button.classList.toggle('is-active', sceneIndex === normalized);
      button.setAttribute('aria-current', sceneIndex === normalized ? 'true' : 'false');
    });

    const scene = this.scenes[normalized];
    document.getElementById('login-overlay')?.setAttribute('data-wallpaper', scene.id);
    if (this.channel) this.channel.textContent = scene.channel;
    AronaWallpaper.setActive(normalized === 0);

    if (normalized === 1) {
      this.prepareElaina().then(() => this.video?.play().catch(() => {}));
    } else {
      this.video?.pause();
    }

    EventBus.emit('login:wallpaper-changed', scene);
    if (manual) this.startRotation();
  },

  startRotation() {
    clearInterval(this.interval);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.interval = setInterval(() => this.setScene(this.currentIndex + 1), this.rotationMs);
  },

  prepareElaina() {
    if (!this.video) return Promise.resolve();
    if (this.video.readyState >= 3) return Promise.resolve();
    this.video.preload = 'auto';
    this.video.load();
    return new Promise((resolve) => {
      const done = () => {
        this.video.removeEventListener('canplay', done);
        resolve();
      };
      this.video.addEventListener('canplay', done, { once: true });
      setTimeout(done, 4500);
    });
  },

  dispose() {
    this.disposed = true;
    clearInterval(this.interval);
    if (this._boundVisibility) {
      document.removeEventListener('visibilitychange', this._boundVisibility);
      this._boundVisibility = null;
    }
    this.video?.pause();
    AronaWallpaper.dispose();
  },
};
