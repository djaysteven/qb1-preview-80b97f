(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var mobileMQ = window.matchMedia("(orientation: portrait)"); // portrait = 720x1280 reel, landscape = 1080p reel

  /* ---------- background video (lazy, media-query source, reduced-motion = poster only) ---------- */
  var v = document.getElementById("heroVideo");
  var saveData = navigator.connection && navigator.connection.saveData;
  function loadVideo() {
    if (!v || reduce.matches || saveData) return;
    var m = mobileMQ.matches ? "mobile" : "desktop";
    if (v.dataset.loaded === m) return;
    v.dataset.loaded = m;
    v.innerHTML = "";
    [["webm", "video/webm"], ["mp4", "video/mp4"]].forEach(function (t) {
      var s = document.createElement("source"); s.src = v.dataset[m + t[0].charAt(0).toUpperCase() + t[0].slice(1)]; s.type = t[1]; v.appendChild(s);
    });
    v.load();
    var p = v.play(); if (p && p.catch) p.catch(function () {});
  }
  if (v) {
    v.addEventListener("playing", function () { v.classList.add("is-playing"); });
    if (document.readyState === "complete") loadVideo(); else window.addEventListener("load", loadVideo);
    mobileMQ.addEventListener && mobileMQ.addEventListener("change", loadVideo);
    reduce.addEventListener && reduce.addEventListener("change", function () {
      if (reduce.matches) { v.pause(); v.classList.remove("is-playing"); } else { v.dataset.loaded = ""; loadVideo(); }
    });
    document.addEventListener("visibilitychange", function () {
      if (!v.dataset.loaded || reduce.matches) return;
      if (document.hidden) v.pause(); else { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    });
  }

  /* ---------- logo particle buttons ---------- */
  var LOGO_SOURCES = ["assets/logo.svg", "assets/logo-placeholder.svg"]; // swap the logo by replacing assets/logo.svg
  var fxs = [];
  if (window.LogoFX) {
    window.LogoFX.loadLogo(LOGO_SOURCES).then(function (img) {
      if (!img) return;
      document.querySelectorAll(".fx-btn").forEach(function (btn) {
        var fx = new window.LogoFX(btn.querySelector("canvas.fx"), img, { bleedFX: 0.12 / 1.24, bleedFY: 0.45 / 1.9 });
        window.LogoFX.bindButton(btn, fx); fxs.push(fx);
      });
      var hero = document.getElementById("heroLogo");
      if (hero) {
        var hfx = new window.LogoFX(hero.querySelector("canvas.hero-fx"), img, { bleedFX: 0.14 / 1.28, bleedFY: 0.40 / 1.80 });
        window.LogoFX.bindStage(hero, hfx); fxs.push(hfx);
        hero.classList.add("fx-ready");
        window.QB1_heroFX = hfx;
      }
    });
    var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { fxs.forEach(function (f) { f.resize(); }); }, 150); });
  }
  // On touch, let the scatter play briefly before scrolling to the section.
  document.querySelectorAll(".fx-btn").forEach(function (btn) {
    var touch = false;
    btn.addEventListener("pointerdown", function (e) { touch = e.pointerType !== "mouse"; });
    btn.addEventListener("click", function (e) {
      var id = btn.getAttribute("href"); var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var go = function () { target.scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth" }); history.replaceState(null, "", id); target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: true }); };
      if (touch && !reduce.matches) setTimeout(go, 380); else go();
      touch = false;
    });
  });

  /* ---------- YouTube gallery (facade: no iframe until click) ---------- */
  var grid = document.getElementById("videoGrid");
  var vids = window.QB1_VIDEOS || [];
  function fmtDate(d) { try { return new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return d; } }
  if (grid) vids.forEach(function (x) {
    var li = document.createElement("li");
    var b = document.createElement("button");
    b.type = "button"; b.className = "vcard"; b.dataset.id = x.id; b.dataset.title = x.title;
    b.setAttribute("aria-label", "Play video: " + x.title + " (" + fmtDate(x.date) + ")");
    b.innerHTML = '<span class="vthumb"><img loading="lazy" decoding="async" width="480" height="360" alt="" src="https://i.ytimg.com/vi/' + x.id + '/hqdefault.jpg"><span class="vplay" aria-hidden="true"></span>' +
      (x.tag ? '<span class="vtag" aria-hidden="true"></span>' : "") + '</span><span class="vmeta"><span class="vtitle"></span><span class="vdate"></span></span>';
    b.querySelector(".vtitle").textContent = x.title;
    b.querySelector(".vdate").textContent = fmtDate(x.date);
    if (x.tag) b.querySelector(".vtag").textContent = x.tag;
    li.appendChild(b); grid.appendChild(li);
  });

  var modal = document.getElementById("videoModal");
  var frame = document.getElementById("modalFrame");
  var titleEl = document.getElementById("modalTitle");
  var lastFocus = null;
  function focusables() { return Array.prototype.filter.call(modal.querySelectorAll('button, [href], iframe, [tabindex]:not([tabindex="-1"])'), function (el) { return !el.hasAttribute("disabled"); }); }
  function openVideo(id, title) {
    lastFocus = document.activeElement;
    titleEl.textContent = title;
    var f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) + "?autoplay=1&playsinline=1&rel=0&modestbranding=1";
    f.title = title; f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen"; f.allowFullscreen = true;
    f.referrerPolicy = "strict-origin-when-cross-origin";
    frame.innerHTML = ""; frame.appendChild(f);
    modal.hidden = false; document.body.classList.add("scroll-lock");
    if (v && !v.paused) { v.pause(); v.dataset.resume = "1"; }
    modal.querySelector(".modal-close").focus();
  }
  function closeVideo() {
    if (modal.hidden) return;
    frame.innerHTML = "";                 // removing the iframe stops playback
    modal.hidden = true; document.body.classList.remove("scroll-lock");
    if (v && v.dataset.resume) { delete v.dataset.resume; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  if (grid) grid.addEventListener("click", function (e) { var b = e.target.closest(".vcard"); if (b) openVideo(b.dataset.id, b.dataset.title); });
  if (modal) {
    modal.addEventListener("click", function (e) { if (e.target.closest("[data-close]")) closeVideo(); });
    document.addEventListener("keydown", function (e) {
      if (modal.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); closeVideo(); return; }
      if (e.key === "Tab") {             // focus trap
        var f = focusables(); if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }
  // Focus guard: if focus escapes the open dialog (e.g. tabbing out of the YouTube iframe), pull it back.
  document.addEventListener("focusin", function (e) {
    if (modal && !modal.hidden && !modal.contains(e.target)) modal.querySelector(".modal-close").focus();
  });
  window.QB1 = { openVideo: openVideo, closeVideo: closeVideo };
})();
