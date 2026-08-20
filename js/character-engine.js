/* Character Engine 2.0
 * Animation lifecycle and reflection rendering are intentionally kept outside
 * character.js.  The Character facade remains stable for the rest of the site.
 */

class CharacterAnimationStateMachine {
  constructor() {
    this.clips = {};
    this.actions = new Map();
    this.mixer = null;
    this.current = null;
    this.currentAction = null;
    this.currentState = 'boot';
    this.vrm = null;
    this.model = null;
    this.ready = false;
    this.idleName = 'idle';
    this.director = null;
    this._lastHealthyAt = 0;
    this._finishedHandler = (event) => this._onFinished(event);
  }

  async loadAll(animConfig = {}, onProgress) {
    if (!this.model || !this.vrm) {
      throw new Error('Character model must be attached before animations load');
    }

    this.ready = false;
    this.clips = {};
    this.actions.clear();
    this.mixer = new THREE.AnimationMixer(this.model);
    this.mixer.addEventListener('finished', this._finishedHandler);

    const [{ GLTFLoader }, animModule] = await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'),
      import('@pixiv/three-vrm-animation'),
    ]);
    const { VRMAnimationLoaderPlugin, VRMLookAtQuaternionProxy, createVRMAnimationClip } = animModule;
    if (this.vrm.lookAt && !this.vrm.scene.children.some((child) => child instanceof VRMLookAtQuaternionProxy)) {
      const lookAtProxy = new VRMLookAtQuaternionProxy(this.vrm.lookAt);
      lookAtProxy.name = 'VRMLookAtQuaternionProxy';
      this.vrm.scene.add(lookAtProxy);
    }
    const entries = Object.entries(animConfig);
    let settled = 0;

    // The website character must stay planted in one screen position. VRMA
    // clips authored for other rigs often include subtle lower-body balancing
    // motion; on this model that becomes conspicuous knee/foot wobble. Resolve
    // the target model's actual normalized node names once, then remove those
    // rotation tracks from every imported action while keeping the torso,
    // arms, hands, face and expression performance intact.
    const anchoredBoneTracks = new Set([
      'hips',
      'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
      'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
    ].map((boneName) => {
      try {
        const nodeName = this.vrm.humanoid?.getNormalizedBoneNode(boneName)?.name;
        return nodeName ? `${nodeName}.quaternion` : null;
      } catch (_) {
        return null;
      }
    }).filter(Boolean));

    await Promise.all(entries.map(async ([name, config]) => {
      try {
        const loader = new GLTFLoader();
        loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
        const gltf = await loader.loadAsync(config.file);
        const vrmAnimation = gltf.userData.vrmAnimations?.[0];
        if (!vrmAnimation) throw new Error('VRMA data missing');

        const clip = createVRMAnimationClip(vrmAnimation, this.vrm);
        if (!clip || !Number.isFinite(clip.duration) || clip.duration <= 0 || !clip.tracks?.length) {
          throw new Error('Animation clip is empty');
        }
        // The character owns a fixed place in the page layout.  Some imported
        // motions contain hips/root translation recorded in another stage,
        // which makes rapid action changes look like teleportation.  Keep all
        // rotations and expressions, but make every website action in-place.
        clip.tracks = clip.tracks.filter((track) => (
          !/\.position$/i.test(track.name) && !anchoredBoneTracks.has(track.name)
        ));
        this.clips[name] = { ...config, clip };
      } catch (error) {
        console.warn(`[CharacterEngine] Animation ${name} unavailable:`, error.message);
      } finally {
        settled += 1;
        if (onProgress) onProgress(settled, entries.length, name);
      }
    }));

    this.idleName = this.clips.idle ? 'idle' : null;
    this.ready = true;

    if (this.director) {
      this.director.attach({ vrm: this.vrm, model: this.model });
    }

    return {
      loaded: Object.keys(this.clips),
      failed: entries.map(([name]) => name).filter((name) => !this.clips[name]),
      hasIdle: Boolean(this.idleName),
    };
  }

  _getAction(name) {
    if (!this.mixer || !this.clips[name]) return null;
    if (!this.actions.has(name)) {
      this.actions.set(name, this.mixer.clipAction(this.clips[name].clip));
    }
    return this.actions.get(name);
  }

  setDirector(director) {
    this.director = director;
    if (director && this.vrm && this.model) director.attach({ vrm: this.vrm, model: this.model });
  }

  adoptRestPoseFromClip(name, time = 0) {
    const config = this.clips[name];
    const action = this._getAction(name);
    if (!config || !action || !this.mixer || !this.director) return false;

    action.reset();
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(1);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    action.time = Math.min(Math.max(0, time), Math.max(0, config.clip.duration - 0.001));
    this.mixer.update(0);
    this.director.captureRestPose();
    action.stop();
    this.current = null;
    this.currentAction = null;
    this.currentState = 'idle';
    return true;
  }

  play(name, options = {}) {
    const isIdle = name === this.idleName || name === 'idle';
    const hasAuthoredClip = Boolean(this.clips[name]);
    if (this.director && !isIdle && !hasAuthoredClip && !options.authored) {
      return this.director.perform(name, options);
    }
    if (isIdle && this.director && !options.keepDirectedPose) {
      this.director.clear({ emit: false });
    }
    return this._playClip(name, options);
  }

  _playClip(name, options = {}) {
    const config = this.clips[name];
    const nextAction = this._getAction(name);
    if (!config || !nextAction) return null;

    const isIdle = name === this.idleName || name === 'idle';
    const loop = options.loop ?? Boolean(config.loop);
    const fade = options.fade ?? config.crossfadeIn ?? 0.3;
    const previousAction = this.currentAction;

    nextAction.enabled = true;
    nextAction.clampWhenFinished = !loop;
    nextAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    nextAction.reset();
    nextAction.setEffectiveTimeScale(1);
    nextAction.setEffectiveWeight(options.weight ?? config.weight ?? 1);

    if (previousAction && previousAction !== nextAction && previousAction.isRunning()) {
      previousAction.crossFadeTo(nextAction, Math.max(0.05, fade), false);
    } else if (!options.immediate) {
      nextAction.fadeIn(Math.max(0.05, fade));
    }

    nextAction.play();
    this.current = name;
    this.currentAction = nextAction;
    this.currentState = options.state || (isIdle ? 'idle' : (loop ? 'active' : 'reacting'));
    this._lastHealthyAt = performance.now();
    this._emitState();
    return nextAction;
  }

  playIdle(options = {}) {
    this.director?.clear();
    if (!this.idleName) {
      if (this.currentAction) {
        this.director?.beginReturn(options.fade ?? 0.45);
        this.currentAction.stop();
      }
      this.current = null;
      this.currentAction = null;
      this.currentState = 'idle';
      this._emitState();
      return { directed: true, state: 'idle' };
    }
    return this.play(this.idleName, {
      ...options,
      loop: true,
      state: 'idle',
      fade: options.immediate ? 0 : (options.fade ?? 0.35),
    });
  }

  crossFadeTo(name, duration) {
    return this.play(name, { fade: duration });
  }

  stop(name) {
    const action = this._getAction(name);
    if (!action) return;
    action.stop();
    if (this.current === name) {
      this.current = null;
      this.currentAction = null;
      this.currentState = 'idle';
      this.playIdle({ immediate: true });
    }
  }

  isPlaying(name) {
    return Boolean(this._getAction(name)?.isRunning());
  }

  update(delta) {
    if (!this.mixer) return;
    this.director?.prepareFrame();
    this.mixer.update(delta);
    this.director?.update(delta);

    const now = performance.now();
    if (this.currentAction?.isRunning()) {
      this._lastHealthyAt = now;
      return;
    }

    // A loop that silently stops used to expose the VRM reference T-pose.
    // Recover within a single watchdog interval instead of waiting forever.
    if (this.idleName && now - this._lastHealthyAt > 350) {
      console.warn('[CharacterEngine] Animation watchdog restored idle');
      this.playIdle({ immediate: true });
    }
  }

  _onFinished(event) {
    if (!event?.action || event.action !== this.currentAction) return;
    if (this.current && this.clips[this.current]?.loop) return;
    this.playIdle({ fade: this.clips[this.current]?.crossfadeOut ?? 0.35 });
  }

  _emitState() {
    if (typeof EventBus !== 'undefined') {
      EventBus.emit('character:state-changed', {
        state: this.currentState,
        animation: this.current,
      });
    }
  }

  dispose() {
    if (this.mixer) {
      this.mixer.removeEventListener('finished', this._finishedHandler);
      this.mixer.stopAllAction();
      if (this.model) this.mixer.uncacheRoot(this.model);
    }
    this.actions.clear();
    this.director?.dispose();
    this.currentAction = null;
    this.mixer = null;
    this.ready = false;
  }
}

/*
 * Motion Director
 *
 * Downloaded VRMA clips are useful as a neutral breathing base, but their
 * authored limb curves were made for different proportions.  Everyday
 * reactions therefore keep only the safe idle clip and add small, normalized
 * upper-body gestures after the mixer update.  This makes the character feel
 * responsive without letting a foreign clip throw her arms above her head,
 * twist the wrists or move the hips away from the floor.
 */
class CharacterMotionDirector {
  constructor(stateMachine) {
    this.stateMachine = stateMachine;
    this.vrm = null;
    this.model = null;
    this.bones = {};
    this.restPose = {};
    this.state = 'idle';
    this.elapsed = 0;
    this.duration = 0;
    this.loop = false;
    this.ready = false;
    this._euler = null;
    this._deltaQuat = null;
    this.returnPose = null;
    this.returnElapsed = 0;
    this.returnDuration = 0;
  }

  attach({ vrm, model }) {
    this.vrm = vrm;
    this.model = model;
    this.bones = {};
    const names = [
      'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
      'leftShoulder', 'rightShoulder', 'leftUpperArm', 'rightUpperArm',
      'leftLowerArm', 'rightLowerArm', 'leftHand', 'rightHand',
    ];
    for (const name of names) {
      try {
        this.bones[name] = vrm?.humanoid?.getNormalizedBoneNode(name) || null;
      } catch (_) {
        this.bones[name] = null;
      }
    }
    this._euler = new THREE.Euler();
    this._deltaQuat = new THREE.Quaternion();
    this.ready = Boolean(this.bones.spine || this.bones.chest || this.bones.head);
    this.captureRestPose();
  }

  captureRestPose() {
    this.restPose = {};
    for (const [name, bone] of Object.entries(this.bones)) {
      if (bone) this.restPose[name] = bone.quaternion.clone();
    }
  }

  beginReturn(duration = 0.45) {
    this.returnPose = {};
    for (const [name, bone] of Object.entries(this.bones)) {
      if (bone) this.returnPose[name] = bone.quaternion.clone();
    }
    this.returnElapsed = 0;
    this.returnDuration = Math.max(0.12, duration);
  }

  perform(action, options = {}) {
    if (!this.ready) return null;

    const map = {
      thinking: ['attentive', Infinity],
      lookAround: ['attentive', 2.6],
      greeting: ['greeting', 1.8],
      goodBye: ['greeting', 1.8],
      surprised: ['surprised', 1.35],
      clapping: ['celebrate', 2.4],
      jump: ['celebrate', 1.55],
      blush: ['shy', 2.2],
      shy: ['shy', 2.2],
      angry: ['annoyed', 2.8],
      annoyed: ['annoyed', 2.8],
      sad: ['sleepy', 2.8],
      sleepy: ['sleepy', options.loop ? Infinity : 4.2],
    };
    const [state, defaultDuration] = map[action] || ['attentive', 1.8];

    // Keep one known-good authored clip underneath all directed gestures.
    const base = this.stateMachine.idleName
      ? this.stateMachine._getAction(this.stateMachine.idleName)
      : null;
    if (this.stateMachine.idleName && !base?.isRunning()) {
      this.stateMachine._playClip(this.stateMachine.idleName, {
        loop: true,
        state: 'idle',
        fade: 0.28,
      });
    }

    this.state = state;
    this.elapsed = 0;
    this.loop = options.loop === true || defaultDuration === Infinity;
    this.duration = this.loop ? Infinity : (options.duration || defaultDuration);
    this.stateMachine.currentState = options.state || state;
    this.stateMachine._emitState();
    return { directed: true, action, state };
  }

  clear({ emit = true } = {}) {
    const changed = this.state !== 'idle';
    this.state = 'idle';
    this.elapsed = 0;
    this.duration = 0;
    this.loop = false;
    if (changed && emit) {
      this.stateMachine.currentState = 'idle';
      this.stateMachine._emitState();
    }
  }

  prepareFrame() {
    if (!this.ready) return;
    if (this.stateMachine.currentAction?.isRunning()) return;
    for (const [name, quaternion] of Object.entries(this.restPose)) {
      const bone = this.bones[name];
      if (!bone) continue;
      const from = this.returnPose?.[name];
      if (from) {
        const t = Math.min(1, this.returnElapsed / this.returnDuration);
        const eased = t * t * (3 - 2 * t);
        bone.quaternion.copy(from).slerp(quaternion, eased);
      } else {
        bone.quaternion.copy(quaternion);
      }
    }
  }

  update(delta) {
    if (!this.ready) return;
    if (this.stateMachine.currentAction?.isRunning()) return;
    if (this.returnPose) {
      this.returnElapsed += delta;
      if (this.returnElapsed >= this.returnDuration) {
        this.returnPose = null;
        this.returnElapsed = 0;
      }
    }
    this.elapsed += delta;
    const breathe = Math.sin(this.elapsed * 1.65);
    const sway = Math.sin(this.elapsed * 0.42);
    const settle = Math.sin(this.elapsed * 0.19 + 1.2);

    // Breathe on top of the VRM's own normalized rest pose (the same basis
    // used by VRMAlab).  Limbs stay untouched: even tiny permanent arm
    // offsets read as a different stance and accumulate visually with gaze.
    this._rotate('hips', 0, sway * 0.003, settle * 0.003, 1);
    this._rotate('spine', breathe * 0.0045, sway * 0.004, -settle * 0.002, 1);
    this._rotate('chest', -breathe * 0.003, -sway * 0.003, settle * 0.003, 1);
    this._rotate('head', -breathe * 0.0015, sway * 0.004, -settle * 0.002, 1);

    if (this.state === 'idle') return;

    const weight = this._envelope();
    const phase = this.elapsed;
    switch (this.state) {
      case 'attentive':
        this._rotate('spine', 0.035, -0.028, 0, weight);
        this._rotate('upperChest', 0.018, 0.045, 0.018, weight);
        this._rotate('head', -0.025, 0, 0.07, weight);
        this._rotate('rightUpperArm', -0.035, 0.08, 0.06, weight);
        this._rotate('rightLowerArm', 0, 0.16, -0.13, weight);
        this._rotate('rightHand', 0.02, -0.04, 0.06, weight);
        break;
      case 'greeting': {
        const bow = Math.sin(Math.min(1, phase / this.duration) * Math.PI);
        this._rotate('spine', 0.1 * bow, -0.025, 0, weight);
        this._rotate('chest', 0.045 * bow, 0.04, 0.012, weight);
        this._rotate('head', 0.04 * bow, -0.05, 0.045, weight);
        this._rotate('rightUpperArm', -0.06, -0.12, 0.22 * bow, weight);
        this._rotate('rightLowerArm', 0.03, 0.2, -0.28 * bow, weight);
        this._rotate('rightHand', 0, -0.06, Math.sin(phase * 5) * 0.09, weight);
        break;
      }
      case 'surprised': {
        const pulse = Math.sin(Math.min(1, phase / 0.72) * Math.PI);
        this._rotate('spine', -0.055 * pulse, 0, 0, weight);
        this._rotate('upperChest', -0.07 * pulse, -0.025, 0, weight);
        this._rotate('head', -0.045 * pulse, 0.055, -0.025, weight);
        break;
      }
      case 'celebrate': {
        const beat = Math.sin(phase * 5.2);
        this._rotate('spine', -0.018 + Math.abs(beat) * 0.025, beat * 0.025, 0, weight);
        this._rotate('chest', -0.025, -beat * 0.04, beat * 0.018, weight);
        this._rotate('head', -0.025, beat * 0.025, -beat * 0.018, weight);
        this._rotate('leftUpperArm', 0, 0.04, -0.12, weight);
        this._rotate('rightUpperArm', 0, -0.04, 0.15, weight);
        this._rotate('leftLowerArm', 0, -0.09, 0.17, weight);
        this._rotate('rightLowerArm', 0, 0.1, -0.2, weight);
        break;
      }
      case 'shy':
        this._rotate('spine', 0.035, -0.055, 0.025, weight);
        this._rotate('chest', 0.025, -0.035, 0.04, weight);
        this._rotate('head', 0.035, -0.08, 0.105, weight);
        break;
      case 'annoyed':
        this._rotate('spine', 0, 0.11, -0.018, weight);
        this._rotate('chest', 0.015, 0.09, -0.035, weight);
        this._rotate('head', -0.025, 0.18, -0.065, weight);
        break;
      case 'sleepy': {
        const nod = (Math.sin(phase * 1.25) + 1) * 0.5;
        this._rotate('spine', 0.045 + nod * 0.025, -0.025, 0.018, weight);
        this._rotate('chest', 0.025, 0, 0.025, weight);
        this._rotate('head', 0.055 + nod * 0.035, -0.04, 0.11, weight);
        break;
      }
    }

    if (!this.loop && this.elapsed >= this.duration) this.clear();
  }

  _envelope() {
    const fadeIn = Math.min(1, this.elapsed / 0.32);
    if (this.loop || !Number.isFinite(this.duration)) return fadeIn;
    const fadeOut = Math.min(1, Math.max(0, this.duration - this.elapsed) / 0.42);
    return Math.sin(Math.min(fadeIn, fadeOut) * Math.PI * 0.5);
  }

  _rotate(name, x, y, z, weight) {
    const bone = this.bones[name];
    if (!bone || !this._euler || weight <= 0) return;
    this._euler.set(x * weight, y * weight, z * weight, 'XYZ');
    this._deltaQuat.setFromEuler(this._euler);
    bone.quaternion.multiply(this._deltaQuat);
  }

  dispose() {
    this.clear({ emit: false });
    this.vrm = null;
    this.model = null;
    this.bones = {};
    this.restPose = {};
    this.ready = false;
  }
}

class CharacterReflectionRenderer {
  constructor({ canvas, scene, camera, container }) {
    this.canvas = canvas;
    this.scene = scene;
    this.camera = camera;
    this.container = container;
    this.renderer = null;
    this.enabled = false;
    this.frame = 0;
    this.frameStep = 2;
    this.hasCapturedStableFrame = false;
  }

  init() {
    if (!this.canvas || !this.scene || !this.camera || !this.container) return false;
    const lowMemoryDevice = Number(navigator.deviceMemory || 8) <= 4;
    const compactViewport = window.matchMedia('(max-width: 760px)').matches;
    if (lowMemoryDevice || compactViewport || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.canvas.classList.add('is-disabled');
      return false;
    }
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: false,
        powerPreference: 'low-power',
      });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.setClearColor(0x000000, 0);
      this.resize();
      this.enabled = true;
      this.canvas.classList.add('is-ready');
      return true;
    } catch (error) {
      console.warn('[CharacterEngine] Reflection disabled:', error.message);
      this.canvas.classList.add('is-disabled');
      return false;
    }
  }

  resize() {
    if (!this.renderer || !this.container) return;
    const width = Math.max(1, this.container.offsetWidth);
    const height = Math.max(1, this.container.offsetHeight);
    const quality = window.devicePixelRatio > 1.5 ? 0.48 : 0.62;
    this.renderer.setPixelRatio(quality);
    this.renderer.setSize(width, height, false);
  }

  render() {
    if (!this.enabled || document.hidden || this.hasCapturedStableFrame) return;
    this.frame = (this.frame + 1) % this.frameStep;
    if (this.frame !== 0) return;
    this.renderer.render(this.scene, this.camera);
    // The reflection is part of the floor treatment, not a second animated
    // character. Capture the settled standing pose once so tiny foot motion
    // and spring-bone updates cannot create a distracting wobble below her.
    this.hasCapturedStableFrame = true;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled && this.renderer);
    if (this.enabled) this.hasCapturedStableFrame = false;
    if (this.canvas) this.canvas.hidden = !this.enabled;
  }

  dispose() {
    this.enabled = false;
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss?.();
    }
    this.renderer = null;
  }
}
