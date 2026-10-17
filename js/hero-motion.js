(function () {
  "use strict";

  var hero = document.querySelector(".hero");
  var art = hero && hero.querySelector(".hero__art");
  if (!hero || !art) return;

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  var frame = 0;
  var bounds = null;
  var pendingPosition = null;
  var layers = [
    { element: art, x: "--hero-swan-x", y: "--hero-swan-y", strength: 10 },
    { element: art, x: "--hero-ring-x", y: "--hero-ring-y", strength: 4 },
    { element: art, x: "--hero-inner-ring-x", y: "--hero-inner-ring-y", strength: 7 },
    { element: hero, x: "--hero-copy-x", y: "--hero-copy-y", strength: 2 }
  ];

  function clearParallax() {
    if (frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
    pendingPosition = null;
    bounds = null;
    layers.forEach(function (layer) {
      layer.element.style.removeProperty(layer.x);
      layer.element.style.removeProperty(layer.y);
    });
    art.removeAttribute("data-parallax");
    hero.removeAttribute("data-parallax");
  }

  function isEnabled() {
    return finePointer.matches && !reducedMotion.matches;
  }

  function scheduleFrame() {
    if (!frame) frame = window.requestAnimationFrame(renderPosition);
  }

  function renderPosition() {
    frame = 0;
    if (!isEnabled() || !pendingPosition || !bounds) return;

    var x = (pendingPosition.x - bounds.left) / bounds.width * 2 - 1;
    var y = (pendingPosition.y - bounds.top) / bounds.height * 2 - 1;
    x = Math.max(-1, Math.min(1, x));
    y = Math.max(-1, Math.min(1, y));

    layers.forEach(function (layer) {
      layer.element.style.setProperty(layer.x, (-x * layer.strength).toFixed(1) + "px");
      layer.element.style.setProperty(layer.y, (-y * layer.strength).toFixed(1) + "px");
    });
  }

  function onPointerEnter(event) {
    if (!isEnabled() || event.pointerType === "touch") return;
    bounds = hero.getBoundingClientRect();
    art.setAttribute("data-parallax", "");
    hero.setAttribute("data-parallax", "");
    onPointerMove(event);
  }

  function onPointerMove(event) {
    if (!isEnabled() || event.pointerType === "touch") return;
    if (!bounds) bounds = hero.getBoundingClientRect();
    pendingPosition = { x: event.clientX, y: event.clientY };
    scheduleFrame();
  }

  function onPointerLeave() {
    pendingPosition = null;
    layers.forEach(function (layer) {
      layer.element.style.setProperty(layer.x, "0px");
      layer.element.style.setProperty(layer.y, "0px");
    });
    bounds = null;
  }

  function onVisibilityChange() {
    if (document.hidden) onPointerLeave();
  }

  function updateAvailability() {
    if (isEnabled()) {
      hero.addEventListener("pointerenter", onPointerEnter);
      hero.addEventListener("pointermove", onPointerMove);
      hero.addEventListener("pointerleave", onPointerLeave);
      window.addEventListener("resize", onPointerLeave, { passive: true });
      document.addEventListener("visibilitychange", onVisibilityChange);
    } else {
      hero.removeEventListener("pointerenter", onPointerEnter);
      hero.removeEventListener("pointermove", onPointerMove);
      hero.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearParallax();
    }
  }

  reducedMotion.addEventListener("change", updateAvailability);
  finePointer.addEventListener("change", updateAvailability);
  updateAvailability();
}());
