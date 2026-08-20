/* ─── Mental Out sound language ────────────────────────────────
   Quiet Web Audio cues: warm low link tones, restrained glass
   transients and no external samples.  The OS controls loudness;
   the site exposes only a remembered mute switch.
─────────────────────────────────────────────────────────────── */

const Sound = {
  ctx: null,
  master: null,
  enabled: true,

  init() {
    this.enabled = loadSetting('sound_enabled', 'true') === 'true';
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      // Requested site-wide master level. Individual cue dynamics remain
      // unchanged; the output stage is intentionally allowed above unity.
      this.master.gain.value = 2;
      this.master.connect(this.ctx.destination);
    } catch {
      console.warn('[Sound] Web Audio API not available');
      this.enabled = false;
    }
  },

  play(type) {
    if (!this.enabled || !this.ctx || !this.master) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    switch (type) {
      case 'click':
        this._tone({ from: 720, to: 920, duration: 0.055, volume: 0.035, wave: 'triangle' });
        break;
      case 'memory':
        this._tone({ from: 980, to: 1240, duration: 0.1, volume: 0.035, wave: 'sine' });
        this._tone({ from: 1480, duration: 0.08, volume: 0.018, delay: 0.055, wave: 'sine' });
        break;
      case 'windowOpen':
        this._tone({ from: 390, to: 520, duration: 0.16, volume: 0.045, wave: 'triangle' });
        this._tone({ from: 780, duration: 0.12, volume: 0.022, delay: 0.07, wave: 'sine' });
        break;
      case 'windowClose':
        this._tone({ from: 560, to: 310, duration: 0.13, volume: 0.04, wave: 'triangle' });
        break;
      case 'achievement':
      case 'easterEgg':
        this._chord([523.25, 659.25, 783.99], 0.34, 0.024);
        break;
      case 'chat':
        this._tone({ from: 640, to: 720, duration: 0.075, volume: 0.025, wave: 'sine' });
        break;
      case 'login':
        this._linkBoot();
        break;
    }
  },

  _tone({ from, to = from, duration, volume, delay = 0, wave = 'sine' }) {
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(Math.max(1, from), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + Math.min(0.018, duration * 0.22));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  },

  _chord(frequencies, duration, volume) {
    frequencies.forEach((frequency, index) => {
      this._tone({
        from: frequency,
        to: frequency * 1.012,
        duration,
        volume: volume / (1 + index * 0.28),
        delay: index * 0.035,
        wave: index === 0 ? 'triangle' : 'sine',
      });
    });
  },

  _linkBoot() {
    // A short, grounded connection cue replaces the former one-second
    // sawtooth sweep that sounded like a cartoon take-off.
    this._tone({ from: 146.83, to: 220, duration: 0.42, volume: 0.055, wave: 'sine' });
    this._tone({ from: 587.33, to: 659.25, duration: 0.22, volume: 0.026, delay: 0.18, wave: 'triangle' });
    this._tone({ from: 1174.66, to: 1318.51, duration: 0.16, volume: 0.018, delay: 0.3, wave: 'sine' });

    const duration = 0.34;
    const frameCount = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, frameCount, this.ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      channel[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);
    }
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(820, now);
    filter.frequency.exponentialRampToValueAtTime(1700, now + duration);
    filter.Q.value = 0.75;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.013, now + 0.045);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(now);
  },

  toggle() {
    this.enabled = !this.enabled;
    saveSetting('sound_enabled', String(this.enabled));
    if (this.enabled) this.play('click');
    EventBus?.emit?.('sound:changed', { enabled: this.enabled });
    return this.enabled;
  },
};
