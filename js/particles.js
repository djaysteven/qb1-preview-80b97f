/* QB1 logo particle hover: disintegrate + melt back.
   Faithful port of the Mist Club prototype (/workspace/demos/mist-hover-effect, "Designer v2" values):
   - logo IMAGE sampled pixel by pixel (alpha >= 140), colours never recoloured, per-pixel alpha kept
   - density: Mist budget (9000 desktop / 4500 small or coarse) scaled to the logo's on-screen area
   - scatter: radial burst (38..203 px/s x distance factor), +/-0.31 rad spread, sideways-biased tangential
     drift, gentle lift; then curl-like swirl (22), gravity 110 px/s^2, drag exp(-1.5 dt), soft twinkle
   - melt: per-particle stagger min(d/900,0.55)+seed*0.16, critically damped spring k=90, c=2*sqrt(k),
     snap when d<0.55 && v<14; then 180 ms crossfade back to the crisp image
   - additive glow pass (8%, 4.5x sprite) only while moving
   - reduced motion: no movement, opacity crossfade to 12%
   Velocities/gravity are scaled to the logo size so small button logos feel like the big Mist stage.
   The canvas may be larger than the logo (CSS bleed) so particles can drift past the edges. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var coarse = window.matchMedia("(pointer: coarse)");

  var spriteCache = new Map();
  function glowSprite(r, g, b) {
    var qr = r >> 4, qg = g >> 4, qb = b >> 4, key = (qr << 8) | (qg << 4) | qb;
    var s = spriteCache.get(key); if (s) return s;
    s = document.createElement("canvas"); s.width = 32; s.height = 32;
    var c = s.getContext("2d"), gr = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    var cr = (qr << 4) + 8, cg = (qg << 4) + 8, cb = (qb << 4) + 8;
    gr.addColorStop(0, "rgba(" + cr + "," + cg + "," + cb + ",0.85)");
    gr.addColorStop(0.4, "rgba(" + cr + "," + cg + "," + cb + ",0.28)");
    gr.addColorStop(1, "rgba(" + cr + "," + cg + "," + cb + ",0)");
    c.fillStyle = gr; c.fillRect(0, 0, 32, 32);
    if (spriteCache.size > 220) spriteCache.clear();
    spriteCache.set(key, s); return s;
  }

  function LogoFX(canvas, img, opts) {
    this.c = canvas; this.ctx = canvas.getContext("2d");
    this.img = img; this.o = opts || {};
    this.p = []; this.mode = "home"; this.settled = true; this.fade = 1; this.alpha = 1;
    this.running = false; this.last = 0; this.t = 0;
    this.resize();
  }
  LogoFX.prototype.resize = function () {
    var r = this.c.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = Math.max(1, Math.round(r.width)); this.H = Math.max(1, Math.round(r.height));
    this.c.width = Math.round(this.W * dpr); this.c.height = Math.round(this.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.sample(); this.draw();
  };
  LogoFX.prototype.sample = function () {
    var iw = this.img.naturalWidth || 1200, ih = this.img.naturalHeight || 675;
    // logo box inside the (possibly bleeding) canvas: bleed is in CSS px on each side
    var bx = (this.o.bleedFX || 0) * this.W, by = (this.o.bleedFY || 0) * this.H;
    var aw = Math.max(10, this.W - 2 * bx), ah = Math.max(10, this.H - 2 * by);
    var s = Math.min(aw / iw, ah / ih);
    var w = iw * s, h = ih * s;
    this.home = { x: (this.W - w) / 2, y: (this.H - h) / 2, w: w, h: h };
    this.k = Math.max(0.3, Math.min(1, w / 760));               // physics scale vs Mist stage
    // sample at bounded resolution (Mist: 880x520), never below 2x display for small logos
    var ss = Math.min(880 / iw, 520 / ih); ss = Math.max(ss, Math.min(2 * w / iw, 3));
    var sw = Math.max(2, Math.round(iw * ss)), sh = Math.max(2, Math.round(ih * ss));
    var off = document.createElement("canvas"); off.width = sw; off.height = sh;
    var o = off.getContext("2d", { willReadFrequently: true });
    o.imageSmoothingEnabled = true; try { o.imageSmoothingQuality = "high"; } catch (e) {}
    o.drawImage(this.img, 0, 0, sw, sh);
    var d; try { d = o.getImageData(0, 0, sw, sh).data; } catch (e) { this.p = []; return; }
    var ALPHA = 140, opaque = 0, i;
    for (i = 3; i < d.length; i += 4) if (d[i] >= ALPHA) opaque++;
    if (!opaque) { this.p = []; return; }
    // Mist budget caps (9000 desktop / 4500 small or coarse)
    var small = coarse.matches || Math.min(window.innerWidth, window.innerHeight) < 620 || window.innerWidth < 700;
    var base = small ? 4500 : 9000;
    var cap = Math.round(Math.min(base, Math.max(600, (w * h) / 12))); // Mist budget, ~1 particle per 12 css px^2 of logo box
    var step = Math.max(1, Math.ceil(Math.sqrt(opaque / cap)));
    var list;
    while (true) {
      list = [];
      for (var y = 0; y < sh; y += step) for (var x = 0; x < sw; x += step) {
        var q = (y * sw + x) * 4, a = d[q + 3];
        if (a >= ALPHA) list.push({ nx: x / (sw - 1), ny: y / (sh - 1), r: d[q], g: d[q + 1], b: d[q + 2], a: a / 255,
          x: 0, y: 0, vx: 0, vy: 0, hx: 0, hy: 0, delay: 0, seed: Math.random() * Math.PI * 2, size: 1 });
      }
      if (list.length <= cap || step > 40) break;
      step++;
    }
    // Mist size rule: min(4.8, max(1.6, step*1.45)) in sample px, converted to display px
    var disp = (step * 1.45) * (w / sw);
    var sz = Math.min(4.8, Math.max(1.1, disp));
    for (i = 0; i < list.length; i++) {
      var p = list[i]; p.hx = this.home.x + p.nx * w; p.hy = this.home.y + p.ny * h; p.x = p.hx; p.y = p.hy;
      p.size = sz * (0.8 + Math.random() * 0.45); p.col = "rgb(" + p.r + "," + p.g + "," + p.b + ")";
    }
    this.p = list; this.mode = "home"; this.settled = true; this.fade = 1;
  };
  LogoFX.prototype.isOpen = function () { return this.mode === "scattered" || this.mode === "faded"; };
  LogoFX.prototype.scatter = function (cx, cy) {
    if (!this.p.length) return;
    this.settled = false;
    if (reduce.matches) { this.mode = "faded"; this.start(); return; }
    if (cx == null) { cx = this.W / 2; cy = this.H / 2; }
    var k = this.k, str = this.o.strength || 1;
    for (var i = 0; i < this.p.length; i++) {
      var p = this.p[i], dx = p.x - cx, dy = p.y - cy, dist = Math.hypot(dx, dy) || 1;
      var ux = dx / dist, uy = dy / dist;
      var speed = (38 + Math.random() * 165) * str * (0.55 + Math.min(dist / (260 * k), 1) * 0.7) * k;
      var spread = (Math.random() - 0.5) * 0.62, cs = Math.cos(spread), sn = Math.sin(spread);
      var tangential = (Math.random() - 0.35) * 52 * k;
      p.vx = (ux * cs - uy * sn) * speed + (-uy) * tangential + (Math.random() - 0.5) * 24 * k;
      p.vy = (ux * sn + uy * cs) * speed + (ux) * tangential - (34 + Math.random() * 38) * k;
      p.delay = 0;
    }
    this.mode = "scattered"; this.start();
  };
  LogoFX.prototype.reassemble = function () {
    if (!this.p.length || this.mode === "home" || this.mode === "returning") return;
    this.settled = false;
    if (reduce.matches) { this.mode = "returning"; this.start(); return; }
    var k = this.k;
    for (var i = 0; i < this.p.length; i++) {
      var p = this.p[i], d = Math.hypot(p.x - p.hx, p.y - p.hy) / k;
      p.delay = Math.min(d / 900, 0.55) + (Math.sin(p.seed) * 0.5 + 0.5) * 0.16;
    }
    this.mode = "returning"; this.start();
  };
  LogoFX.prototype.toggle = function (cx, cy) { if (this.isOpen()) this.reassemble(); else this.scatter(cx, cy); };
  LogoFX.prototype.start = function () {
    if (this.running) return;
    this.running = true; this.last = 0;
    var self = this;
    requestAnimationFrame(function f(ts) { if (self.step(ts)) requestAnimationFrame(f); else self.running = false; });
  };
  LogoFX.prototype.step = function (ts) {
    if (!this.last) this.last = ts;
    var dt = Math.min((ts - this.last) / 1000, 0.033); this.last = ts;
    if (dt <= 0) return true;
    this.t += dt;
    var target = (this.mode === "home" && this.settled) ? 1 : 0, fs = dt / 0.18;
    this.fade = this.fade < target ? Math.min(target, this.fade + fs) : Math.max(target, this.fade - fs);

    if (reduce.matches) {                       // opacity crossfade only
      var aT = this.mode === "faded" ? 0.12 : 1;
      this.alpha += (aT - this.alpha) * Math.min(1, dt * 7);
      if (this.mode === "returning" && Math.abs(this.alpha - 1) < 0.01) { this.alpha = 1; this.mode = "home"; this.settled = true; }
      this.draw(false);
      return Math.abs(this.alpha - aT) > 0.005 || this.fade !== target || this.mode === "returning";
    }
    this.alpha = 1;
    var k = this.k, g = 110 * k, all = true;
    for (var i = 0; i < this.p.length; i++) {
      var p = this.p[i];
      if (this.mode === "scattered") {
        var sw = 22 * k, sp = 0.012 / k;
        p.vx += Math.cos(this.t * 0.9 + p.seed + p.y * sp) * sw * dt;
        p.vy += Math.sin(this.t * 0.8 + p.seed * 1.7 + p.x * sp) * sw * dt;
        p.vy += g * dt;
        var drag = Math.exp(-1.5 * dt); p.vx *= drag; p.vy *= drag;
        p.x += p.vx * dt; p.y += p.vy * dt; all = false;
      } else if (this.mode === "returning") {
        if (p.delay > 0) { p.delay -= dt; all = false; continue; }
        var kk = 90, c = 2 * Math.sqrt(kk);
        p.vx += ((p.hx - p.x) * kk - p.vx * c) * dt;
        p.vy += ((p.hy - p.y) * kk - p.vy * c) * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (Math.hypot(p.hx - p.x, p.hy - p.y) < 0.55 && Math.hypot(p.vx, p.vy) < 14 * k) { p.x = p.hx; p.y = p.hy; p.vx = p.vy = 0; }
        else all = false;
      }
    }
    if (this.mode === "returning" && all) { this.mode = "home"; this.settled = true; }
    this.draw(this.mode !== "home");
    if (this.mode === "scattered") return true;
    return !(this.mode === "home" && this.fade >= 1);
  };
  LogoFX.prototype.draw = function (glow) {
    var x = this.ctx; x.clearRect(0, 0, this.W, this.H);
    var reduced = reduce.matches;
    if (this.fade < 1 || reduced) {
      if (glow && !reduced) {
        x.save(); x.globalCompositeOperation = "lighter"; x.globalAlpha = 0.08;
        for (var i = 0; i < this.p.length; i++) {
          var p = this.p[i], gs = p.size * 4.5;
          x.drawImage(glowSprite(p.r, p.g, p.b), p.x - gs / 2, p.y - gs / 2, gs, gs);
        }
        x.restore();
      }
      if (!(reduced && this.fade >= 1)) {
        for (var j = 0; j < this.p.length; j++) {
          var q = this.p[j], tw = 1;
          if (this.mode === "scattered") tw = 0.95 + 0.05 * Math.sin(this.t * 2.2 + q.seed * 3.1);
          x.globalAlpha = Math.max(0, Math.min(1, q.a * this.alpha * tw));
          x.fillStyle = q.col;
          var s = q.size * (this.mode === "scattered" ? 0.92 : 1);
          x.fillRect(q.x - s / 2, q.y - s / 2, s, s);
        }
      }
    }
    if (this.fade > 0) {
      x.globalAlpha = Math.max(0, Math.min(1, this.fade));
      x.drawImage(this.img, this.home.x, this.home.y, this.home.w, this.home.h);
    }
    x.globalAlpha = 1;
  };

  function local(fx, e) { var r = fx.c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  /* Nav button: hover (mouse) scatters, leave melts; keyboard focus scatters, blur melts;
     touch tap = quick scatter then melt (navigation is delayed slightly by main.js). */
  LogoFX.bindButton = function (el, fx) {
    el.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") { var p = local(fx, e); fx.scatter(p[0], p[1]); } });
    el.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse" && document.activeElement !== el) fx.reassemble(); });
    el.addEventListener("focus", function () { if (el.matches(":focus-visible")) fx.scatter(); });
    el.addEventListener("blur", function () { fx.reassemble(); });
    el.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse") return;
      var p = local(fx, e); fx.scatter(p[0], p[1]);
      setTimeout(function () { fx.reassemble(); }, 700);
    });
  };
  /* Stage (hero logo), exactly like Mist: mouse hover scatters / leave melts; touch tap toggles
     (tap vs scroll: <10px and <500ms); keyboard Enter/Space toggles; focus-visible scatters. */
  LogoFX.bindStage = function (el, fx) {
    function sync() { el.setAttribute("aria-pressed", fx.isOpen() ? "true" : "false"); }
    el.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse" && !fx.isOpen()) { var p = local(fx, e); fx.scatter(p[0], p[1]); sync(); } });
    el.addEventListener("pointerleave", function (e) { if (e.pointerType && e.pointerType !== "mouse") return; if (fx.isOpen()) { fx.reassemble(); sync(); } });
    var down = null, t0 = 0;
    el.addEventListener("pointerdown", function (e) { down = { x: e.clientX, y: e.clientY }; t0 = performance.now(); });
    el.addEventListener("pointerup", function (e) {
      if (!down) return; var moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), ms = performance.now() - t0; down = null;
      if (moved > 10 || ms > 500 || e.pointerType === "mouse") return;
      var p = local(fx, e); fx.toggle(p[0], p[1]); sync();
    });
    el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fx.toggle(); sync(); } });
    el.addEventListener("blur", function () { if (fx.isOpen()) { fx.reassemble(); sync(); } });
  };

  LogoFX.loadLogo = function (srcs) {
    return srcs.reduce(function (pr, src) {
      return pr.then(function (img) {
        if (img) return img;
        return new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; });
      });
    }, Promise.resolve(null));
  };
  reduce.addEventListener && reduce.addEventListener("change", function () { /* instances re-read reduce.matches each frame */ });
  window.LogoFX = LogoFX;
})();
