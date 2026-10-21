/* QB1 logo particle hover: disintegrate + melt back.
   Technique adapted (rewritten) from the Mist Club prototype: the logo IMAGE is sampled
   pixel by pixel; particles keep the sampled colours; on activate they scatter with
   curl-like drift + gravity, on release they return on a critically damped spring
   (staggered so it "melts" home), then crossfade back to the crisp image.
   One instance per <canvas>; each only animates while it is not settled. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var coarse = window.matchMedia("(pointer: coarse)");

  function LogoFX(canvas, img, opts) {
    this.c = canvas; this.ctx = canvas.getContext("2d");
    this.img = img; this.o = opts || {};
    this.cap = this.o.cap || (coarse.matches ? 700 : 1400);
    this.p = []; this.mode = "home"; this.fade = 1; this.alpha = 1;
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
    var iw = this.img.naturalWidth || 600, ih = this.img.naturalHeight || 200;
    var pad = this.o.pad != null ? this.o.pad : 0.08;
    var aw = this.W * (1 - 2 * pad), ah = this.H * (1 - 2 * pad);
    var s = Math.min(aw / iw, ah / ih);
    var w = Math.max(2, Math.round(iw * s)), h = Math.max(2, Math.round(ih * s));
    this.home = { x: (this.W - w) / 2, y: (this.H - h) / 2, w: w, h: h };
    // sample at 2x display size for density, then decimate to the cap
    var sw = w * 2, sh = h * 2;
    var off = document.createElement("canvas"); off.width = sw; off.height = sh;
    var o = off.getContext("2d", { willReadFrequently: true });
    o.drawImage(this.img, 0, 0, sw, sh);
    var d; try { d = o.getImageData(0, 0, sw, sh).data; } catch (e) { this.p = []; return; }
    var opaque = 0, i; for (i = 3; i < d.length; i += 4) if (d[i] > 140) opaque++;
    var step = Math.max(1, Math.ceil(Math.sqrt(opaque / this.cap)));
    var list = [];
    for (var y = 0; y < sh; y += step) for (var x = 0; x < sw; x += step) {
      var k = (y * sw + x) * 4;
      if (d[k + 3] > 140) {
        var hx = this.home.x + x / 2, hy = this.home.y + y / 2;
        list.push({ hx: hx, hy: hy, x: hx, y: hy, vx: 0, vy: 0, delay: 0,
          col: "rgb(" + d[k] + "," + d[k + 1] + "," + d[k + 2] + ")",
          seed: Math.random() * 6.283, size: Math.max(1.2, step * 0.55) * (0.85 + Math.random() * 0.4) });
      }
    }
    this.p = list; this.mode = "home"; this.fade = 1;
  };
  LogoFX.prototype.scatter = function (cx, cy) {
    if (!this.p.length) return;
    if (cx == null) { cx = this.W / 2; cy = this.H / 2; }
    this.mode = "scattered";
    if (!reduce.matches) {
      var str = this.o.strength || 1;
      for (var i = 0; i < this.p.length; i++) {
        var q = this.p[i], dx = q.x - cx, dy = q.y - cy, dist = Math.hypot(dx, dy) || 1;
        var ux = dx / dist, uy = dy / dist;
        var sp = (30 + Math.random() * 120) * str * (0.5 + Math.min(dist / 120, 1) * 0.7);
        var tan = (Math.random() - 0.35) * 40;
        q.vx = ux * sp - uy * tan + (Math.random() - 0.5) * 20;
        q.vy = uy * sp + ux * tan - 26 - Math.random() * 30; // lift like spray, gravity then wins
      }
    }
    this.start();
  };
  LogoFX.prototype.reassemble = function () {
    if (!this.p.length || this.mode === "home") return;
    this.mode = "returning";
    for (var i = 0; i < this.p.length; i++) {
      var q = this.p[i], d = Math.hypot(q.x - q.hx, q.y - q.hy);
      q.delay = Math.min(d / 700, 0.4) + (Math.sin(q.seed) * 0.5 + 0.5) * 0.12;
    }
    this.start();
  };
  LogoFX.prototype.start = function () {
    if (this.running) return;
    this.running = true; this.last = 0;
    var self = this;
    requestAnimationFrame(function f(ts) { if (self.step(ts)) requestAnimationFrame(f); else self.running = false; });
  };
  LogoFX.prototype.step = function (ts) {
    if (!this.last) this.last = ts;
    var dt = Math.min((ts - this.last) / 1000, 0.033); this.last = ts; this.t += dt;
    var target = this.mode === "home" ? 1 : 0;
    this.fade += Math.sign(target - this.fade) * Math.min(Math.abs(target - this.fade), dt / 0.18);
    if (reduce.matches) {                       // reduced motion: opacity only
      var a = this.mode === "scattered" ? 0.15 : 1;
      this.alpha += (a - this.alpha) * Math.min(1, dt * 8);
      if (this.mode === "returning" && Math.abs(this.alpha - 1) < 0.01) { this.mode = "home"; this.alpha = 1; }
      this.draw();
      return Math.abs(this.alpha - a) > 0.01 || this.fade !== target;
    }
    this.alpha = 1;
    var all = true, g = this.o.gravity != null ? this.o.gravity : 120;
    for (var i = 0; i < this.p.length; i++) {
      var q = this.p[i];
      if (this.mode === "scattered") {
        q.vx += Math.cos(this.t * 0.9 + q.seed + q.y * 0.03) * 22 * dt;
        q.vy += Math.sin(this.t * 0.8 + q.seed * 1.7 + q.x * 0.03) * 22 * dt + g * dt;
        var drag = Math.exp(-1.6 * dt); q.vx *= drag; q.vy *= drag;
        q.x += q.vx * dt; q.y += q.vy * dt; all = false;
      } else if (this.mode === "returning") {
        if (q.delay > 0) { q.delay -= dt; all = false; continue; }
        var k = 140, c = 2 * Math.sqrt(k);      // critically damped: no overshoot
        q.vx += ((q.hx - q.x) * k - q.vx * c) * dt; q.vy += ((q.hy - q.y) * k - q.vy * c) * dt;
        q.x += q.vx * dt; q.y += q.vy * dt;
        if (Math.hypot(q.hx - q.x, q.hy - q.y) < 0.5 && Math.hypot(q.vx, q.vy) < 10) { q.x = q.hx; q.y = q.hy; q.vx = q.vy = 0; }
        else all = false;
      }
    }
    if (this.mode === "returning" && all) this.mode = "home";
    this.draw();
    // keep animating while scattered (drift) for up to ~2.5 s, or until settled + faded in
    if (this.mode === "scattered") return true;
    return !(this.mode === "home" && this.fade >= 1);
  };
  LogoFX.prototype.draw = function () {
    var x = this.ctx; x.clearRect(0, 0, this.W, this.H);
    if (this.fade < 1 || reduce.matches) {
      x.globalAlpha = this.alpha * (reduce.matches ? 1 : 1);
      for (var i = 0; i < this.p.length; i++) {
        var q = this.p[i]; x.fillStyle = q.col; x.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
      }
    }
    if (this.fade > 0 && !(reduce.matches && this.mode !== "home")) {
      x.globalAlpha = Math.max(0, Math.min(1, this.fade)) * this.alpha;
      x.drawImage(this.img, this.home.x, this.home.y, this.home.w, this.home.h);
    }
    x.globalAlpha = 1;
  };

  /* Bind to a focusable element: mouse hover, keyboard focus, touch tap. */
  LogoFX.bind = function (el, fx) {
    function local(e) { var r = fx.c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    el.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") { var p = local(e); fx.scatter(p[0], p[1]); } });
    el.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse" && document.activeElement !== el) fx.reassemble(); });
    el.addEventListener("focus", function () { if (el.matches(":focus-visible")) fx.scatter(); });
    el.addEventListener("blur", function () { fx.reassemble(); });
    el.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse") return;
      var p = local(e); fx.scatter(p[0], p[1]);
      setTimeout(function () { fx.reassemble(); }, 650);
    });
  };

  /* Load the logo once (assets/logo.svg, falling back to the text placeholder). */
  LogoFX.loadLogo = function (srcs) {
    return srcs.reduce(function (pr, src) {
      return pr.then(function (img) {
        if (img) return img;
        return new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; });
      });
    }, Promise.resolve(null));
  };
  window.LogoFX = LogoFX;
})();
