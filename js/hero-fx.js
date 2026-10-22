/* QB1 hero logo: Igloo-style fluid particles (v12, vanilla Canvas 2D, no libraries).
   Inspired by the igloo.inc footer: particles hold a shape, a coarse 2D fluid grid driven by the
   cursor/finger advects them in swirls, speed brightens them toward white-hot, a tap bursts them
   with trails, then a soft spring reforms the logo. At rest the crisp logo image is shown, with
   a faint shimmer of glints and depth-layered dust drifting around it.
   - particles sampled from assets/logo.svg with their real colours (orange / purple / navy)
   - 3.2-4.5k particles on touch/small screens, 6-8.5k on desktop, DPR <= 2
   - touch: passive listeners only + CSS touch-action:pan-y, so vertical scrolling is never blocked
   - pauses when the hero is offscreen or the tab is hidden; idle frames run at ~30 fps
   - prefers-reduced-motion: static logo, gentle glow pulse on tap/click/Enter */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var coarse = window.matchMedia("(pointer: coarse)");
  var TAU = Math.PI * 2;

  function sprite(r, g, b, soft) {
    var s = document.createElement("canvas"); s.width = s.height = 32;
    var c = s.getContext("2d"), gr = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, "rgba(" + r + "," + g + "," + b + ",1)");
    gr.addColorStop(soft ? 0.25 : 0.12, "rgba(" + r + "," + g + "," + b + "," + (soft ? 0.45 : 0.6) + ")");
    gr.addColorStop(1, "rgba(" + r + "," + g + "," + b + ",0)");
    c.fillStyle = gr; c.fillRect(0, 0, 32, 32); return s;
  }
  function mix(a, b, t) { return Math.round(a + (b - a) * t); }

  function HeroFX(canvas, img, opts) {
    this.c = canvas; this.ctx = canvas.getContext("2d");
    if (!this.ctx) throw new Error("no 2d context");
    this.img = img; this.o = opts || {};
    this.t = 0; this.last = 0; this.running = false; this.visible = true;
    this.energy = 0; this.awake = false; this.imgA = 1; this.glow = 0; this.trail = 0; this.frame = 0;
    this.ptr = { x: 0, y: 0, t: 0, has: false };
    this.resize();
  }
  var P = HeroFX.prototype;

  P.resize = function () {
    var r = this.c.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = Math.max(1, Math.round(r.width)); this.H = Math.max(1, Math.round(r.height));
    this.c.width = Math.round(this.W * this.dpr); this.c.height = Math.round(this.H * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.layout(); this.bakeRest(); this.sample(); this.makeFluid(); this.makeDust();
    this.render(0);
  };
  P.layout = function () {
    var iw = this.img.naturalWidth || 2664, ih = this.img.naturalHeight || 680;
    var bx = (this.o.bleedFX || 0) * this.W, by = (this.o.bleedFY || 0) * this.H;
    var aw = Math.max(10, this.W - 2 * bx), ah = Math.max(10, this.H - 2 * by);
    var s = Math.min(aw / iw, ah / ih), w = iw * s, h = ih * s;
    this.home = { x: (this.W - w) / 2, y: (this.H - h) / 2, w: w, h: h };
    this.k = Math.max(0.35, Math.min(1.2, w / 720));       // physics scale: 1 = 720 px desktop logo
  };
  // Crisp rest image with the old CSS look (thin white rim + soft drop shadow) baked in once.
  P.bakeRest = function () {
    var d = this.dpr, h = this.home, c = document.createElement("canvas");
    c.width = this.c.width; c.height = this.c.height;
    var x = c.getContext("2d"); x.setTransform(d, 0, 0, d, 0, 0);
    // shadow-only layer: draw the logo far off-canvas and offset its shadow back into view
    var sc = document.createElement("canvas"); sc.width = c.width; sc.height = c.height;
    var sx = sc.getContext("2d"), off = 10000;
    sx.shadowColor = "rgba(0,0,0,.5)"; sx.shadowBlur = 24 * d; sx.shadowOffsetX = off * d; sx.shadowOffsetY = 6 * d;
    sx.setTransform(d, 0, 0, d, 0, 0); sx.drawImage(this.img, h.x - off, h.y, h.w, h.h);
    this.shadow = sc;
    x.drawImage(sc, 0, 0); x.setTransform(d, 0, 0, d, 0, 0);
    x.save(); x.shadowColor = "rgba(255,255,255,.65)"; x.shadowBlur = 1.5 * d;
    x.drawImage(this.img, h.x, h.y, h.w, h.h); x.restore();
    this.rest = c;
    var cc = document.createElement("canvas"); cc.width = c.width; cc.height = c.height;
    var cx = cc.getContext("2d"); cx.setTransform(d, 0, 0, d, 0, 0);
    cx.shadowColor = "rgba(255,255,255,.65)"; cx.shadowBlur = 1.5 * d; cx.drawImage(this.img, h.x, h.y, h.w, h.h);
    this.crisp = cc;
    var L = document.createElement("canvas"); L.width = c.width; L.height = c.height; this.layer = L; this.lctx = L.getContext("2d");
  };
  P.sample = function () {
    var h = this.home, iw = this.img.naturalWidth || 2664, ih = this.img.naturalHeight || 680;
    var sw = Math.max(2, Math.round(h.w * 2)), sh = Math.max(2, Math.round(h.h * 2)); // 2 samples per css px
    var off = document.createElement("canvas"); off.width = sw; off.height = sh;
    var o = off.getContext("2d", { willReadFrequently: true });
    o.drawImage(this.img, 0, 0, sw, sh);
    var d; try { d = o.getImageData(0, 0, sw, sh).data; } catch (e) { this.n = 0; return; }
    var A = 120, opaque = 0, i;
    for (i = 3; i < d.length; i += 4) if (d[i] >= A) opaque++;
    var small = coarse.matches || window.innerWidth < 700;
    var cap = small ? (window.innerWidth < 400 ? 3600 : 4500) : 8500;
    cap = Math.min(cap, Math.max(1200, Math.round(h.w * h.h / 3)));
    var step = Math.max(1, Math.sqrt(opaque / cap));
    // colour palette (logo uses a few flat colours) -> index per particle
    var pal = [], palKey = {}, pts = [];
    for (var yy = 0; yy < sh; yy += step) for (var xx = 0; xx < sw; xx += step) {
      var X = Math.max(0, Math.min(sw - 1, Math.round(xx + (Math.random() - 0.5) * step * 0.6)));
      var Y = Math.max(0, Math.min(sh - 1, Math.round(yy + (Math.random() - 0.5) * step * 0.6)));
      var q = (Y * sw + X) * 4; if (d[q + 3] < A) continue;
      var key = ((d[q] >> 4) << 8) | ((d[q + 1] >> 4) << 4) | (d[q + 2] >> 4), ci = palKey[key];
      if (ci === undefined) { ci = palKey[key] = pal.length; pal.push([d[q], d[q + 1], d[q + 2], 0]); }
      pal[ci][3]++;
      pts.push(X / sw, Y / sh, ci);
    }
    var n = this.n = pts.length / 3;
    this.hx = new Float32Array(n); this.hy = new Float32Array(n);
    this.x = new Float32Array(n); this.y = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n);
    this.z = new Float32Array(n); this.seed = new Float32Array(n);
    this.ramp = new Float32Array(n); this.ci = new Uint8Array(n); this.out = new Uint8Array(n);
    for (i = 0; i < n; i++) {
      this.hx[i] = this.x[i] = h.x + pts[i * 3] * h.w; this.hy[i] = this.y[i] = h.y + pts[i * 3 + 1] * h.h;
      this.ci[i] = Math.min(255, pts[i * 3 + 2]); this.z[i] = Math.random() * 2 - 1; this.seed[i] = Math.random(); this.ramp[i] = 1;
    }
    this.gap = step / 2; this.psize = Math.max(1, step / 2 * 1.15);     // css px, enough overlap to read as solid
    // bucket styles: palette colour x 4 heat levels (heat lerps toward hot white, like igloo's speed glow)
    this.styles = [];
    for (i = 0; i < pal.length && i < 256; i++) {
      var r = pal[i][0], g = pal[i][1], b = pal[i][2], lum = 0.3 * r + 0.59 * g + 0.11 * b;
      if (lum < 90) { r = mix(r, 150, 0.35); g = mix(g, 130, 0.35); b = mix(b, 230, 0.35); } // lift navy so it reads on #0B0B14
      var row = [];
      for (var lv = 0; lv < 4; lv++) {
        var t = [0, 0.18, 0.38, 0.58][lv];
        row.push("rgb(" + mix(r, 255, t) + "," + mix(g, 236, t) + "," + mix(b, 222, t) + ")");
      }
      this.styles.push(row);
    }
    this.nb = this.styles.length * 4;
    this.glints = [sprite(255, 214, 170, false), sprite(214, 180, 255, false), sprite(255, 255, 255, false)];
    // shimmer glints: ~1.5% of particles
    this.gl = []; for (i = 0; i < Math.round(n * 0.015); i++) this.gl.push((Math.random() * n) | 0);
  };
  P.makeFluid = function () {
    var cs = this.cs = Math.max(8, this.W / 64);
    this.GW = Math.ceil(this.W / cs) + 1; this.GH = Math.ceil(this.H / cs) + 1;
    var m = this.GW * this.GH;
    this.u = new Float32Array(m); this.v = new Float32Array(m); this.u2 = new Float32Array(m); this.v2 = new Float32Array(m);
    this.fluidE = 0;
  };
  P.makeDust = function () {
    var nd = coarse.matches || window.innerWidth < 700 ? 140 : 260;
    this.dust = [];
    var cols = [this.glints[0], this.glints[1], this.glints[2]];
    for (var i = 0; i < nd; i++) {
      var z = Math.random();
      this.dust.push({ x: Math.random() * this.W, y: Math.random() * this.H, vx: 0, vy: 0, z: z,
        s: (0.6 + z * 2.2) * Math.max(0.7, this.k), a: 0.08 + z * 0.3, ph: Math.random() * TAU, spr: cols[(Math.random() * 3) | 0] });
    }
  };

  /* ---------- fluid ---------- */
  P.sampleF = function (x, y, out) {
    var gx = x / this.cs, gy = y / this.cs, GW = this.GW, GH = this.GH;
    if (gx < 0) gx = 0; if (gy < 0) gy = 0; if (gx > GW - 1.001) gx = GW - 1.001; if (gy > GH - 1.001) gy = GH - 1.001;
    var ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy, i = iy * GW + ix, u = this.u, v = this.v;
    var a = (1 - fx) * (1 - fy), b = fx * (1 - fy), c = (1 - fx) * fy, d = fx * fy;
    out[0] = u[i] * a + u[i + 1] * b + u[i + GW] * c + u[i + GW + 1] * d;
    out[1] = v[i] * a + v[i + 1] * b + v[i + GW] * c + v[i + GW + 1] * d;
  };
  // Splat: push velocity (dvx,dvy) around (x,y); swirl adds counter-rotating curls on either side of the motion.
  P.splat = function (x, y, dvx, dvy, R, swirl, radial) {
    var cs = this.cs, GW = this.GW, GH = this.GH, r = Math.ceil(R * 2 / cs);
    var cx = Math.round(x / cs), cy = Math.round(y / cs), sp = Math.hypot(dvx, dvy) || 1;
    for (var gy = Math.max(0, cy - r); gy <= Math.min(GH - 1, cy + r); gy++)
      for (var gx = Math.max(0, cx - r); gx <= Math.min(GW - 1, cx + r); gx++) {
        var ox = gx * cs - x, oy = gy * cs - y, d2 = ox * ox + oy * oy, w = Math.exp(-d2 / (R * R));
        if (w < 0.01) continue;
        var d = Math.sqrt(d2) || 1, i = gy * GW + gx;
        var side = (dvx * oy - dvy * ox) > 0 ? 1 : -1;          // which side of the stroke
        var tw = swirl * sp * w * Math.min(1, d / (R * 0.5));
        this.u[i] += dvx * w + (-oy / d) * tw * side + (ox / d) * radial * w;
        this.v[i] += dvy * w + (ox / d) * tw * side + (oy / d) * radial * w;
      }
    this.wake();
  };
  P.stepFluid = function (dt) {
    var GW = this.GW, GH = this.GH, u = this.u, v = this.v, u2 = this.u2, v2 = this.v2, cs = this.cs;
    var dec = Math.exp(-1.9 * dt), e = 0, x, y;
    // semi-Lagrangian self-advection (gives the rolling, swirly feel)
    for (y = 0; y < GH; y++) for (x = 0; x < GW; x++) {
      var i = y * GW + x, bx = x - u[i] * dt / cs, by = y - v[i] * dt / cs;
      if (bx < 0) bx = 0; if (by < 0) by = 0; if (bx > GW - 1.001) bx = GW - 1.001; if (by > GH - 1.001) by = GH - 1.001;
      var ix = bx | 0, iy = by | 0, fx = bx - ix, fy = by - iy, j = iy * GW + ix;
      var a = (1 - fx) * (1 - fy), b = fx * (1 - fy), c = (1 - fx) * fy, d = fx * fy;
      u2[i] = u[j] * a + u[j + 1] * b + u[j + GW] * c + u[j + GW + 1] * d;
      v2[i] = v[j] * a + v[j + 1] * b + v[j + GW] * c + v[j + GW + 1] * d;
    }
    // light diffusion + decay
    for (y = 0; y < GH; y++) for (x = 0; x < GW; x++) {
      var k = y * GW + x, l = x > 0 ? k - 1 : k, r = x < GW - 1 ? k + 1 : k, t = y > 0 ? k - GW : k, bo = y < GH - 1 ? k + GW : k;
      u[k] = (u2[k] * 0.6 + (u2[l] + u2[r] + u2[t] + u2[bo]) * 0.1) * dec;
      v[k] = (v2[k] * 0.6 + (v2[l] + v2[r] + v2[t] + v2[bo]) * 0.1) * dec;
      e += Math.abs(u[k]) + Math.abs(v[k]);
    }
    this.fluidE = e / (GW * GH);
  };

  /* ---------- interaction ---------- */
  P.local = function (cx, cy) { var r = this.c.getBoundingClientRect(); return [(cx - r.left) * this.W / r.width, (cy - r.top) * this.H / r.height]; };
  P.move = function (cx, cy, now) {
    var p = this.local(cx, cy), pt = this.ptr;
    if (reduce.matches) return;
    if (pt.has && now - pt.t < 120) {
      var dt = Math.max(8, now - pt.t) / 1000, dvx = (p[0] - pt.x) / dt, dvy = (p[1] - pt.y) / dt;
      var sp = Math.hypot(dvx, dvy), cap = 2600 * this.k;
      if (sp > cap) { dvx *= cap / sp; dvy *= cap / sp; }
      if (sp > 4 && p[0] > -40 && p[0] < this.W + 40 && p[1] > -40 && p[1] < this.H + 40)
        this.splat(p[0], p[1], dvx * 0.55, dvy * 0.55, Math.max(22, 54 * this.k), 0.35, 0);
    }
    pt.x = p[0]; pt.y = p[1]; pt.t = now; pt.has = true;
  };
  P.burst = function (cx, cy) {
    if (cx == null) { cx = this.W / 2; cy = this.H / 2; } else { var p = this.local(cx, cy); cx = p[0]; cy = p[1]; }
    if (reduce.matches) { this.glow = 1; this.wake(); return; }
    var k = this.k;
    for (var i = 0; i < this.n; i++) {
      var dx = this.x[i] - cx, dy = this.y[i] - cy, d = Math.hypot(dx, dy) || 1, s = this.seed[i];
      var sp = (260 + Math.random() * 720) * k * (0.6 + 0.6 * Math.exp(-d / (260 * k))) * (1 + this.z[i] * 0.25);
      var a = (Math.random() - 0.5) * 0.7, ca = Math.cos(a), sa = Math.sin(a), ux = dx / d, uy = dy / d;
      var tan = (s - 0.5) * 380 * k;
      this.vx[i] += (ux * ca - uy * sa) * sp - uy * tan;
      this.vy[i] += (ux * sa + uy * ca) * sp + ux * tan - 60 * k;
      this.ramp[i] = -(0.22 + s * 0.35); this.out[i] = 1;              // spring off for a moment, staggered reform
    }
    this.splat(cx, cy, 0, 0, 120 * k, 0, 900 * k);
    this.glow = 1; this.trail = 1;
    this.wake();
  };
  P.wake = function () { this.awake = true; this.idleFor = 0; this.start(); };

  /* ---------- loop ---------- */
  P.setVisible = function (v) { this.visible = v; if (v) this.start(); };
  P.start = function () {
    if (this.running || !this.visible || document.hidden) return;
    this.running = true; this.last = 0; var self = this;
    requestAnimationFrame(function f(ts) {
      if (!self.visible || document.hidden) { self.running = false; return; }
      self.tick(ts);
      if (self.keepRunning()) requestAnimationFrame(f); else self.running = false;
    });
  };
  P.keepRunning = function () { return reduce.matches ? (this.glow > 0.002) : true; };
  P.tick = function (ts) {
    if (!this.last) this.last = ts;
    var dtms = ts - this.last;
    if (!this.awake && !reduce.matches && dtms < 30) return;   // idle shimmer at ~30 fps
    var dt = Math.min(dtms / 1000, 0.033); this.last = ts;
    if (dt <= 0) return;
    this.t += dt;
    if (!reduce.matches && this.awake) { this.stepFluid(dt); this.stepParticles(dt); }
    this.stepDust(dt);
    this.glow = Math.max(0, this.glow - dt * (reduce.matches ? 1.1 : 1.6));
    this.trail = Math.max(0, this.trail - dt * 0.9);
    var target = this.awake ? 0 : 1;
    this.imgA += (target - this.imgA) * Math.min(1, dt * (target ? 9 : 22));
    if (Math.abs(this.imgA - target) < 0.01) this.imgA = target;
    this.render(dt);
  };
  P.stepParticles = function (dt) {
    var n = this.n, x = this.x, y = this.y, vx = this.vx, vy = this.vy, hx = this.hx, hy = this.hy, z = this.z, ramp = this.ramp, seed = this.seed;
    var f = [0, 0], k = this.k, t = this.t, K = 70, couple = 6.2, maxD = 0, maxV = 0, E = 0;
    var cn = 0.018 / k, cAmp = 300 * k, nOut = 0;
    for (var i = 0; i < n; i++) {
      this.sampleF(x[i], y[i], f);
      var zc = 1 + z[i] * 0.35, cr = Math.min(1, dt * couple * zc);
      vx[i] += (f[0] * 1.25 - vx[i]) * cr;                 // carried by the fluid (and damped by it)
      vy[i] += (f[1] * 1.25 - vy[i]) * cr;
      var dx = hx[i] - x[i], dy = hy[i] - y[i], d2 = dx * dx + dy * dy;
      var rp = ramp[i]; if (rp < 1) { rp += dt * (1.5 + seed[i] * 1.1); ramp[i] = rp > 1 ? 1 : rp; }
      var s = rp > 0 ? rp * rp : 0;
      vx[i] += dx * K * s * dt; vy[i] += dy * K * s * dt;
      if (d2 > 4) {                                        // displaced particles curl (cheap curl noise)
        var a = Math.sin(y[i] * cn + t * 1.3 + seed[i] * 6) + Math.cos(x[i] * cn * 0.7 - t);
        var w = Math.min(1, Math.sqrt(d2) / (40 * k)) * cAmp * dt;
        vx[i] += Math.cos(a * 2.2) * w; vy[i] += Math.sin(a * 2.2) * w;
      }
      x[i] += vx[i] * dt; y[i] += vy[i] * dt;
      var v2 = vx[i] * vx[i] + vy[i] * vy[i];
      dx = hx[i] - x[i]; dy = hy[i] - y[i]; d2 = dx * dx + dy * dy;
      if (d2 < 1.1 && v2 < 150 && rp >= 1 && Math.abs(f[0]) + Math.abs(f[1]) < 8) { x[i] = hx[i]; y[i] = hy[i]; vx[i] = vy[i] = 0; this.out[i] = 0; }
      else { this.out[i] = 1; nOut++; }
      if (d2 > maxD) maxD = d2; if (v2 > maxV) maxV = v2; E += d2;
    }
    this.nOut = nOut;
    this.energy = E / n;
    var still = nOut === 0 && this.fluidE < 0.4;
    if (still) {
      this.idleFor = (this.idleFor || 0) + dt;
      if (this.idleFor > 0.12) {                           // settled: snap home, back to crisp image
        for (i = 0; i < n; i++) { x[i] = hx[i]; y[i] = hy[i]; vx[i] = vy[i] = 0; ramp[i] = 1; this.out[i] = 0; }
        this.u.fill(0); this.v.fill(0); this.awake = false;
      }
    } else this.idleFor = 0;
  };
  P.stepDust = function (dt) {
    var f = [0, 0], t = this.t, W = this.W, H = this.H, rm = reduce.matches;
    for (var i = 0; i < this.dust.length; i++) {
      var p = this.dust[i];
      if (rm) continue;
      var fl = 0;
      if (this.awake) { this.sampleF(p.x, p.y, f); fl = 1; }
      var drift = 8 * this.k * (0.4 + p.z);
      var tx = Math.cos(t * 0.21 + p.ph + p.y * 0.01) * drift + f[0] * fl * (0.6 + p.z);
      var ty = Math.sin(t * 0.17 + p.ph * 1.3 + p.x * 0.01) * drift * 0.6 - 3 * p.z + f[1] * fl * (0.6 + p.z);
      p.vx += (tx - p.vx) * Math.min(1, dt * 2.5); p.vy += (ty - p.vy) * Math.min(1, dt * 2.5);
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < -10) p.x += W + 20; else if (p.x > W + 10) p.x -= W + 20;
      if (p.y < -10) p.y += H + 20; else if (p.y > H + 10) p.y -= H + 20;
    }
  };

  /* ---------- draw ---------- */
  P.render = function () {
    var c = this.ctx, W = this.W, H = this.H, i;
    var trails = this.awake && this.trail > 0.05 && !reduce.matches;
    if (trails) {                                        // motion-blur trails during a burst
      c.save(); c.globalCompositeOperation = "destination-out"; c.globalAlpha = 1 - 0.6 * this.trail;
      c.fillRect(0, 0, W, H); c.restore();
    } else c.clearRect(0, 0, W, H);
    var h = this.home, t = this.t;
    // soft orange/purple aura behind the logo (breathes, flares on interaction)
    var aura = 0.05 + 0.03 * Math.sin(t * 0.8) + this.glow * 0.22 + Math.min(0.12, this.energy / 3000);
    if (aura > 0.01) {
      c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = aura;
      c.drawImage(this.glints[0], h.x - h.w * 0.05, h.y - h.h * 0.6, h.w * 0.6, h.h * 2.2);
      c.drawImage(this.glints[1], h.x + h.w * 0.45, h.y - h.h * 0.6, h.w * 0.6, h.h * 2.2);
      c.restore();
    }
    // depth dust (behind)
    this.drawDust(c, false);
    var live = this.awake && !reduce.matches && this.n;
    if (live) {                                          // crisp logo, minus the pixels whose particles are away
      var l = this.lctx, g = this.gap * 1.6, out = this.out, hx = this.hx, hy = this.hy;
      l.setTransform(1, 0, 0, 1, 0, 0); l.globalCompositeOperation = "source-over"; l.clearRect(0, 0, this.layer.width, this.layer.height);
      l.drawImage(this.crisp, 0, 0);
      l.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); l.globalCompositeOperation = "destination-out"; l.beginPath();
      for (i = 0; i < this.n; i++) if (out[i]) l.rect(hx[i] - g / 2, hy[i] - g / 2, g, g);
      l.fill();
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      var home = 1 - (this.nOut || 0) / this.n; if (home > 0.02) { c.globalAlpha = home * home; c.drawImage(this.shadow, 0, 0); c.globalAlpha = 1; }
      c.drawImage(this.layer, 0, 0); c.restore(); c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.drawParticles(c);
    } else {
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(this.rest, 0, 0);
      if (reduce.matches && this.glow > 0) {               // reduced motion: gentle glow pulse only
        c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.32 * Math.sin(Math.min(1, this.glow) * Math.PI); c.drawImage(this.rest, 0, 0);
      }
      c.restore(); c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
    if (!reduce.matches) this.drawGlints(c);
    this.drawDust(c, true);
  };
  P.drawParticles = function (c) {
    var n = this.n, x = this.x, y = this.y, vx = this.vx, vy = this.vy, z = this.z, ci = this.ci, k = this.k;
    var nb = this.nb, ps = this.psize, hot = 520 * k;
    if (!this._b || this._b.length !== nb) { this._b = []; for (var b = 0; b < nb; b++) this._b.push([]); }
    var B = this._b, i, j;
    for (j = 0; j < nb; j++) B[j].length = 0;
    var out = this.out;
    for (i = 0; i < n; i++) {
      if (!out[i]) continue;
      var sp = Math.abs(vx[i]) + Math.abs(vy[i]), lv = sp < hot * 0.12 ? 0 : sp < hot * 0.45 ? 1 : sp < hot ? 2 : 3;
      B[ci[i] * 4 + lv].push(i);
    }
    c.save();
    for (j = 0; j < nb; j++) {
      var L = B[j]; if (!L.length) continue;
      var lv2 = j & 3, st = this.styles[j >> 2][lv2];
      if (lv2 < 2) {                                        // calm: tiny squares (dense = reads as the logo)
        c.fillStyle = st; c.beginPath();
        for (var q = 0; q < L.length; q++) { i = L[q]; var s = ps * (1 + z[i] * 0.22); c.rect(x[i] - s / 2, y[i] - s / 2, s, s); }
        c.fill();
      } else {                                              // fast: streaks along velocity
        c.strokeStyle = st; c.lineWidth = ps * (lv2 === 3 ? 0.9 : 1.05); c.lineCap = "round"; c.beginPath();
        var tl = lv2 === 3 ? 0.028 : 0.018;
        for (q = 0; q < L.length; q++) { i = L[q]; c.moveTo(x[i], y[i]); c.lineTo(x[i] - vx[i] * tl, y[i] - vy[i] * tl); }
        c.stroke();
      }
    }
    // additive glow on the fastest particles (igloo: speed => brighter)
    c.globalCompositeOperation = "lighter";
    for (j = 0; j < nb; j++) {
      if ((j & 3) < 2) continue; L = B[j]; if (!L.length) continue;
      c.globalAlpha = (j & 3) === 3 ? 0.16 : 0.1; var g = this.glints[(this.styles[j >> 2] && j % 3) || 0], gs = ps * 7;
      for (q = 0; q < L.length; q += 2) { i = L[q]; c.drawImage(g, x[i] - gs / 2, y[i] - gs / 2, gs, gs); }
    }
    c.restore();
  };
  P.drawGlints = function (c) {
    var t = this.t, gl = this.gl; if (!gl.length) return;
    c.save(); c.globalCompositeOperation = "lighter";
    var gs = Math.max(5, 11 * this.k);
    for (var j = 0; j < gl.length; j++) {
      var i = gl[j], ph = (t * (0.35 + this.seed[i] * 0.5) + this.seed[i] * 7) % 1, a = Math.pow(Math.sin(ph * Math.PI), 10);
      if (a < 0.03) continue;
      c.globalAlpha = a * 0.75;
      c.drawImage(this.glints[2], this.x[i] - gs / 2, this.y[i] - gs / 2, gs, gs);
    }
    c.restore();
  };
  P.drawDust = function (c, front) {
    c.save(); c.globalCompositeOperation = "lighter";
    for (var i = 0; i < this.dust.length; i++) {
      var p = this.dust[i]; if ((p.z > 0.6) !== front) continue;
      var tw = 0.65 + 0.35 * Math.sin(this.t * (0.8 + p.z) + p.ph);
      var sp = Math.abs(p.vx) + Math.abs(p.vy), boost = Math.min(2.5, 1 + sp / (220 * this.k));
      c.globalAlpha = Math.min(1, p.a * tw * boost * (1 + this.glow));
      var s = p.s * 3 * boost; c.drawImage(p.spr, p.x - s / 2, p.y - s / 2, s, s);
    }
    c.restore();
  };

  /* ---------- binding: passive listeners only, page scroll never blocked ---------- */
  HeroFX.bind = function (el, fx, section) {
    var stage = section || el, pass = { passive: true };
    // mouse / pen: stir the fluid anywhere over the hero, click = burst
    stage.addEventListener("pointermove", function (e) { if (e.pointerType === "touch") return; fx.move(e.clientX, e.clientY, performance.now()); }, pass);
    // touch: finger stirs (also while the page scrolls), quick tap = burst
    var t0 = null, lastBurst = 0;
    el.addEventListener("touchstart", function (e) {
      var p = e.touches[0]; t0 = { x: p.clientX, y: p.clientY, t: performance.now() };
      fx.ptr.has = false; fx.move(p.clientX, p.clientY, performance.now());
    }, pass);
    el.addEventListener("touchmove", function (e) { var p = e.touches[0]; fx.move(p.clientX, p.clientY, performance.now()); }, pass);
    el.addEventListener("touchend", function (e) {
      if (!t0) return; var p = e.changedTouches[0], s = t0; t0 = null;
      if (Math.hypot(p.clientX - s.x, p.clientY - s.y) < 12 && performance.now() - s.t < 500) { lastBurst = performance.now(); fx.burst(p.clientX, p.clientY); }
    }, pass);
    el.addEventListener("touchcancel", function () { t0 = null; }, pass);
    // click: mouse clicks, plus a fallback for any touch browser where touchend did not fire a burst
    el.addEventListener("click", function (e) {
      if (performance.now() - lastBurst < 700) return;
      lastBurst = performance.now();
      if (e.detail === 0) fx.burst(); else fx.burst(e.clientX, e.clientY);
    });
    el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); lastBurst = performance.now(); fx.burst(); } });
    // pause offscreen / hidden tab
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { fx.setVisible(es[0].isIntersecting); }).observe(el);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) fx.start(); });
    if (reduce.addEventListener) reduce.addEventListener("change", function () { fx.awake = false; fx.imgA = 1; fx.start(); fx.render(0); });
    fx.start();
  };
  window.HeroFX = HeroFX;
})();
