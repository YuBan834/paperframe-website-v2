/* ─── Star Particle System (P3R × Shokuhou) ───
  Mix of: ⭐ star particles (background) + 💎 glass shards (floating) + 🫧 bubbles (rising)
  Colored dots act as easter egg triggers (Shokuhou's remote control buttons)
────────────────────────────────────────────── */

const Particles = {
  canvas: null, ctx: null,
  stars: [],         // main star particles
  shards: [],        // glass shard fragments
  bubbles: [],       // rising bubbles
  coloredDots: [],   // easter egg triggers
  mouseX: null, mouseY: null,
  animating: true, width: 0, height: 0, pixelRatio: 1,
  currentTier: 0,
  constellationActive: false, constellationNodes: [],
  vortexActive: false, vortexCx: 0, vortexCy: 0,
  constellationTargets: null, constellationTimer: null,
  _sparkles: [],
  _lastFrame: 0,

  init() {
    this.canvas = document.getElementById('panel-particles');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.panel = document.getElementById('background-panel');
    this.resize();
    this.buildConstellationNodes();
    this.spawnAll();
    this.bindEvents();
    this.loop();
    EventBus.on('easteregg:collection-changed', (d) => this.onCollectionChanged(d));
  },

  resize() {
    if (this.panel) {
      const rect = this.panel.getBoundingClientRect();
      this.width = rect.width;
      this.height = rect.height;
    } else {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
    }
    // Keep the drawing coordinate system in CSS pixels while rendering at the
    // device's native density. The old 1:1 canvas became soft and nearly
    // invisible on high-DPI displays.
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(this.width * this.pixelRatio));
    this.canvas.height = Math.max(1, Math.round(this.height * this.pixelRatio));
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
  },

  buildConstellationNodes() {
    const cx = 0.55, cy = 0.45, s = 0.35;
    const raw = [[0.00,0.00],[0.08,-0.12],[0.20,-0.08],[0.28,0.04],[0.40,-0.18],[0.48,-0.05],[0.55,0.10],[0.62,-0.15],[0.35,0.20],[0.22,0.25],[0.10,0.15],[0.45,0.30]];
    this.constellationNodes = raw.map(([nx,ny]) => ({ x: (cx+nx*s)*this.width, y: (cy+ny*s)*this.height }));
  },

  getStarCount() { if (this.currentTier>=3) return 160; if (this.currentTier>=1) return 120; return 80; },

  spawnAll() {
    const sc = this.getStarCount();
    while (this.stars.length < sc) this.stars.push(this.makeStar());
    while (this.stars.length > sc) this.stars.pop();
    while (this.shards.length < 12) this.shards.push(this.makeShard());
    while (this.shards.length > 12) this.shards.pop();
    while (this.bubbles.length < 8) this.bubbles.push(this.makeBubble());
    while (this.bubbles.length > 8) this.bubbles.pop();
    this.assignColoredDots();
  },

  makeStar() {
    return {
      x: Math.random()*this.width, y: Math.random()*this.height,
      vx: (Math.random()-0.5)*0.6, vy: (Math.random()-0.5)*0.6 - 0.2,
      r: Math.random()*Math.PI*2, rs: (Math.random()-0.5)*0.6,
      size: 2+Math.random()*2.5, alpha: 0.4+Math.random()*0.4,
      isDot: false, dotId: null, dotColor: null, dotClicked: false,
      constellationNode: null, cOriginX: 0, cOriginY: 0,
    };
  },

  makeShard() {
    return {
      x: Math.random()*this.width, y: -20-Math.random()*this.height,
      vy: 0.3+Math.random()*0.6, vx: (Math.random()-0.5)*0.2,
      r: Math.random()*Math.PI*2, rs: (Math.random()-0.5)*0.3,
      size: 6+Math.random()*14, alpha: 0.15+Math.random()*0.2,
    };
  },

  makeBubble() {
    return {
      x: Math.random()*this.width, y: this.height+Math.random()*200,
      vy: -(0.3+Math.random()*0.8), vx: (Math.random()-0.5)*0.4,
      size: 4+Math.random()*12, alpha: 0.1+Math.random()*0.15,
    };
  },

  assignColoredDots() {
    const colors = [
      { id:'red', cv:'--particle-colored-1' }, { id:'cyan', cv:'--particle-colored-2' },
      { id:'purple', cv:'--particle-colored-3' }, { id:'green', cv:'--particle-colored-4' },
      { id:'orange', cv:'--particle-colored-5' }, { id:'blue', cv:'--particle-colored-6' },
      { id:'pink', cv:'--particle-colored-7' }, { id:'mint', cv:'--particle-colored-8' },
    ];
    this.coloredDots = [];
    for (const s of this.stars) { s.isDot = false; s.dotId = null; s.dotColor = null; }
    const n = 6+Math.floor(Math.random()*3);
    const step = Math.floor(this.stars.length/n);
    for (let i=0; i<n; i++) {
      const idx = i*step+Math.floor(Math.random()*step*0.5);
      if (idx < this.stars.length) {
        const s = this.stars[idx]; const d = colors[i%colors.length];
        s.isDot = true; s.dotId = d.id; s.dotColor = d.cv; s.dotClicked = false;
        this.coloredDots.push(s);
      }
    }
  },

  checkDotClick(sx, sy) {
    for (const s of this.coloredDots) {
      if (s.dotClicked) continue;
      if (Math.hypot(s.x-sx, s.y-sy) < 22) { this.onDotClick(s); return true; }
    }
    return false;
  },

  onDotClick(s) {
    s.dotClicked = true;
    const names = {
      red:{name:'赤星',nameEn:'Crimson Star',icon:'🔴'}, cyan:{name:'青星',nameEn:'Cyan Star',icon:'🔵'},
      purple:{name:'紫星',nameEn:'Violet Star',icon:'🟣'}, green:{name:'翠星',nameEn:'Emerald Star',icon:'🟢'},
      orange:{name:'橙星',nameEn:'Amber Star',icon:'🟠'}, blue:{name:'蓝星',nameEn:'Sapphire Star',icon:'💙'},
      pink:{name:'桃星',nameEn:'Rose Star',icon:'💗'}, mint:{name:'薄荷星',nameEn:'Mint Star',icon:'💚'},
    };
    const info = names[s.dotId]||{name:s.dotId,nameEn:s.dotId,icon:'⭐'};
    EventBus.emit('easteregg:found',{id:'coloredDot_'+s.dotId,name:info.name,nameEn:info.nameEn,icon:info.icon});
    this.burstAt(s.x, s.y);
    setTimeout(()=>{s.x=Math.random()*this.width;s.y=Math.random()*this.height;s.dotClicked=false;},30000+Math.random()*30000);
    if (this.coloredDots.every(d=>d.dotClicked)) setTimeout(()=>EventBus.emit('easteregg:found',{id:'spectrum',name:'光谱收集者',nameEn:'Spectrum Collector',icon:'🌈'}),500);
  },

  burstAt(x,y) {
    for (let i=0;i<10;i++) {
      const a=(i/10)*Math.PI*2, sp=2+Math.random()*4;
      this._sparkles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1});
    }
  },

  triggerConstellation() {
    if (this.constellationTimer) clearTimeout(this.constellationTimer);
    if (this.constellationTargets) return;
    if (!this.constellationNodes.length) this.buildConstellationNodes();
    const pts = this.constellationNodes;
    this.constellationTargets = [];
    for (let i=0;i<Math.min(this.stars.length,pts.length);i++) {
      const s=this.stars[i]; s._bvx=s.vx; s._bvy=s.vy;
      this.constellationTargets.push({star:s, ox:s.x, oy:s.y, tx:pts[i].x, ty:pts[i].y});
    }
    const start=performance.now();
    const anim=(now)=>{
      const t=Math.min((now-start)/800,1), e=t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
      for (const c of this.constellationTargets) { c.star.x=c.ox+(c.tx-c.ox)*e; c.star.y=c.oy+(c.ty-c.oy)*e; c.star.vx=0;c.star.vy=0; }
      if (t<1) requestAnimationFrame(anim);
      else this.constellationTimer=setTimeout(()=>this.releaseConstellation(),2000);
    };
    requestAnimationFrame(anim);
  },

  releaseConstellation() {
    if (!this.constellationTargets) return;
    for (const c of this.constellationTargets) { c.star.vx=c.star._bvx||(Math.random()-0.5)*0.6; c.star.vy=c.star._bvy||(Math.random()-0.5)*0.6-0.2; }
    this.constellationTargets=null;
  },

  activatePermanentConstellation() {
    this.constellationActive=true;
    if (this.constellationTimer) clearTimeout(this.constellationTimer);
    if (this.constellationTargets) this.constellationTargets=null;
    if (!this.constellationNodes.length) this.buildConstellationNodes();
    for (let i=0;i<Math.min(this.stars.length,this.constellationNodes.length);i++) {
      const s=this.stars[i]; s.constellationNode={x:this.constellationNodes[i].x,y:this.constellationNodes[i].y}; s.cOriginX=s.x; s.cOriginY=s.y;
    }
    const start=performance.now();
    const anim=(now)=>{
      const t=Math.min((now-start)/2000,1), e=t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
      for (const s of this.stars) {
        if (s.constellationNode) { s.x=s.cOriginX+(s.constellationNode.x-s.cOriginX)*e; s.y=s.cOriginY+(s.constellationNode.y-s.cOriginY)*e; s.vx=0;s.vy=0; }
        else { s.vx*=0.95;s.vy*=0.95; }
      }
      if (t<1) requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
    EventBus.emit('particles:constellation-active',{name:'Virgo',nameZh:'处女座'});
  },

  onCollectionChanged(data) {
    const old=this.currentTier;
    const f=data.foundCount||0, t=data.totalCount||30;
    if (f>=t) this.currentTier=4; else if (f>=20) this.currentTier=3; else if (f>=10) this.currentTier=2; else if (f>=5) this.currentTier=1; else this.currentTier=0;
    if (this.currentTier!==old) { this.spawnAll(); if (this.currentTier===4&&!this.constellationActive) this.activatePermanentConstellation(); }
  },

  /* ─── Events ─── */
  bindEvents() {
    window.addEventListener('resize', debounce(() => {
      this.resize();
      this.buildConstellationNodes();
      this.spawnAll();
    }, 120));
    window.addEventListener('mousemove',(e)=>{
      if (this.panel) {
        const r = this.panel.getBoundingClientRect();
        this.mouseX = e.clientX - r.left;
        this.mouseY = e.clientY - r.top;
      } else {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
      }
    });
    window.addEventListener('mouseleave',()=>{this.mouseX=null;this.mouseY=null;this.vortexActive=false;});
    EventBus.on('mental:scan',({x,y})=>{
      if (this.panel) {
        const r = this.panel.getBoundingClientRect();
        this.vortexCx = x - r.left;
        this.vortexCy = y - r.top;
      } else {
        this.vortexCx = x;
        this.vortexCy = y;
      }
      this.vortexActive=true;
      setTimeout(()=>{this.vortexActive=false;},1200);
    });
    EventBus.on('desktop:dblclick',()=>this.triggerConstellation());
  },

  /* ─── Update ─── */
  update() {
    for (const s of this.stars) {
      if (this.constellationActive&&s.constellationNode) continue;
      if (this.vortexActive&&this.vortexCx!==null) {
        const dx=this.vortexCx-s.x, dy=this.vortexCy-s.y, d=Math.max(0.001, Math.hypot(dx,dy));
        if (d<250) { const f=(250-d)/250*3; s.vx+=-dy/d*f*0.5; s.vy+=dx/d*f*0.5; s.vx+=dx/d*f*0.3; s.vy+=dy/d*f*0.3; }
      }
      s.vx+=0.001; s.vy-=0.002; s.x+=s.vx; s.y+=s.vy; s.r+=s.rs*0.016;
      if (s.x<-10) s.x=this.width+10; if (s.x>this.width+10) s.x=-10;
      if (s.y<-10) s.y=this.height+10; if (s.y>this.height+10) s.y=-10;
      const sp=Math.hypot(s.vx,s.vy); if (sp>1.2) { s.vx*=1.2/sp; s.vy*=1.2/sp; }
    }
    for (const s of this.shards) {
      s.x+=s.vx; s.y+=s.vy; s.r+=s.rs*0.016;
      if (s.y>this.height+40) { s.y=-40; s.x=Math.random()*this.width; }
      if (s.x<-40) s.x=this.width+40; if (s.x>this.width+40) s.x=-40;
    }
    for (const b of this.bubbles) {
      b.x+=b.vx; b.y+=b.vy;
      if (b.y<-40) { b.y=this.height+40; b.x=Math.random()*this.width; }
      if (b.x<-20) b.x=this.width+20; if (b.x>this.width+20) b.x=-20;
    }
    if (this._sparkles.length) { for (const s of this._sparkles) { s.x+=s.vx; s.y+=s.vy; s.life-=0.025; } this._sparkles=this._sparkles.filter(s=>s.life>0); }
  },

  /* ─── Draw ─── */
  drawStar(ctx, cx, cy, or, ir, rot, color, glow, blur) {
    const sp=5, step=Math.PI/sp;
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot); ctx.beginPath();
    for (let i=0;i<sp*2;i++) { const r=i%2===0?or:ir, a=i*step-Math.PI/2; (i===0?ctx.moveTo:ctx.lineTo).call(ctx,Math.cos(a)*r,Math.sin(a)*r); }
    ctx.closePath(); ctx.fillStyle=color; ctx.shadowColor=glow; ctx.shadowBlur=blur; ctx.fill(); ctx.shadowBlur=0; ctx.restore();
  },

  drawShard(ctx, x, y, size, rot, alpha) {
    ctx.save(); ctx.translate(x,y); ctx.rotate(rot); ctx.globalAlpha=alpha;
    ctx.fillStyle='rgba(64,200,224,0.25)'; ctx.beginPath();
    ctx.moveTo(0,-size*0.5); ctx.lineTo(size*0.35,-size*0.15); ctx.lineTo(size*0.5,size*0.35); ctx.lineTo(size*0.1,size*0.15); ctx.lineTo(-size*0.2,size*0.4); ctx.lineTo(-size*0.3,size*0.1); ctx.lineTo(-size*0.45,-size*0.2);
    ctx.closePath(); ctx.fill(); ctx.globalAlpha=1; ctx.restore();
  },

  starColor(i, s) {
    if (s.isDot&&s.dotColor) { const st=getComputedStyle(document.body); return st.getPropertyValue(s.dotColor.replace('var(','').replace(')','')).trim()||'#f0c060'; }
    if (this.currentTier>=3) { const cols=['#f0c060','#e8e0d8','#ff4060','#40c8e0','#c040f0','#40f080']; return cols[i%cols.length]; }
    if (this.currentTier>=1) return i%3===0?'#f0c060':'#e8e0d8';
    return '#f0c060';
  },

  draw() {
    const ctx=this.ctx, w=this.width, h=this.height;
    if (!this.animating) { ctx.clearRect(0,0,w,h); return; }
    ctx.clearRect(0,0,w,h);

    // Draw links
    const thr=154, thresholdSquared=thr*thr;
    for (let i=0;i<this.stars.length;i++) {
      for (let j=i+1;j<this.stars.length;j++) {
        const a=this.stars[i], b=this.stars[j];
        if ((this.constellationActive&&a.constellationNode)||(this.constellationActive&&b.constellationNode)) continue;
        const dx=a.x-b.x, dy=a.y-b.y, distanceSquared=dx*dx+dy*dy;
        if (distanceSquared<thresholdSquared) {
          const d=Math.sqrt(distanceSquared);
          ctx.strokeStyle='rgba(242,198,109,'+((1-d/thr)*0.16)+')';
          ctx.lineWidth=0.55;
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        }
      }
    }

    if (this.mouseX!==null&&!this.constellationActive) {
      for (const s of this.stars) {
        if (s.isDot&&s.dotClicked) continue;
        const d=Math.hypot(s.x-this.mouseX,s.y-this.mouseY);
        if (d<200) { ctx.strokeStyle='rgba(232,224,216,'+((1-d/200)*0.4)+')'; ctx.lineWidth=0.8; ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(this.mouseX,this.mouseY); ctx.stroke(); }
      }
    }

    // Draw constellation lines
    if (this.constellationActive) {
      const cp=this.stars.filter(s=>s.constellationNode);
      ctx.strokeStyle='rgba(240,192,96,0.25)'; ctx.lineWidth=0.8;
      for (let i=0;i<cp.length-1;i++) { ctx.beginPath(); ctx.moveTo(cp[i].x,cp[i].y); ctx.lineTo(cp[i+1].x,cp[i+1].y); ctx.stroke(); }
    }

    // Draw stars
    for (let i=0;i<this.stars.length;i++) {
      const s=this.stars[i]; if (s.dotClicked) continue;
      const color=this.starColor(i,s), r=s.isDot?4:s.size, ir=r*0.4;
      let glow=s.isDot?16:10;
      if (s.isDot&&this.mouseX!==null&&Math.hypot(s.x-this.mouseX,s.y-this.mouseY)<60) glow=24;
      ctx.globalAlpha=s.isDot ? 0.96 : Math.min(0.9, s.alpha + 0.14);
      this.drawStar(ctx,s.x,s.y,r,ir,s.r,color,color,glow);
      ctx.globalAlpha=1;
      if (s.isDot) { ctx.beginPath(); ctx.arc(s.x,s.y,r+5,0,Math.PI*2); ctx.strokeStyle=color; ctx.globalAlpha=0.25; ctx.lineWidth=1; ctx.stroke(); ctx.globalAlpha=1; }
    }

    // Draw shards
    for (const s of this.shards) this.drawShard(ctx, s.x, s.y, s.size, s.r, s.alpha);

    // Draw bubbles
    for (const b of this.bubbles) {
      ctx.beginPath(); ctx.arc(b.x,b.y,b.size,0,Math.PI*2);
      ctx.fillStyle='rgba(200,180,255,'+b.alpha+')'; ctx.fill();
      ctx.strokeStyle='rgba(200,180,255,'+(b.alpha*0.5)+')'; ctx.lineWidth=0.5; ctx.stroke();
    }

    // Sparkles
    for (const s of this._sparkles) { this.drawStar(ctx,s.x,s.y,3,1.2,0,'#f0c060','#f0c060',8); ctx.globalAlpha=s.life; ctx.globalAlpha=1; }
  },

  loop(now = performance.now()) {
    requestAnimationFrame((next) => this.loop(next));
    if (!this.animating || document.hidden) return;
    // The panel particles are ambient rather than input-critical. 30 FPS keeps
    // their motion smooth while halving the most expensive canvas workload.
    if (now - this._lastFrame < 32) return;
    this._lastFrame = now;
    this.update();
    this.draw();
  },

  onThemeChange() {},
  setAnimating(s) { this.animating=s; if(!s) this.ctx.clearRect(0,0,this.width,this.height); },
  explode() {
    if (this.constellationActive) return;
    for (const s of this.stars) { const a=Math.random()*Math.PI*2, sp=rand(3,10); s.x=this.width/2+(Math.random()-0.5)*20; s.y=this.height/2+(Math.random()-0.5)*20; s.vx=Math.cos(a)*sp; s.vy=Math.sin(a)*sp; }
    setTimeout(()=>{for(const s of this.stars){s.vx=(Math.random()-0.5)*0.6;s.vy=(Math.random()-0.5)*0.6-0.2;}},2000);
  },
  sprinkle(x,y) { this.burstAt(x,y); },
};
