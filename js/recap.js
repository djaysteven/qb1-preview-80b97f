/* 02 · Results — 2026 season recap. Final values are in the HTML (no-JS / reduced motion show them as-is);
   with motion allowed, the 15 motos flip in race order on scroll-in while the ring and counters climb. */
(function () {
  "use strict";
  var sec = document.getElementById("results"); if (!sec) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var motos = [].slice.call(sec.querySelectorAll(".moto"));
  var segs = [].slice.call(sec.querySelectorAll(".ring .seg"));
  var cnts = [].slice.call(sec.querySelectorAll(".cnt"));
  var status = document.getElementById("recapStatus");
  var replay = document.getElementById("recapReplay");
  var EU = 9, timer = null, raf = null, endT = null;

  function setCounts(k) { // k = motos revealed so far
    var eu = Math.min(k, EU) * 25, wc = Math.max(0, k - EU) * 25;
    cnts.forEach(function (c) {
      var to = +c.dataset.to;
      c.textContent = to === 15 ? k : to === 375 ? eu + wc : to === 225 ? eu : wc;
    });
  }
  // Ring + counters (top block): climb 0 to 15 / 375 when it scrolls in.
  function finalState() {
    clearTimeout(timer); clearTimeout(endT);
    segs.forEach(function (s) { s.classList.add("on"); s.classList.remove("hot"); });
    cnts.forEach(function (c) { c.textContent = c.dataset.to; });
  }
  function reset() {
    clearTimeout(timer); clearTimeout(endT);
    segs.forEach(function (s) { s.classList.remove("on", "hot"); });
    setCounts(0);
  }
  function play() {
    if (reduce.matches) { finalState(); return; }
    reset();
    var k = 0;
    (function step() {
      var s = segs[k];
      if (s) { s.classList.add("on", "hot"); setTimeout(function () { s.classList.remove("hot"); }, 450); }
      k++; setCounts(k);
      if (k < segs.length) timer = setTimeout(step, k === EU ? 420 : 150); // short beat between Europe and the Worlds
      else { endT = setTimeout(finalState, 500); if (status) status.textContent = "15 of 15 motos won · 375 points: 225 European, 150 World."; }
    })();
  }
  // Race cards: each one flips its 3 motos in order when it scrolls in, and resets once fully off screen.
  var rounds = [].slice.call(sec.querySelectorAll(".round"));
  function fillRound(r) {
    clearTimeout(r._t); var ms = [].slice.call(r.querySelectorAll(".moto")), i = 0;
    ms.forEach(function (m) { m.classList.remove("on"); });
    (function nx() { if (i < ms.length) { ms[i++].classList.add("on"); r._t = setTimeout(nx, 180); } })();
  }
  function emptyRound(r) { clearTimeout(r._t); r.querySelectorAll(".moto").forEach(function (m) { m.classList.remove("on", "pop"); m.setAttribute("aria-pressed", "false"); }); }
  function allOn() { motos.forEach(function (m) { m.classList.add("on"); }); }

  // Tap / click / Enter / Space on a moto: details in one polite live line.
  sec.addEventListener("click", function (e) {
    var m = e.target.closest(".moto"); if (!m) return;
    motos.forEach(function (x) { if (x !== m) x.setAttribute("aria-pressed", "false"); });
    var on = m.getAttribute("aria-pressed") !== "true";
    m.setAttribute("aria-pressed", on ? "true" : "false");
    if (status) status.textContent = on ? m.dataset.info : "Tap any moto for details.";
    if (!reduce.matches) { m.classList.remove("pop"); void m.offsetWidth; m.classList.add("pop"); }
  });
  motos.forEach(function (m) { m.setAttribute("aria-pressed", "false"); });

  if (replay) { replay.hidden = false; replay.addEventListener("click", function () { play(); rounds.forEach(fillRound); }); }

  if (reduce.matches || !("IntersectionObserver" in window)) { finalState(); allOn(); return; }
  sec.classList.add("armed"); reset(); rounds.forEach(emptyRound);
  var opts = { threshold: 0, rootMargin: "0px 0px -12% 0px" };
  var shown = false;
  new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      if (en.isIntersecting && !shown) { shown = true; play(); }
      else if (!en.isIntersecting && shown) { shown = false; reset(); }
    });
  }, opts).observe(document.getElementById("recap"));
  var rio = new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      var r = en.target;
      if (en.isIntersecting && !r._shown) { r._shown = true; fillRound(r); }
      else if (!en.isIntersecting && r._shown) { r._shown = false; emptyRound(r); }
    });
  }, opts);
  rounds.forEach(function (r) { rio.observe(r); });
  reduce.addEventListener && reduce.addEventListener("change", function () { if (reduce.matches) { sec.classList.remove("armed"); finalState(); allOn(); } });
})();
