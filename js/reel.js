/* Intro reel: lazy-load on approach, autoplay muted while in view, text-only Play / Sound controls. */
(function () {
  "use strict";
  var v = document.getElementById("reelVideo"), play = document.getElementById("reelPlay"), snd = document.getElementById("reelSound");
  if (!v) return;
  var small = window.matchMedia("(max-width: 820px)").matches;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var userPaused = false, loaded = false;
  function load() {
    if (loaded) return; loaded = true;
    v.src = small ? v.dataset.mobile : v.dataset.desktop; v.preload = "auto"; v.load();
  }
  function ui() {
    var on = !v.paused;
    play.textContent = on ? "Pause" : "Play"; play.setAttribute("aria-pressed", on ? "true" : "false");
    snd.textContent = v.muted ? "Sound on" : "Sound off"; snd.setAttribute("aria-pressed", v.muted ? "false" : "true");
  }
  function start() { load(); var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  play.addEventListener("click", function () { if (v.paused) { userPaused = false; start(); } else { userPaused = true; v.pause(); } });
  snd.addEventListener("click", function () { v.muted = !v.muted; if (!v.muted) { userPaused = false; start(); } ui(); });
  ["play", "pause", "volumechange"].forEach(function (e) { v.addEventListener(e, ui); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && e.intersectionRatio >= 0.5) { if (!userPaused && !reduce) start(); }
        else if (!v.paused) v.pause();
      });
    }, { threshold: [0, 0.5] }).observe(v);
    new IntersectionObserver(function (es, o) { if (es[0].isIntersecting) { load(); o.disconnect(); } }, { rootMargin: "600px 0px" }).observe(v);
  }
  document.addEventListener("visibilitychange", function () { if (document.hidden && !v.paused) v.pause(); });
  ui();
})();
