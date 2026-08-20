/* ─── Arona Wallpaper ───
  WebGL Foliage Sway shader for the Blue Archive Arona login background.
  Ported from Wallpaper Engine's scene.pkg — three-layer sinusoidal UV displacement.
  Uses a standalone Three.js renderer, disposed on login dismiss.
────────────────────────────────────────────── */

const AronaWallpaper = {
  renderer: null,
  scene: null,
  camera: null,
  material: null,
  mesh: null,
  animFrameId: null,
  disposed: false,
  paused: false,
  _boundResize: null,

  /* ─── Init ─── */
  async init() {
    this.disposed = false;
    this.paused = false;
    if (typeof THREE === 'undefined') {
      console.warn('[AronaWallpaper] Three.js not loaded, using fallback');
      this.showFallback();
      return;
    }

    const canvas = document.getElementById('arona-canvas');
    if (!canvas) {
      console.warn('[AronaWallpaper] Canvas element #arona-canvas not found');
      this.showFallback();
      return;
    }

    try {
      // 1. WebGL Renderer
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance',
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);

      // 2. Orthographic scene — single full-screen quad
      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      // 3. Load main texture
      this.mainTexture = await this.loadMainTexture();
      if (!this.mainTexture) throw new Error('Main texture failed to load');

      // 4. Generate noise & mask textures
      this.noiseTexture = this.generateNoiseTexture();
      this.maskTextures = this.generateMaskTextures();
      if (!this.maskTextures) throw new Error('Mask generation failed');

      // 5. Create shader material
      this.material = this.createShaderMaterial();

      // 6. Full-screen quad
      const geo = new THREE.PlaneGeometry(2, 2);
      this.mesh = new THREE.Mesh(geo, this.material);
      this.scene.add(this.mesh);

      // 7. Resize handler
      this._boundResize = this.onResize.bind(this);
      window.addEventListener('resize', this._boundResize);

      // 8. Start loop
      this.startLoop();

      console.log('[AronaWallpaper] ✓ initialized');
    } catch (err) {
      console.warn('[AronaWallpaper] Init failed:', err.message);
      this.dispose();
      this.showFallback();
    }
  },

  /* ─── Texture Loading ─── */
  async loadMainTexture() {
    return new Promise((resolve) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        'assets/images/wallpaper/arona.jpg',
        (texture) => {
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.colorSpace = THREE.SRGBColorSpace;
          resolve(texture);
        },
        undefined,
        () => resolve(null) // error → null
      );
    });
  },

  /* ─── Noise Texture (256×256 procedural) ─── */
  generateNoiseTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(size, size);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const v = Math.floor(Math.random() * 256);
      imageData.data[i]     = v;
      imageData.data[i + 1] = v;
      imageData.data[i + 2] = v;
      imageData.data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    // Blur to create smooth noise (Perlin-like)
    ctx.filter = 'blur(4px)';
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.LinearSRGBColorSpace;
    return tex;
  },

  /* ─── Mask Textures (3 layers, soft gradients) ─── */
  generateMaskTextures() {
    const W = 512, H = 288; // half of original 1024×576, sufficient for blurred login

    const layerDefs = [
      // Layer 1: Main hair body — Arona is center-right, hair flows down right
      {
        blobs: [
          { x: 0.52, y: 0.35, r: 0.25, alpha: 1.0 },
          { x: 0.58, y: 0.45, r: 0.22, alpha: 0.9 },
          { x: 0.54, y: 0.55, r: 0.18, alpha: 0.8 },
          { x: 0.60, y: 0.38, r: 0.15, alpha: 0.7 },
        ],
      },
      // Layer 2: Outer strands — wider coverage, slightly offset
      {
        blobs: [
          { x: 0.55, y: 0.40, r: 0.30, alpha: 0.85 },
          { x: 0.60, y: 0.50, r: 0.25, alpha: 0.75 },
          { x: 0.50, y: 0.45, r: 0.20, alpha: 0.65 },
        ],
      },
      // Layer 3: Fine flyaways — diffuse edge wisps
      {
        blobs: [
          { x: 0.55, y: 0.38, r: 0.35, alpha: 0.30 },
          { x: 0.60, y: 0.30, r: 0.20, alpha: 0.25 },
        ],
      },
    ];

    const textures = [];
    for (const def of layerDefs) {
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      // Fill black
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      for (const blob of def.blobs) {
        const cx = blob.x * W;
        const cy = blob.y * H;
        const maxR = blob.r * Math.max(W, H);
        const grad = ctx.createRadialGradient(cx, cy, maxR * 0.1, cx, cy, maxR);
        grad.addColorStop(0, `rgba(255,255,255,${blob.alpha})`);
        grad.addColorStop(0.5, `rgba(255,255,255,${blob.alpha * 0.6})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.colorSpace = THREE.LinearSRGBColorSpace;
      textures.push(tex);
    }
    return textures;
  },

  /* ─── Shader Material ─── */
  createShaderMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        u_MainTexture:  { value: this.mainTexture },
        u_Mask1:        { value: this.maskTextures[0] },
        u_Mask2:        { value: this.maskTextures[1] },
        u_Mask3:        { value: this.maskTextures[2] },
        u_NoiseTexture: { value: this.noiseTexture },
        u_Time:         { value: 0 },
        u_Resolution:   { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      },

      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,

      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform sampler2D u_MainTexture;
        uniform sampler2D u_Mask1;
        uniform sampler2D u_Mask2;
        uniform sampler2D u_Mask3;
        uniform sampler2D u_NoiseTexture;
        uniform float u_Time;
        uniform vec2 u_Resolution;

        const float PI = 3.14159265359;

        vec2 applySway(sampler2D mask, vec2 uv, float strength, float speed, float noiseScale) {
          float maskVal = texture2D(mask, uv).r;
          if (maskVal < 0.005) return vec2(0.0);

          vec3 noise = texture2D(u_NoiseTexture, uv * noiseScale).rgb;
          float amp = strength * 0.005 * maskVal;
          float phase = (noise.g * 2.0 * PI + uv.x * 10.0 + uv.y * 5.0) * 0.5;

          vec4 sines = phase + speed * u_Time * vec4(1.0, -0.16161616, 0.0083333, -0.00019841);
          sines = sin(sines);
          sines = pow(abs(sines), vec4(1.0)) * sign(sines);

          vec4 csines = 0.4 + phase + speed * u_Time * vec4(-0.5, 0.041666666, -0.0013888889, 0.000024801587);
          csines = sin(csines);
          csines = pow(abs(csines), vec4(1.0)) * sign(csines);

          // directionWeights = "1 0.2" from the original ─ more horizontal than vertical
          float offsetX = 1.0  * dot(sines, vec4(amp));
          float offsetY = 0.2  * dot(csines, vec4(amp));
          return vec2(offsetX, offsetY);
        }

        void main() {
          vec2 uv = vUv;

          // Layer 1: main hair body   strength=0.4  speed=3.44
          // Layer 2: outer strands     strength=0.5  speed=3.96
          // Layer 3: fine flyaways     strength=0.23 speed=3.96  noiseScale=0.09
          vec2 offset = vec2(0.0);
          offset += applySway(u_Mask1, uv, 0.40, 3.44, 0.05);
          offset += applySway(u_Mask2, uv, 0.50, 3.96, 0.05);
          offset += applySway(u_Mask3, uv, 0.23, 3.96, 0.09);

          vec2 warpedUV = uv + offset;
          warpedUV = clamp(warpedUV, 0.0, 1.0);

          vec4 color = texture2D(u_MainTexture, warpedUV);

          // Subtle CRT scanline overlay (matching original wallpaper look)
          float scanline = sin(uv.y * u_Resolution.y * 0.7) * 0.03 + 0.97;
          color.rgb *= scanline;

          gl_FragColor = color;
        }
      `,
    });
  },

  /* ─── Animation Loop ─── */
  startLoop() {
    if (this.disposed) return;
    const startTime = performance.now();

    const loop = () => {
      if (this.disposed) return;
      this.animFrameId = requestAnimationFrame(loop);

      if (this.paused || document.hidden) return;

      if (this.material && this.material.uniforms) {
        this.material.uniforms.u_Time.value = (performance.now() - startTime) * 0.001;
      }

      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };
    loop();
  },

  /* ─── Resize ─── */
  onResize() {
    if (this.disposed || !this.renderer) return;
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    if (this.material && this.material.uniforms) {
      this.material.uniforms.u_Resolution.value.set(window.innerWidth, window.innerHeight);
    }
  },

  setActive(active) {
    this.paused = !active;
  },

  /* ─── Fallback ─── */
  showFallback() {
    const fb = document.getElementById('login-wallpaper-fallback');
    if (fb) fb.style.display = '';
    const canvas = document.getElementById('arona-canvas');
    if (canvas) canvas.style.display = 'none';
  },

  /* ─── Cleanup ─── */
  dispose() {
    this.disposed = true;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this._boundResize) {
      window.removeEventListener('resize', this._boundResize);
      this._boundResize = null;
    }

    if (this.material) {
      const u = this.material.uniforms;
      if (u) {
        const texUniforms = ['u_MainTexture', 'u_Mask1', 'u_Mask2', 'u_Mask3', 'u_NoiseTexture'];
        for (const key of texUniforms) {
          if (u[key]?.value?.dispose) u[key].value.dispose();
        }
      }
      this.material.dispose();
      this.material = null;
    }

    if (this.mesh) {
      this.mesh.geometry?.dispose();
      this.mesh = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.mainTexture = null;
    this.noiseTexture = null;
    this.maskTextures = null;

    console.log('[AronaWallpaper] disposed');
  },
};
