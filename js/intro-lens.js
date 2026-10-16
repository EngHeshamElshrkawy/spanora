(function () {
  "use strict";

  var stage = document.querySelector("[data-lens-stage]");
  var spanish = document.querySelector("[data-intro-es]");
  var english = document.querySelector("[data-intro-en]");
  var lens = document.querySelector(".lens");
  var hint = document.querySelector("[data-lens-hint]");
  var doneMessage = document.querySelector("[data-intro-done]");
  var revealButton = document.querySelector("[data-reveal-all]");
  var replayButton = document.querySelector("[data-replay]");
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var supportsMask = window.CSS && (
    CSS.supports("mask-image", "url(x)") ||
    CSS.supports("-webkit-mask-image", "url(x)")
  );

  if (!supportsMask || !stage || !window.HTMLCanvasElement.prototype.toBlob) {
    stage.classList.add("is-fallback");
    english.setAttribute("aria-hidden", "false");
    hint.hidden = true;
    return;
  }

  var canvas = document.createElement("canvas");
  var context = canvas.getContext("2d", { willReadFrequently: true });
  var scale = 0.5;
  var lastPoint = null;
  var samplePoints = [];
  var updateQueued = false;
  var lastMaskUpdate = 0;
  var maskUrl = null;
  var spanishMaskUrl = null;
  var inverseCanvas = document.createElement("canvas");
  var inverseContext = inverseCanvas.getContext("2d", { willReadFrequently: true });
  var generation = 0;
  var completed = false;
  var threshold = window.SPANORA.config.revealThreshold;
  var diameter = 200;
  var frameTimer = 0;
  var throttleTimer = 0;
  var hintAnimationId = 0;
  var hintTimer = 0;

  if (!context) {
    stage.classList.add("is-fallback");
    english.setAttribute("aria-hidden", "false");
    hint.hidden = true;
    return;
  }

  if (window.SPANORA.config.lensStyle === "torch") lens.classList.add("lens--torch");
  stage.classList.add("is-ready");

  function getDiameter() {
    return window.matchMedia("(max-width: 700px)").matches ? 150 : diameter;
  }

  function buildSamples() {
    var bounds = stage.getBoundingClientRect();
    var points = [];
    Array.prototype.forEach.call(english.querySelectorAll("p"), function (paragraph) {
      var range = document.createRange();
      range.selectNodeContents(paragraph);
      Array.prototype.forEach.call(range.getClientRects(), function (rect) {
        var left = Math.max(0, rect.left - bounds.left);
        var right = Math.min(bounds.width, rect.right - bounds.left);
        var top = Math.max(0, rect.top - bounds.top);
        var bottom = Math.min(bounds.height, rect.bottom - bounds.top);
        for (var y = top + 8; y < bottom; y += 16) {
          for (var x = left + 8; x < right; x += 16) points.push({ x: x, y: y });
        }
        if (!points.length || (right > left && bottom > top)) {
          points.push({ x: (left + right) / 2, y: (top + bottom) / 2 });
        }
      });
    });
    samplePoints = points;
  }

  function updateMaskUrl() {
    var now = performance.now();
    if (updateQueued) return;
    updateQueued = true;
    throttleTimer = window.setTimeout(function () {
      frameTimer = window.requestAnimationFrame(function () {
        updateQueued = false;
        lastMaskUpdate = performance.now();
        var currentGeneration = ++generation;
        var pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        var inversePixels = inverseContext.createImageData(canvas.width, canvas.height);
        for (var index = 0; index < pixels.data.length; index += 4) {
          var inverseAlpha = 255 - pixels.data[index + 3];
          inversePixels.data[index] = 255;
          inversePixels.data[index + 1] = 255;
          inversePixels.data[index + 2] = 255;
          inversePixels.data[index + 3] = inverseAlpha;
        }
        inverseContext.putImageData(inversePixels, 0, 0);

        Promise.all([
          new Promise(function (resolve) { canvas.toBlob(resolve, "image/png"); }),
          new Promise(function (resolve) { inverseCanvas.toBlob(resolve, "image/png"); })
        ]).then(function (blobs) {
          if (!blobs[0] || !blobs[1] || currentGeneration !== generation || completed) return;
          var nextUrl = URL.createObjectURL(blobs[0]);
          var nextSpanishUrl = URL.createObjectURL(blobs[1]);
          english.style.maskImage = "url('" + nextUrl + "')";
          english.style.webkitMaskImage = "url('" + nextUrl + "')";
          spanish.style.maskImage = "url('" + nextSpanishUrl + "')";
          spanish.style.webkitMaskImage = "url('" + nextSpanishUrl + "')";
          [english, spanish].forEach(function (layer) {
            layer.style.maskSize = "100% 100%";
            layer.style.webkitMaskSize = "100% 100%";
            layer.style.maskRepeat = "no-repeat";
            layer.style.webkitMaskRepeat = "no-repeat";
            layer.style.maskMode = "alpha";
          });
          if (!completed) english.style.opacity = "";
          if (maskUrl) URL.revokeObjectURL(maskUrl);
          if (spanishMaskUrl) URL.revokeObjectURL(spanishMaskUrl);
          maskUrl = nextUrl;
          spanishMaskUrl = nextSpanishUrl;
          checkCoverage();
        });
      });
    }, Math.max(0, 33 - (now - lastMaskUpdate)));
  }

  function resizeCanvas(preserve) {
    var previous = null;
    if (preserve && canvas.width && canvas.height) {
      previous = document.createElement("canvas");
      previous.width = canvas.width;
      previous.height = canvas.height;
      previous.getContext("2d").drawImage(canvas, 0, 0);
    }
    stage.style.minHeight = Math.ceil(Math.max(spanish.scrollHeight, english.scrollHeight)) + "px";
    var bounds = stage.getBoundingClientRect();
    var width = Math.max(1, Math.ceil(bounds.width * scale));
    var height = Math.max(1, Math.ceil(bounds.height * scale));
    canvas.width = width;
    canvas.height = height;
    inverseCanvas.width = width;
    inverseCanvas.height = height;
    context = canvas.getContext("2d", { willReadFrequently: true });
    inverseContext = inverseCanvas.getContext("2d", { willReadFrequently: true });
    context.setTransform(scale, 0, 0, scale, 0, 0);
    if (previous) context.drawImage(previous, 0, 0, previous.width, previous.height, 0, 0, bounds.width, bounds.height);
    buildSamples();
    updateMaskUrl();
  }

  function paintAt(point) {
    if (completed) return;
    var radius = getDiameter() / 2 - 12;
    var gradient = context.createRadialGradient(point.x, point.y, radius * 0.66, point.x, point.y, radius + 14);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(.82, "rgba(255,255,255,.95)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.globalCompositeOperation = "source-over";
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(point.x, point.y, radius + 14, 0, Math.PI * 2);
    context.fill();
    updateMaskUrl();
  }

  function paintSegment(from, to) {
    var distance = Math.hypot(to.x - from.x, to.y - from.y);
    var steps = Math.max(1, Math.ceil(distance / Math.max(6, getDiameter() / 10)));
    for (var index = 1; index <= steps; index += 1) {
      var ratio = index / steps;
      paintAt({ x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio });
    }
  }

  function checkCoverage() {
    if (completed || !samplePoints.length) return;
    var pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    var revealed = 0;
    for (var index = 0; index < samplePoints.length; index += 1) {
      var point = samplePoints[index];
      var x = Math.min(canvas.width - 1, Math.max(0, Math.floor(point.x * scale)));
      var y = Math.min(canvas.height - 1, Math.max(0, Math.floor(point.y * scale)));
      if (pixels[(y * canvas.width + x) * 4 + 3] > 128) revealed += 1;
    }
    if (revealed / samplePoints.length >= threshold) complete();
  }

  function complete() {
    if (completed) return;
    completed = true;
    stage.classList.add("is-complete");
    stage.classList.remove("is-ready");
    english.style.maskImage = "none";
    english.style.webkitMaskImage = "none";
    spanish.style.maskImage = "none";
    spanish.style.webkitMaskImage = "none";
    english.setAttribute("aria-hidden", "false");
    english.classList.add("is-fading");
    english.style.opacity = "1";
    if (!reducedMotion.matches) {
      spanish.style.transition = "opacity .6s ease";
      spanish.style.opacity = "0";
    } else {
      spanish.style.display = "none";
    }
    doneMessage.hidden = false;
    revealButton.hidden = true;
    replayButton.hidden = false;
    hint.hidden = true;
  }

  function pointFromEvent(event) {
    var bounds = stage.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  function handlePointer(event) {
    if (completed || !stage.classList.contains("is-ready")) return;
    if (hintAnimationId) {
      window.cancelAnimationFrame(hintAnimationId);
      window.clearTimeout(hintTimer);
      hintAnimationId = 0;
      lens.style.opacity = "";
    }
    var point = pointFromEvent(event);
    if (event.pointerType === "touch") {
      lens.style.transform = "translate3d(" + event.clientX + "px," + (event.clientY - 60) + "px,0) translate(-50%,-50%)";
    } else {
      lens.style.transform = "translate3d(" + event.clientX + "px," + event.clientY + "px,0) translate(-50%,-50%)";
    }
    if (lastPoint) paintSegment(lastPoint, point);
    else paintAt(point);
    lastPoint = point;
    hint.hidden = true;
  }

  function revealAll() {
    if (!completed) complete();
  }

  function replay() {
    completed = false;
    stage.classList.remove("is-complete");
    spanish.style.opacity = "";
    spanish.style.display = "";
    spanish.style.transition = "";
    english.style.maskImage = "none";
    english.style.webkitMaskImage = "none";
    spanish.style.maskImage = "none";
    spanish.style.webkitMaskImage = "none";
    english.style.opacity = "0";
    english.classList.remove("is-fading");
    english.setAttribute("aria-hidden", "true");
    doneMessage.hidden = true;
    replayButton.hidden = true;
    revealButton.hidden = false;
    context.clearRect(0, 0, canvas.width / scale, canvas.height / scale);
    lastPoint = null;
    stage.classList.add("is-ready");
    updateMaskUrl();
    stage.focus({ preventScroll: true });
  }

  stage.addEventListener("pointerenter", function (event) {
    lastPoint = null;
    handlePointer(event);
  });
  stage.addEventListener("pointermove", handlePointer);
  stage.addEventListener("pointerleave", function () { lastPoint = null; });
  stage.addEventListener("pointerdown", function (event) {
    lastPoint = null;
    handlePointer(event);
  });
  revealButton.addEventListener("click", revealAll);
  replayButton.addEventListener("click", replay);

  function onResize() {
    generation += 1;
    window.cancelAnimationFrame(frameTimer);
    window.clearTimeout(throttleTimer);
    updateQueued = false;
    resizeCanvas(true);
    if (!completed) stage.classList.add("is-ready");
  }

  window.addEventListener("resize", onResize, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(onResize).observe(stage);
  resizeCanvas(false);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);

  if (!reducedMotion.matches) {
    hintTimer = window.setTimeout(function () {
      if (completed || !hint || hint.hidden) return;
      var firstLine = english.querySelector("p").getBoundingClientRect();
      var bounds = stage.getBoundingClientRect();
      var start = { x: firstLine.left - bounds.left + 12, y: firstLine.top - bounds.top + 20 };
      var end = { x: Math.min(firstLine.right - bounds.left, bounds.width - 12), y: start.y };
      var started = performance.now();
      function animate(timestamp) {
        if (completed) return;
        var progress = Math.min(1, (timestamp - started) / 1800);
        var point = { x: start.x + (end.x - start.x) * progress, y: start.y };
        lens.style.opacity = String(1 - Math.max(0, (progress - .78) / .22));
        lens.style.transform = "translate3d(" + (bounds.left + point.x) + "px," + (bounds.top + point.y) + "px,0) translate(-50%,-50%)";
        if (progress < .78) paintAt(point);
        if (progress < 1) hintAnimationId = window.requestAnimationFrame(animate);
        else {
          hintAnimationId = 0;
          window.setTimeout(function () { lens.style.opacity = ""; }, 200);
        }
      }
      hintAnimationId = window.requestAnimationFrame(animate);
    }, 700);
  }
}());
