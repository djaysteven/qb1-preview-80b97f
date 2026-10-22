/* v8: scroll-in reveals + timeline rail that fills as you scroll. Respects prefers-reduced-motion. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var items = document.querySelectorAll(".reveal");
  var tl = document.getElementById("timeline");
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("in"); });
    if (tl) tl.style.setProperty("--fill", 1);
    return;
  }
  document.documentElement.classList.add("rv");
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -12% 0px", threshold: 0.15 });
  items.forEach(function (el) { io.observe(el); });

  if (!tl) return;
  var ticking = false;
  function update() {
    ticking = false;
    var r = tl.getBoundingClientRect(), vh = window.innerHeight;
    var p = (vh * 0.62 - r.top) / r.height; // the fill follows a line ~60% down the screen
    p = Math.max(0, Math.min(1, p));
    tl.style.setProperty("--fill", p.toFixed(4));
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
})();
