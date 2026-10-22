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
  function finalState() {
    clearTimeout(timer); cancelAnimationFrame(raf);
    sec.classList.remove("armed");
    motos.forEach(function (m) { m.classList.add("on"); });
    segs.forEach(function (s) { s.classList.add("on"); s.classList.remove("hot"); });
    cnts.forEach(function (c) { c.textContent = c.dataset.to; });
  }
  function reset() {
    clearTimeout(timer); clearTimeout(endT);
    motos.forEach(function (m) { m.classList.remove("on", "pop"); m.setAttribute("aria-pressed", "false"); });
    segs.forEach(function (s) { s.classList.remove("on", "hot"); });
    setCounts(0); sec.classList.add("armed");
  }
  function play() {
    if (reduce.matches) { finalState(); return; }
    reset();
    var k = 0;
    (function step() {
      var m = motos[k], s = segs[k];
      m.classList.add("on");
      if (s) { s.classList.add("on", "hot"); setTimeout(function () { s.classList.remove("hot"); }, 450); }
      k++; setCounts(k);
      if (k < motos.length) timer = setTimeout(step, k === EU ? 420 : 150); // short beat between Europe and the Worlds
      else { endT = setTimeout(finalState, 500); if (status) status.textContent = "15 of 15 motos won · 375 points: 225 European, 150 World."; }
    })();
  }

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

  if (replay) { replay.hidden = false; replay.addEventListener("click", play); }

  if (reduce.matches || !("IntersectionObserver" in window)) { finalState(); return; }
  reset();
  // Replays every time the recap scrolls back into view; re-arms once it's fully off screen.
  var shown = false;
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      if (en.isIntersecting && !shown) { shown = true; play(); }
      else if (!en.isIntersecting && shown) { shown = false; if (!reduce.matches) reset(); }
    });
  }, { threshold: 0.2 });
  io.observe(document.getElementById("recap"));
  reduce.addEventListener && reduce.addEventListener("change", function () { if (reduce.matches) finalState(); });
})();
