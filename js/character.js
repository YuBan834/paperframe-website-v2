/* ─── Character Controller (VRM v3) ───
  @pixiv/three-vrm v3.5.5 — native MToon cartoon rendering
  P3R-inspired lighting and a proportion-aware procedural motion director

  Bone Layer — constrained procedural gestures over a captured rest pose
  Expression Layer — BlendShape expressions + blink (code-controlled)
  Interaction Layer — click, chat, gaze, teasing (code-controlled)
────────────────────────────────────────────── */

/* Animation state is managed separately so model loading, reactions and chat
   can never leave the VRM in its reference T-pose. */
const AnimationManager = new CharacterAnimationStateMachine();
const MotionDirector = new CharacterMotionDirector(AnimationManager);
AnimationManager.setDirector(MotionDirector);

const Character = {
  container: null,
  canvas: null,
  renderer: null,
  scene: null,
  camera: null,
  model: null,        // vrm.scene
  vrm: null,          // VRM instance
  clock: null,

  // State
  loaded: false,
  clickCount: 0,
  clickTimer: null,
  annoyed: false,
  isChatMode: false,
  lastInteraction: Date.now(),

  // Bubble
  bubble: null,
  bubbleText: null,
  bubbleInputArea: null,
  bubbleInput: null,

  // Expression state
  _exprTarget: null,
  _exprCurrent: null,
  _exprTransition: 0,
  _exprDuration: 0.25,
  _exprFrom: 0,

  // Blink state
  _blinkTimer: null,
  _blinkPhase: null,        // 'closing' | 'opening' | null
  _blinkTarget: null,
  _blinkElapsed: 0,
  _blinkDuration: 0.1,
  _doubleBlink: false,

  // Gaze state (eye/head tracking, not body animation)
  _gazeTarget: null,        // { x, y, z } world position
  _gazeTimer: null,
  _gazeHoldDuration: 4000,
  _cursorActive: false,
  _cursorTimeout: null,
  _raycaster: null,
  _screenPointer: null,
  _hitTestFrame: 0,
  _pendingHitTest: null,

  // Teasing face state
  _teasingActive: false,
  _teasingTimer: null,

  async init() {
    if (typeof THREE === 'undefined') {
      console.warn('[Character] Three.js not loaded, character system disabled');
      this.showFallback();
      return;
    }

    this.container = document.getElementById('character-container');
    this.canvas = document.getElementById('character-canvas');
    this.bubble = document.getElementById('chat-bubble');
    this.bubbleText = document.getElementById('chat-text');
    this.bubbleInputArea = document.getElementById('chat-input-area');
    this.bubbleInput = document.getElementById('chat-input');

    if (!this.container || this.container.offsetWidth === 0) {
      console.warn('[Character] Container not ready, retrying in 200ms...');
      setTimeout(() => this.init(), 200);
      return;
    }

    this.setupScene();
    this.setupLighting();
    await this.loadModel();
    this.bindEvents();
    this.startAnimationLoop();
    this.startIdleBehavior();

    EventBus.on('time:phase-changed', (phase) => this.updateLighting(phase));
    EventBus.on('character:lighting-update', (data) => this.applyLighting(data));
    EventBus.on('easteregg:found', () => this.onEasterEggFound());
    EventBus.on('window:opened', (data) => this.onWindowOpened(data));
    EventBus.on('memory:activated', (data) => this.onMemoryActivated(data));
  },

  /* ─── Scene Setup ─── */
  setupScene() {
    this.scene = new THREE.Scene();

    const aspect = this.container.offsetWidth / this.container.offsetHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    this.camera.position.set(0, 0.3, -5.5);
    this.camera.lookAt(0, 0.0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setSize(this.container.offsetWidth, this.container.offsetHeight, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    const dprLimit = Number(navigator.deviceMemory || 8) <= 4 ? 1.25 : 1.75;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprLimit));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.clock = new THREE.Clock();
    this._raycaster = new THREE.Raycaster();
    this._screenPointer = new THREE.Vector2();

    // Reflection is initialized only after the reviewed natural stance is
    // ready. Its renderer captures one frame and then freezes it, so authored
    // actions can never make the reflected feet wobble like moving water.
    this.reflectionRenderer = null;

    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.container.classList.add('is-degraded');
      this.loaded = false;
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.container.classList.remove('is-degraded');
      window.location.reload();
    });
  },

  /* ─── P3R Lighting ─── */
  setupLighting() {
    const phase = document.body.dataset.timePhase || 'day';
    const palette = this.getLightingPalette(phase);

    this.ambientLight = new THREE.AmbientLight(palette.ambient, palette.ambientIntensity);
    this.scene.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight(palette.key, palette.keyIntensity);
    this.keyLight.position.set(1.5, 2.5, -3);
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(palette.fill, palette.fillIntensity);
    this.fillLight.position.set(-1.5, 1, -1);
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight(palette.rim, palette.rimIntensity);
    this.rimLight.position.set(0, 1.5, 2.5);
    this.scene.add(this.rimLight);
  },

  getLightingPalette(phase) {
    const palettes = {
      dawn: {
        ambient: 0x9eb8c8, ambientIntensity: 1.18,
        key: 0xffd4b0, keyIntensity: 1.62,
        fill: 0x7ebacb, fillIntensity: 0.72,
        rim: 0xffb86b, rimIntensity: 0.62,
      },
      day: {
        ambient: 0xb8c8d8, ambientIntensity: 1.3,
        key: 0xffeed8, keyIntensity: 1.9,
        fill: 0x80c0d0, fillIntensity: 0.82,
        rim: 0xf0c060, rimIntensity: 0.58,
      },
      dusk: {
        // Keep the sunset in the silhouette, not across the skin. A neutral
        // ambient + blue fill preserves the VRM's base skin tone, while the
        // softer peach key and amber rim still connect her to the dusk panel.
        ambient: 0x9aa6b8, ambientIntensity: 1.08,
        key: 0xffe2cc, keyIntensity: 1.24,
        fill: 0x7588b8, fillIntensity: 0.72,
        rim: 0xe9a05f, rimIntensity: 0.52,
      },
      night: {
        ambient: 0x506782, ambientIntensity: 0.9,
        key: 0xc7d5ff, keyIntensity: 1.05,
        fill: 0x365b91, fillIntensity: 0.5,
        rim: 0xc79b4c, rimIntensity: 0.42,
      },
    };
    return palettes[phase] || palettes.day;
  },

  updateLighting(phase) {
    const palette = this.getLightingPalette(phase);
    if (this.ambientLight) {
      this.ambientLight.color.set(palette.ambient);
      this.ambientLight.intensity = palette.ambientIntensity;
    }
    if (this.keyLight) {
      this.keyLight.color.set(palette.key);
      this.keyLight.intensity = palette.keyIntensity;
    }
    if (this.fillLight) {
      this.fillLight.color.set(palette.fill);
      this.fillLight.intensity = palette.fillIntensity;
    }
    if (this.rimLight) {
      this.rimLight.color.set(palette.rim);
      this.rimLight.intensity = palette.rimIntensity;
    }
  },

  applyLighting(data) {
    if (data.color && this.keyLight) this.keyLight.color.set(data.color);
    if (data.intensity !== undefined && this.keyLight) this.keyLight.intensity = data.intensity;
  },

  /* ─── VRM Loading (v3 API) ─── */
  async loadModel() {
    try {
      this.showLoading();
      this.container.classList.add('is-loading');
      this.canvas.style.display = 'block';

      const [{ GLTFLoader }, vrmModule] = await Promise.all([
        import('three/addons/loaders/GLTFLoader.js'),
        import('@pixiv/three-vrm'),
      ]);

      const { VRMLoaderPlugin } = vrmModule;

      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));

      const gltf = await loader.loadAsync(CHARACTER_CONFIG.modelPath, (progress) => {
        if (progress.total > 0) {
          const pct = Math.round((progress.loaded / progress.total) * 100);
          this.showLoading(pct);
        }
      });

      const vrm = gltf.userData.vrm;
      if (!vrm) throw new Error('VRM not parsed — gltf.userData.vrm is null');

      this.vrm = vrm;
      this.model = vrm.scene;

      const meshes = [];
      this.model.traverse((c) => { if (c.isMesh) meshes.push(c); });
      const firstMat = meshes.length > 0 ? meshes[0].material.type : 'N/A';
      console.log('[Character] VRM v3 loaded. Meshes:', meshes.length,
        'Material:', firstMat,
        'MToon:', firstMat === 'MToonMaterial' ? '✓ NATIVE' : '(Standard/PBR fallback)');

      // Auto-size & position
      const box = new THREE.Box3().setFromObject(this.model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      const yOffset = -0.5;
      this.model.position.set(-center.x - 0.3, -box.min.y + yOffset, -center.z);

      const maxDim = Math.max(size.x, size.y, size.z);
      const targetHeight = 5.5;
      const autoScale = maxDim > 0 ? targetHeight / maxDim : 1.0;
      this.model.scale.setScalar(autoScale * (CHARACTER_CONFIG.scale || 1.0));

      this.scene.add(this.model);

      // Camera framing
      // Frame the complete silhouette, not only the face. The previous
      // 0.95 distance cropped the hair at the canvas edge; a slightly wider
      // view and higher centre preserve both the head and the grounded feet.
      const frameY = size.y * autoScale * 0.43;
      const camDist = targetHeight / (2 * Math.tan((this.camera.fov * Math.PI) / 360)) * 1.08;
      this.camera.position.set(0, frameY, -camDist);
      this.camera.lookAt(0, frameY, 0);

      // Build expression map from VRM expressionManager
      this._buildExpressionMap();

      // Find head bone for eye tracking
      this._findHeadBone();

      // Start neutral while animations are prepared behind an opacity gate.
      this.setExpression('neutral', 0);

      // Use the VRM normalized pose as the canonical website stance. VRMAlab
      // uses this same reset on model load; it is a static model pose, not an
      // embedded idle animation.
      this._applySafeRestPose();

      // Load VRMA animations
      let animationResult = { loaded: [], failed: [], hasIdle: false };
      if (CHARACTER_CONFIG.animations) {
        AnimationManager.vrm = this.vrm;
        AnimationManager.model = this.model;
        animationResult = await AnimationManager.loadAll(
          CHARACTER_CONFIG.animations,
          (settled, total) => this.showLoading(Math.round(72 + (settled / total) * 26))
        );
      }

      // The model's normalized reset is a T-pose. Use the first frame of an
      // approved in-place action as the shared natural stance instead, so the
      // idle and every authored action speak the same skeletal language.
      const adoptedActionRest = AnimationManager.adoptRestPoseFromClip('greeting', 0);
      if (!adoptedActionRest) MotionDirector.captureRestPose();
      AnimationManager.playIdle({ immediate: true });

      const reflectionCanvas = document.getElementById('character-reflection');
      if (reflectionCanvas && typeof CharacterReflectionRenderer !== 'undefined') {
        reflectionCanvas.classList.remove('is-disabled');
        reflectionCanvas.hidden = false;
        const reflection = new CharacterReflectionRenderer({
          canvas: reflectionCanvas,
          scene: this.scene,
          camera: this.camera,
          container: this.container,
        });
        this.reflectionRenderer = reflection.init() ? reflection : null;
      }

      this.loaded = true;
      this.hideLoading();
      this.container.classList.remove('is-loading');
      this.container.classList.add('is-ready');
      this.container.dataset.motion = 'reviewed-vrma-with-living-idle';
      this.container.dataset.animations = animationResult.loaded.join(',');

      this._scheduleBlink();
      this._scheduleGaze();

      EventBus.emit('character:ready', {
        animations: animationResult.loaded,
        degraded: animationResult.failed.length > 0,
      });
      console.log('[Character] ✓ Character Engine 2.0 ready');

    } catch (err) {
      console.warn('[Character] Loading FAILED:', err.message);
      this.hideLoading();
      this.container.classList.remove('is-loading');
      this.showFallback();
    }
  },

  /* ─── Expression API — proper VRM expressionManager ─── */
  _buildExpressionMap() {
    if (!this.vrm || !this.vrm.expressionManager) return;

    const em = this.vrm.expressionManager;
    const available = Object.keys(em.expressionMap || {});

    console.log('[Character] expressionManager keys:', available.join(', '));

    if (available.length > 0) {
      this._useVRMExpressions = true;
      this._exprLookup = {};

      const lookups = {
        neutral:   ['Neutral', 'neutral'],
        joy:       ['Joy', 'joy', 'Happy', 'happy'],
        angry:     ['Angry', 'angry'],
        sorrow:    ['Sorrow', 'sorrow', 'Sad', 'sad'],
        surprised: ['Surprised', 'surprised', 'Surprise', 'surprise', 'unknown'],
        fun:       ['Fun', 'fun', 'Relaxed', 'relaxed'],
        blink:     ['Blink', 'blink', 'Blink_L', 'blink_l'],
        a:         ['A', 'a'],
        i:         ['I', 'i'],
        u:         ['U', 'u'],
        e:         ['E', 'e'],
        o:         ['O', 'o'],
      };

      for (const [ourName, candidates] of Object.entries(lookups)) {
        for (const c of candidates) {
          if (available.includes(c)) { this._exprLookup[ourName] = c; break; }
          const found = available.find(a => a.toLowerCase() === c.toLowerCase());
          if (found) { this._exprLookup[ourName] = found; break; }
        }
      }
      console.log('[Character] Expression mapping:', JSON.stringify(this._exprLookup));
    } else {
      console.warn('[Character] expressionManager EMPTY — falling back to direct morph targets');
      this._useVRMExpressions = false;
    }

    // Build direct morph target index
    this._morphMap = {};
    if (this.model) {
      this.model.traverse((child) => {
        if (!child.isMesh || !child.morphTargetInfluences) return;
        const dict = child.morphTargetDictionary;
        if (!dict) return;
        for (const [name, index] of Object.entries(dict)) {
          if (!this._morphMap[name]) {
            this._morphMap[name] = { mesh: child, index };
          }
        }
      });
    }
    const morphKeys = Object.keys(this._morphMap);
    if (morphKeys.length > 0) {
      console.log('[Character] Direct morph targets:', morphKeys.join(', '));
    }
  },

  setExpression(name, duration = 0.35) {
    if (!this._exprLookup) return;
    const targetName = this._exprLookup[name];
    if (!targetName) return;

    const from = this._useVRMExpressions
      ? (this.vrm.expressionManager.getValue(targetName) || 0)
      : (this._morphMap[targetName] ? this._morphMap[targetName].mesh.morphTargetInfluences[this._morphMap[targetName].index] : 0);

    if (this._useVRMExpressions) {
      const em = this.vrm.expressionManager;
      for (const en of Object.keys(em.expressionMap || {})) {
        if (en !== targetName) em.setValue(en, 0);
      }
    } else {
      for (const key of Object.keys(this._morphMap)) {
        if (key !== targetName) this._morphMap[key].mesh.morphTargetInfluences[this._morphMap[key].index] = 0;
      }
    }

    this._exprTarget = { name: targetName, ourName: name };
    this._exprCurrent = targetName;
    this._exprFrom = from;
    this._exprTransition = 0;
    this._exprDuration = Math.max(duration, 0.01);
  },

  resetExpression(duration = 0.5) {
    if (this._useVRMExpressions && this.vrm && this.vrm.expressionManager) {
      const em = this.vrm.expressionManager;
      for (const en of Object.keys(em.expressionMap || {})) em.setValue(en, 0);
    } else if (this._morphMap) {
      for (const key of Object.keys(this._morphMap)) {
        this._morphMap[key].mesh.morphTargetInfluences[this._morphMap[key].index] = 0;
      }
    }
    this._exprTarget = null;
    this._blinkTarget = null;
    this._blinkPhase = null;
    this._exprCurrent = null;
    this.setExpression('neutral', duration);
  },

  blink(duration = 0.1) {
    if (!this._exprLookup) return;
    const blinkName = this._exprLookup['blink'];
    if (!blinkName) return;
    if (this._useVRMExpressions && this.vrm && this.vrm.expressionManager) {
      if (!this.vrm.expressionManager.getExpression(blinkName)) return;
    } else if (this._morphMap && !this._morphMap[blinkName]) return;

    this._blinkTarget = blinkName;
    this._blinkElapsed = 0;
    this._blinkDuration = duration;
    this._blinkPhase = 'closing';
  },

  /* ─── Gaze System ─── */
  _scheduleGaze() {
    if (!this.loaded) return;
    if (this._gazeTimer) clearTimeout(this._gazeTimer);
    const delay = 3000 + Math.random() * 5000;
    this._gazeTimer = setTimeout(() => {
      if (this._cursorActive || this.annoyed) {
        this._scheduleGaze();
        return;
      }
      this._gazeTarget = {
        x: (Math.random() - 0.5) * 2,
        y: 0.1 + Math.random() * 0.8,
        z: -2 - Math.random() * 3,
      };
      this._scheduleGaze();
    }, delay);
  },

  /* ─── Blink System ─── */
  _scheduleBlink() {
    if (!this.loaded) return;
    if (this._blinkTimer) clearTimeout(this._blinkTimer);
    const delay = 1500 + Math.random() * 4500;
    this._blinkTimer = setTimeout(() => {
      if (!this.annoyed) {
        if (Math.random() < 0.15) {
          this._doubleBlink = true;
          this.blink(0.08);
        } else {
          this.blink(0.1);
        }
      }
      this._scheduleBlink();
    }, delay);
  },

  /* ─── Contextual Reactions ─── */
  onEasterEggFound() {
    if (!this.loaded || this.annoyed) return;
    this.setExpression('surprised', 0.15);
    AnimationManager.play('surprised');
    setTimeout(() => { if (!this.annoyed) this.resetExpression(0.5); }, 2000);
  },

  onWindowOpened(data) {
    if (!this.loaded || this.annoyed) return;
    if (data && data.x !== undefined) {
      const rect = this.container.getBoundingClientRect();
      const charCx = rect.left + rect.width / 2;
      const charCy = rect.top + rect.height * 0.4;
      this._gazeTarget = {
        x: (data.x - charCx) / (window.innerWidth) * 4,
        y: (data.y - charCy) / (window.innerHeight) * 2,
        z: -3,
      };
    }
  },

  onMemoryActivated(data) {
    if (!this.loaded || this.annoyed || !data) return;
    this._gazeTarget = { x: -1.2, y: 0.25, z: -3 };
    const labels = {
      about: '身份档案已连接。先从这里认识站长吧。',
      timeline: '这里是他看过的番和玩过的游戏，可以按年份筛选。',
      works: '这里放着他做过的几个项目。',
      changelog: '这里记录了网站从 V1.0 到 V2.0 的变化。',
      contact: '想联系他的话，可以在这里留言。',
    };
    if (data.isNew) {
      this.setExpression('joy', 0.2);
      AnimationManager.play('surprised');
      this.say(labels[data.id] || '新的记忆节点已经连接。', 3900);
      setTimeout(() => this.resetExpression(0.45), 2600);
    }
  },

  /* ─── Eye/Head Tracking — direct bone rotation ─── */
  _findHeadBone() {
    this._headBone = null;
    this._neckBone = null;

    if (this.vrm && this.vrm.humanoid) {
      const tryBone = (name) => {
        let b = null;
        try { b = this.vrm.humanoid.getNormalizedBoneNode(name); } catch(e) {}
        if (!b) try { b = this.vrm.humanoid.getRawBoneNode(name); } catch(e) {}
        return b;
      };
      this._headBone = tryBone('head');
      this._neckBone = tryBone('neck');
    }

    if (!this._headBone || !this._neckBone) {
      this.model.traverse((child) => {
        if (!child.isBone) return;
        const n = child.name.toLowerCase();
        if (!this._headBone && n.includes('head')) this._headBone = child;
        if (!this._neckBone && n.includes('neck')) this._neckBone = child;
      });
    }
    console.log('[Character] Head:', this._headBone ? this._headBone.name : 'NOT FOUND',
      'Neck:', this._neckBone ? this._neckBone.name : 'NOT FOUND');
  },

  _applySafeRestPose() {
    if (!this.vrm?.humanoid) return;
    this.vrm.humanoid.resetNormalizedPose();
    this.vrm.update(0);
    this.model?.updateWorldMatrix(true, true);
  },

  _updateLookAt() {
    if (this.annoyed || this._teasingActive) return;

    const bone = this._headBone || this._neckBone;
    if (!bone) return;

    let targetY = 0, targetX = 0;

    if (this._cursorActive && this._mouseX !== undefined) {
      const rect = this.container.getBoundingClientRect();
      targetY = ((this._mouseX - rect.left) / rect.width - 0.5) * 0.6;
      targetX = -((this._mouseY - rect.top) / rect.height - 0.35) * 0.25;
    } else if (this._gazeTarget) {
      targetY = this._gazeTarget.x * 0.2;
      targetX = this._gazeTarget.y * 0.1;
    }

    this._lookCurrentY = (this._lookCurrentY || 0) + (targetY - (this._lookCurrentY || 0)) * 0.06;
    this._lookCurrentX = (this._lookCurrentX || 0) + (targetX - (this._lookCurrentX || 0)) * 0.06;

    if (this._neckBone && this._headBone && this._neckBone !== this._headBone) {
      this._neckBone.rotation.y += this._lookCurrentY * 0.34;
      this._neckBone.rotation.x += this._lookCurrentX * 0.3;
      this._headBone.rotation.y += this._lookCurrentY * 0.66;
      this._headBone.rotation.x += this._lookCurrentX * 0.7;
    } else {
      bone.rotation.y += this._lookCurrentY;
      bone.rotation.x += this._lookCurrentX;
    }
  },

  /* ─── Loading UI ─── */
  showLoading(pct) {
    const old = this.container.querySelector('.character-loading');
    if (old) old.remove();
    const el = createEl('div', {
      className: 'character-loading',
      style: {
        position: 'absolute', bottom: '16px', left: '50%',
        transform: 'translateX(-50%)', padding: '6px 14px',
        borderRadius: '12px', background: 'rgba(10,22,40,0.7)',
        color: '#f0c060', fontSize: '12px', pointerEvents: 'none', zIndex: '10',
      },
      textContent: pct !== undefined ? `加载中 ${pct}%` : '✦ 加载中...',
    });
    this.container.appendChild(el);
  },

  hideLoading() {
    const el = this.container.querySelector('.character-loading');
    if (el) el.remove();
  },

  /* ─── Fallback ─── */
  showFallback() {
    this.container.style.display = 'flex';
    this.container.style.alignItems = 'center';
    this.container.style.justifyContent = 'center';
    const emoji = createEl('div', {
      style: {
        fontSize: '100px', textAlign: 'center',
        filter: 'drop-shadow(0 0 20px rgba(240, 192, 96, 0.5))',
        animation: 'character-float 3s ease-in-out infinite', cursor: 'pointer',
      },
      textContent: '🪄',
    });
    this.container.appendChild(emoji);
    this.canvas.style.display = 'none';
    this.loaded = true;
  },

  /* ─── Events ─── */
  bindEvents() {
    document.addEventListener('click', (e) => {
      if (this._isInterfaceTarget(e.target)) return;
      if (this.hitTest(e.clientX, e.clientY)) {
        e.__characterHit = true;
        this.onClick();
      }
    });

    document.addEventListener('dblclick', (e) => {
      if (this._isInterfaceTarget(e.target)) return;
      if (this.hitTest(e.clientX, e.clientY)) this.startChat();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.loaded) return;
      this.trackCursor(e.clientX, e.clientY);
      this._pendingHitTest = { x: e.clientX, y: e.clientY, target: e.target };
      if (!this._hitTestFrame) {
        this._hitTestFrame = requestAnimationFrame(() => {
          this._hitTestFrame = 0;
          const pending = this._pendingHitTest;
          if (!pending) return;
          document.body.classList.toggle(
            'character-hover',
            !this._isInterfaceTarget(pending.target) && this.hitTest(pending.x, pending.y)
          );
        });
      }
    });

    const sendBtn = document.getElementById('chat-send');
    if (sendBtn) sendBtn.addEventListener('click', () => this.sendChatMessage());
    if (this.bubbleInput) {
      this.bubbleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.sendChatMessage();
      });
    }

    document.addEventListener('click', (e) => {
      if (this.isChatMode && !e.__characterHit && !this.container.contains(e.target)) this.hideBubble();
    });

    window.addEventListener('resize', debounce(() => this.resizeRenderer(), 100));
    window.visualViewport?.addEventListener('resize', debounce(() => this.resizeRenderer(), 100));
    document.addEventListener('fullscreenchange', () => {
      document.body.classList.toggle('is-immersive', Boolean(document.fullscreenElement));
      requestAnimationFrame(() => {
        this.resizeRenderer();
        requestAnimationFrame(() => this.resizeRenderer());
      });
    });
  },

  _isInterfaceTarget(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest(
      '.desktop-window, #taskbar, #start-menu, #context-menu, #mental-link-panel, #ticket-verifier-panel, ' +
      '.chat-bubble, #mental-link-launcher, #command-line, #achievement-drawer, ' +
      '.memory-node, button, input, textarea, select, a, [role="button"]'
    ));
  },

  hitTest(clientX, clientY) {
    if (!this.loaded || !this.model || !this.camera || !this._raycaster || !this._screenPointer) return false;
    const rect = this.container.getBoundingClientRect();
    if (
      clientX < rect.left || clientX > rect.right ||
      clientY < rect.top || clientY > rect.bottom
    ) return false;
    this._screenPointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this._raycaster.setFromCamera(this._screenPointer, this.camera);
    return this._raycaster
      .intersectObject(this.model, true)
      .some((hit) => hit.object?.visible !== false);
  },

  resizeRenderer() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.offsetWidth;
    const height = this.container.offsetHeight;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    const dprLimit = Number(navigator.deviceMemory || 8) <= 4 ? 1.25 : 1.75;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprLimit));
    this.reflectionRenderer?.resize();
  },

  /* ─── Cursor Tracking (eyes + head only) ─── */
  trackCursor(mx, my) {
    this._mouseX = mx;
    this._mouseY = my;
    this._cursorActive = true;
    clearTimeout(this._cursorTimeout);
    this._cursorTimeout = setTimeout(() => { this._cursorActive = false; }, 2000);
  },

  /* ─── Direct Interaction ─── */
  onClick() {
    if (this.annoyed) return;
    this.clickCount++;
    this.lastInteraction = Date.now();
    if (this.clickTimer) clearTimeout(this.clickTimer);
    this.clickTimer = setTimeout(() => { this.clickCount = 0; }, 1500);

    if (this.clickCount >= 5) { this.onAnnoyed(); return; }

    const reactions = ['joy', 'fun', 'surprised'];
    const expr = reactions[this.clickCount % reactions.length];
    this.setExpression(expr, 0.2);
    setTimeout(() => {
      if (!this.annoyed && this._exprCurrent === expr) this.resetExpression(0.5);
    }, 2500);

    this.showBubble();
  },

  startChat() {
    this.lastInteraction = Date.now();
    if (typeof Chat !== 'undefined' && Chat.open) {
      Chat.open();
      return;
    }
    this.isChatMode = true;
    AnimationManager.play('thinking', { loop: true, state: 'chatting' });
    this.showBubble();
  },

  showBubble(showInput = false) {
    if (!this.bubble) return;
    this.bubble.classList.remove('hidden');
    this.bubbleText.textContent = '';
    if (this.bubbleInputArea) this.bubbleInputArea.classList.toggle('hidden', !showInput);
    this.isChatMode = showInput;

    if (!showInput) {
      const replies = currentLang === 'zh'
        ? ['你好呀~ ✨', '有什么事吗？', '欢迎来到我的桌面~', '想了解什么？点击图标看看吧！']
        : ['Hello~ ✨', "What's up?", 'Welcome to my desktop~', 'Click the icons to explore!'];
      this.typeText(pick(replies));
    }
    if (this.bubbleInput && showInput) setTimeout(() => this.bubbleInput.focus(), 350);
  },

  hideBubble() {
    if (!this.bubble) return;
    this.bubble.classList.add('hidden');
    const wasChatMode = this.isChatMode;
    this.isChatMode = false;
    if (this.bubbleInputArea) this.bubbleInputArea.classList.add('hidden');
    // Closing an ordinary speech bubble must not start another action. The
    // previous behaviour repeatedly restarted greeting every three seconds.
    if (wasChatMode) {
      AnimationManager.playIdle();
    }
  },

  typeText(text, speed = 40) {
    clearInterval(this._typeTimer);
    clearTimeout(this._bubbleHideTimer);
    let i = 0;
    this.bubbleText.textContent = '';
    this._typeTimer = setInterval(() => {
      this.bubbleText.textContent += text[i];
      i++;
      if (i >= text.length) {
        clearInterval(this._typeTimer);
        if (!this.isChatMode) {
          this._bubbleHideTimer = setTimeout(() => { if (!this.isChatMode) this.hideBubble(); }, 3000);
        }
      }
    }, speed);
  },

  say(text, duration = 3200) {
    if (!this.bubble || !this.bubbleText) return;
    clearInterval(this._typeTimer);
    clearTimeout(this._bubbleHideTimer);
    this.bubble.classList.remove('hidden');
    this.bubbleText.textContent = String(text || '');
    this._bubbleHideTimer = setTimeout(() => {
      if (!this.isChatMode) this.hideBubble();
      else this.bubble.classList.add('hidden');
    }, duration);
  },

  playAnimation(name, options) {
    return AnimationManager.play(name, options);
  },

  returnToIdle() {
    return AnimationManager.playIdle();
  },

  async sendChatMessage(message) {
    if (typeof Chat !== 'undefined' && Chat.send) {
      Chat.open();
      return Chat.send(message);
    }
  },

  onAnnoyed() {
    if (this._annoyedTimeout) clearTimeout(this._annoyedTimeout);
    this.annoyed = true;
    this.setExpression('angry', 0.15);
    AnimationManager.play('angry');

    const replies = currentLang === 'zh'
      ? ['别戳了啦！！(╯°□°）╯', '再点我就不理你了！']
      : ['Stop poking me!! (╯°□°）╯', "I'm going to ignore you!"];
    this.showBubble();
    this.typeText(pick(replies));
    EventBus.emit('easteregg:found', { id: 'characterAnnoyed', name: '别点啦！', nameEn: 'Stop Poking!' });

    this._annoyedTimeout = setTimeout(() => {
      this.annoyed = false;
      this.clickCount = 0;
      this.resetExpression(0.5);
      AnimationManager.playIdle();
    }, 19500);
  },

  /* ─── Idle Behavior ─── */
  startIdleBehavior() {
    this._scheduleBlink();
    this._scheduleGaze();

    // Periodic idle expression shifts and long-idle VRMA triggers
    this.poseTimer = setInterval(() => {
      if (this.annoyed || this.isChatMode) return;
      const idle = Date.now() - this.lastInteraction;
      if (idle > 120000) {
        // 2+ minutes: sleepy
        this.setExpression('sorrow', 0.6);
        AnimationManager.play('yawn');
        // The approved yawn lasts about 8.3 s. The animation manager returns
        // to the living idle when the clip finishes.
        setTimeout(() => this.resetExpression(0.6), 8300);
        this.showBubble();
        this.typeText(currentLang === 'zh' ? '（打了个哈欠）好安静啊...' : '(yawns) So quiet...');
        this.lastInteraction = Date.now();
        return;
      }
      if (idle > 30000) {
        // 30+ seconds: subtle expression shift
        const idleExprs = ['neutral', 'fun'];
        const next = idleExprs.find(e => e !== (this._exprTarget && this._exprTarget.ourName)) || 'neutral';
        this.setExpression(next, 1.0);
      }
    }, CHARACTER_CONFIG.idleSwitchInterval);

    // Hourly reminder
    setTimeout(() => {
      this.showBubble();
      this.typeText(t('onlineTooLong'));
      EventBus.emit('easteregg:found', { id: 'oneHour', name: '休息提醒', nameEn: 'Break Reminder' });
    }, 3600000);
  },

  /* ─── Animation Loop ─── */
  startAnimationLoop() {
    const loop = () => {
      requestAnimationFrame(loop);
      if (!this.loaded || !this.scene || !this.renderer || document.hidden) return;

      const dt = Math.min(this.clock ? this.clock.getDelta() : 0.016, 0.1);

      // 1. Safe idle clip + directed procedural gesture overlay.
      AnimationManager.update(dt);

      // 2. Expression lerp (BlendShape)
      this._updateExpression(dt);

      // 3. Blink animation (BlendShape)
      this._updateBlink(dt);

      // 4. Eye/head tracking
      this._updateLookAt();

      // 5. Transfer normalized humanoid pose to the raw skeleton, then update
      // spring bones.  Running this after the director avoids a one-frame lag.
      if (this.vrm) {
        this.vrm.update(dt);
      }

      this.renderer.render(this.scene, this.camera);

      this._renderReflection();
    };
    loop();
  },

  _renderReflection() {
    this.reflectionRenderer?.render();
  },

  _setExprWeight(name, weight) {
    if (this._useVRMExpressions && this.vrm && this.vrm.expressionManager) {
      const expr = this.vrm.expressionManager.getExpression(name);
      if (expr) {
        this.vrm.expressionManager.setValue(name, weight);
        return;
      }
    }
    if (this._morphMap && this._morphMap[name]) {
      this._morphMap[name].mesh.morphTargetInfluences[this._morphMap[name].index] = weight;
    }
  },

  _getExprWeight(name) {
    if (this._useVRMExpressions && this.vrm && this.vrm.expressionManager) {
      const expr = this.vrm.expressionManager.getExpression(name);
      if (expr) return this.vrm.expressionManager.getValue(name) || 0;
    }
    if (this._morphMap && this._morphMap[name]) {
      return this._morphMap[name].mesh.morphTargetInfluences[this._morphMap[name].index];
    }
    return 0;
  },

  _updateExpression(dt) {
    if (!this._exprTarget) return;
    this._exprTransition += dt;
    const t = Math.min(this._exprTransition / this._exprDuration, 1.0);
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    const val = this._exprFrom + (1.0 - this._exprFrom) * eased;
    this._setExprWeight(this._exprTarget.name, val);

    if (t >= 1.0) {
      this._exprCurrent = this._exprTarget.ourName;
      this._exprTarget = null;
    }
  },

  _updateBlink(dt) {
    if (!this._blinkPhase || !this._blinkTarget) return;
    this._blinkElapsed += dt;
    const half = this._blinkDuration;

    if (this._blinkPhase === 'closing') {
      const t = Math.min(this._blinkElapsed / half, 1.0);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      this._setExprWeight(this._blinkTarget, eased);
      if (t >= 1.0) {
        this._blinkPhase = 'opening';
        this._blinkElapsed = 0;
      }
    } else if (this._blinkPhase === 'opening') {
      const t = Math.min(this._blinkElapsed / half, 1.0);
      const eased = 1 - (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
      this._setExprWeight(this._blinkTarget, eased);
      if (t >= 1.0) {
        this._setExprWeight(this._blinkTarget, 0);
        this._blinkPhase = null;
        this._blinkTarget = null;
        if (this._doubleBlink) {
          this._doubleBlink = false;
          setTimeout(() => this.blink(0.08), 80);
        }
      }
    }
  },

  /* ─── Applause Animation ─── */
  applauseAnimation() {
    if (!this.loaded || this.annoyed) return;

    if (AnimationManager.clips['clapping']) {
      console.log('[Character] 🎉 Applause animation! (VRMA)');
      this.setExpression('joy', 0.3);
      AnimationManager.play('clapping');

      clearTimeout(this._clapStopTimer);
      this._clapStopTimer = setTimeout(() => this.resetExpression(0.5), 1400);
    } else {
      // Fallback: simple bounce + particles
      console.log('[Character] 🎉 Applause animation! (fallback)');
      this.setExpression('joy', 0.3);
      const origY = this.model.position.y;
      const start = performance.now();
      const bounce = () => {
        const t = (performance.now() - start) * 0.001;
        if (t > 5) { this.model.position.y = origY; this.resetExpression(0.5); return; }
        this.model.position.y = origY + Math.abs(Math.sin(t * 3)) * 0.15;
        requestAnimationFrame(bounce);
      };
      bounce();
    }

    const rect = this.container.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * 0.3;
    if (Particles && Particles.sprinkle) {
      for (let i = 0; i < 5; i++) {
        setTimeout(() => Particles.sprinkle(cx, cy, '#f0c060'), i * 400);
      }
    }
  },

  /* ─── Teasing Face (鬼脸捉弄) — VRMA + BlendShape ─── */
  teasingFace(duration = 2200) {
    if (!this.loaded || this._teasingActive) return;

    this._teasingActive = true;

    // 1. Play lookAround VRMA for natural head movement
    AnimationManager.play('lookAround');

    // 2. Expression: fun (mischievous grin)
    this.setExpression('fun', 0.15);

    // 3. Mouth: "E" shape (wide grin via BlendShape)
    this._setExprWeight('E', 0.9);

    // 4. Body lean: slightly forward
    if (this.model) {
      this.model.position.z = 0.08;
    }

    // 5. Show chat bubble with teasing text
    const taunts = currentLang === 'zh'
      ? ['略略略~ (￣ω￣)', '抓不到我吧~ ✨', '嘿嘿，上当啦！', '笨蛋笨蛋！(≧∇≦)', '来抓我呀~ 🏃‍♀️']
      : ['Nyahaha~ (￣ω￣)', "Can't catch me~ ✨", 'Gotcha! Made you look!', 'Dummy dummy! (≧∇≦)', 'Come and get me~ 🏃‍♀️'];
    this.showBubble();
    this.typeText(pick(taunts));

    // Restore after duration
    clearTimeout(this._teasingTimer);
    this._teasingTimer = setTimeout(() => this._restoreTeasingFace(), duration);
  },

  _restoreTeasingFace() {
    if (!this._teasingActive) return;
    this._teasingActive = false;

    // Reset mouth "E"
    this._setExprWeight('E', 0);

    // Reset body position
    if (this.model) {
      this.model.position.z = 0;
    }

    // Reset expression
    this.resetExpression(0.4);

    // Return to idle animation
    AnimationManager.playIdle();
  },

  jump() {
    if (!this.loaded) return;
    AnimationManager.play('jump');
    this.setExpression('joy', 0.15);
    setTimeout(() => this.resetExpression(0.4), 1500);
  },
};
