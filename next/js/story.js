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

/* v9: photo strip lightbox (Esc / arrows / swipe) */
(function () {
  "use strict";
  var lb = document.getElementById("lightbox"); if (!lb) return;
  var btns = [].slice.call(document.querySelectorAll("#photoStrip .ph"));
  var img = document.getElementById("lbImg"), src = document.getElementById("lbSrc"), cap = document.getElementById("lbCap");
  var i = 0, last = null, x0 = null;
  function show(n) {
    i = (n + btns.length) % btns.length; var b = btns[i], base = b.getAttribute("data-full");
    var alt = b.querySelector("img").alt;
    src.srcset = base + ".webp"; img.src = base + ".jpg"; img.alt = alt;
    cap.textContent = alt + (b.getAttribute("data-credit") ? " · " + b.getAttribute("data-credit") : "");
  }
  function open(n) { last = document.activeElement; show(n); lb.hidden = false; document.body.style.overflow = "hidden"; lb.querySelector(".lb-close").focus(); }
  function close() { lb.hidden = true; document.body.style.overflow = ""; if (last) last.focus(); }
  btns.forEach(function (b, n) { b.addEventListener("click", function () { open(n); }); });
  lb.addEventListener("click", function (e) {
    var a = e.target.closest("[data-lb]");
    if (a) { var k = a.getAttribute("data-lb"); if (k === "close") close(); else show(i + (k === "next" ? 1 : -1)); }
    else if (e.target === lb) close();
  });
  document.addEventListener("keydown", function (e) {
    if (lb.hidden) return;
    if (e.key === "Escape") close(); else if (e.key === "ArrowRight") show(i + 1); else if (e.key === "ArrowLeft") show(i - 1);
  });
  lb.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", function (e) {
    if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1));
  });
})();
