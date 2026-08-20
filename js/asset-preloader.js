/* Weighted asset preloader used by the entry gate.
 * Progress is based on bytes read, with a short minimum presentation time so
 * fast machines still get a deliberate transition instead of a flash.
 */
const AssetPreloader = {
  manifest: [
    { url: 'shokuhou.vrm', bytes: 16486772, step: 'CALIBRATING CHARACTER MODEL' },
    { url: 'assets/images/wallpaper/academy-city-panel.png', bytes: 1793346, step: 'RESTORING ACADEMY CITY' },
    { url: 'assets/fonts/像素字.ttf', bytes: 2446828, step: 'LOADING SYSTEM TYPEFACE' },
    { url: 'js/character-engine.js', bytes: 18000, step: 'CALIBRATING MOTION DIRECTOR' },
    { url: 'data/profile.json', bytes: 1486, step: 'INDEXING PERSONAL DATA' },
    { url: 'data/media-memory.json', bytes: 15198, step: 'INDEXING MEDIA MEMORY' },
    { url: 'data/works.json', bytes: 978, step: 'INDEXING PROJECT ARCHIVE' },
    { url: 'data/changelog.json', bytes: 4779, step: 'READING SITE MANIFEST' },
  ],

  async run({ minDuration = 2400, onProgress, onStep } = {}) {
    const startedAt = performance.now();
    const loadedByUrl = new Map(this.manifest.map((item) => [item.url, 0]));
    const totalBytes = this.manifest.reduce((sum, item) => sum + item.bytes, 0);
    const failures = [];

    const report = () => {
      const loaded = [...loadedByUrl.values()].reduce((sum, value) => sum + value, 0);
      const ratio = Math.min(1, loaded / totalBytes);
      onProgress?.(Math.min(96, ratio * 96));
    };

    let cursor = 0;
    const worker = async () => {
      while (cursor < this.manifest.length) {
        const item = this.manifest[cursor++];
        onStep?.(item.step, item.url);
        try {
          await this.fetchAsset(item, (loaded) => {
            loadedByUrl.set(item.url, Math.min(item.bytes, loaded));
            report();
          });
          loadedByUrl.set(item.url, item.bytes);
          report();
        } catch (error) {
          failures.push({ url: item.url, message: error.message });
          loadedByUrl.set(item.url, item.bytes);
          report();
        }
      }
    };

    await Promise.all([worker(), worker(), worker()]);
    const remaining = Math.max(0, minDuration - (performance.now() - startedAt));
    if (remaining) await this.delay(remaining);
    await this.animateCompletion(onProgress, 96, 100, 320);
    onStep?.('SYSTEM READY', failures.length ? `${failures.length} OPTIONAL ASSETS SKIPPED` : 'ALL CRITICAL ASSETS READY');
    return { failures };
  },

  async fetchAsset(item, onChunk) {
    const response = await fetch(item.url, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!response.body?.getReader) {
      const buffer = await response.arrayBuffer();
      onChunk(buffer.byteLength || item.bytes);
      return;
    }

    const reader = response.body.getReader();
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      loaded += value.byteLength;
      onChunk(loaded);
    }
  },

  animateCompletion(callback, from, to, duration) {
    return new Promise((resolve) => {
      const start = performance.now();
      const frame = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        callback?.(from + (to - from) * eased);
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  },

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
};
