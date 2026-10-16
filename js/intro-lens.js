(function () {
  "use strict";

  var stage = document.querySelector("[data-lens-stage]");
  var english = document.querySelector("[data-intro-en]");
  var spanish = document.querySelector("[data-intro-es]");
  var canvas = document.querySelector("[data-intro-canvas]");
  var glow = document.querySelector("[data-torch-glow]");
  var hint = document.querySelector("[data-lens-hint]");
  var doneMessage = document.querySelector("[data-intro-done]");
  var revealButton = document.querySelector("[data-reveal-all]");
  var replayButton = document.querySelector("[data-replay]");
  // No willReadFrequently: the canvas stays GPU-accelerated because progress is tracked in JS, not via getImageData.
  var context = canvas.getContext("2d");
  var lastPoint = null;
  var dpr = 1;
  var radius = 38;
  var revealRadius = radius * 0.75; // area of a stamp that is effectively fully erased
  var cellSize = radius;
  var sampleGrid = new Map();
  var sampleTotal = 0;
  var sampleRevealed = 0;
  var completed = false;
  var pendingPoints = [];
  var pendingGlow = null;
  var frameRequested = false;
  var hintHidden = false;
  var resizeTimer = 0;
  var threshold = window.SPANORA.config.revealThreshold || 0.9;
  var coverColor = "#FFEED9";
  var feather = 24;
  var spanishColor = getComputedStyle(document.documentElement).getPropertyValue("--muted").trim() || "#735B53";
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var spanishParagraphs = [];
  var sourceParagraphs = window.SPANORA.intro.paragraphs;
  spanish.innerHTML = sourceParagraphs.map(function (paragraph) {
    return "<p>" + escapeHtml(paragraph.es) + "</p>";
  }).join("");
  spanishParagraphs = Array.prototype.slice.call(spanish.querySelectorAll("p"));

  if (!context) {
    stage.classList.add("is-fallback");
    english.setAttribute("aria-hidden", "false");
    spanish.classList.remove("visually-hidden");
    hint.hidden = true;
    return;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function wrapText(text, maxWidth) {
    var words = text.trim().split(/\s+/);
    var lines = [];
    var line = "";

    words.forEach(function (word) {
      if (context.measureText(word).width > maxWidth) {
        if (line) lines.push(line);
        line = "";
        var fragment = "";
        Array.from(word).forEach(function (character) {
          if (fragment && context.measureText(fragment + character).width > maxWidth) {
            lines.push(fragment);
            fragment = character;
          } else {
            fragment += character;
          }
        });
        line = fragment;
        return;
      }

      var candidate = line ? line + " " + word : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });

    if (line) lines.push(line);
    return lines;
  }

  function measureAndPaint() {
    var width = Math.max(1, stage.getBoundingClientRect().width);
    var englishParagraph = english.querySelector("p");
    if (!englishParagraph || !width) return;

    var style = window.getComputedStyle(englishParagraph);
    var fontSize = parseFloat(style.fontSize) || 20;
    var lineHeight = parseFloat(style.lineHeight) || fontSize * 1.85;
    var paragraphStyle = window.getComputedStyle(spanishParagraphs[0]);
    var paragraphGap = parseFloat(paragraphStyle.marginBottom) || fontSize * 1.3;
    dpr = window.devicePixelRatio || 1;

    stage.style.minHeight = "";
    context.font = style.font;
    if (!context.font || context.font === "10px sans-serif") {
      context.font = style.fontSize + " " + style.fontFamily;
    }
    context.textBaseline = "top";
    context.textAlign = style.textAlign === "start" ? "left" : style.textAlign;

    var spanishLayout = spanishParagraphs.map(function (paragraph) {
      return {
        lines: wrapText(paragraph.textContent, width),
        marginBottom: parseFloat(window.getComputedStyle(paragraph).marginBottom) || paragraphGap
      };
    });
    var spanishHeight = spanishLayout.reduce(function (total, paragraph, index) {
      return total + paragraph.lines.length * lineHeight +
        (index < spanishLayout.length - 1 ? paragraph.marginBottom : 0);
    }, 0);
    var stageHeight = Math.ceil(Math.max(english.scrollHeight, spanishHeight));
    stage.style.minHeight = stageHeight + "px";
    var bounds = stage.getBoundingClientRect();
    // The canvas extends `feather` px past the text on every side so its edges can fade out.
    canvas.style.left = -feather + "px";
    canvas.style.top = -feather + "px";
    canvas.style.width = width + feather * 2 + "px";
    canvas.style.height = stageHeight + feather * 2 + "px";
    canvas.width = Math.max(1, Math.round((width + feather * 2) * dpr));
    canvas.height = Math.max(1, Math.round((stageHeight + feather * 2) * dpr));
    context.setTransform(dpr, 0, 0, dpr, feather * dpr, feather * dpr);
    context.font = style.font;
    if (!context.font || context.font === "10px sans-serif") {
      context.font = style.fontSize + " " + style.fontFamily;
    }
    context.textBaseline = "alphabetic";
    context.textAlign = style.textAlign === "start" ? "left" : style.textAlign;
    paintCover(width, stageHeight);
    context.fillStyle = spanishColor;

    // Place the baseline where CSS does: the font's content box is centred in the line box,
    // so the Spanish lines sit exactly on the English lines underneath.
    var metrics = context.measureText("Hg");
    var ascent = metrics.fontBoundingBoxAscent || fontSize * 0.8;
    var descent = metrics.fontBoundingBoxDescent || fontSize * 0.2;
    var baselineOffset = (lineHeight - (ascent + descent)) / 2 + ascent;

    var y = 0;
    spanishLayout.forEach(function (paragraph, index) {
      paragraph.lines.forEach(function (line) {
        context.fillText(line, 0, y + baselineOffset);
        y += lineHeight;
      });
      if (index < spanishLayout.length - 1) y += paragraph.marginBottom;
    });

    buildSamples(bounds);
  }

  // Solid cover behind the text, fading to transparent over the feather margin so no hard box edge shows.
  function paintCover(width, height) {
    var f = feather;
    context.globalCompositeOperation = "source-over";
    context.clearRect(-f, -f, width + f * 2, height + f * 2);
    context.fillStyle = coverColor;
    context.fillRect(-f, -f, width + f * 2, height + f * 2);

    context.globalCompositeOperation = "destination-out";
    var edges = [
      [-f, 0, 0, 0, -f, -f, f, height + f * 2],
      [width + f, 0, width, 0, width, -f, f, height + f * 2],
      [0, -f, 0, 0, -f, -f, width + f * 2, f],
      [0, height + f, 0, height, -f, height, width + f * 2, f]
    ];
    edges.forEach(function (e) {
      var gradient = context.createLinearGradient(e[0], e[1], e[2], e[3]);
      gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = gradient;
      context.fillRect(e[4], e[5], e[6], e[7]);
    });
    context.globalCompositeOperation = "source-over";
  }

  // Sample points sit on the English text lines (CSS px), bucketed into a grid so each
  // stamp only checks nearby points. This replaces reading canvas pixels back.
  function buildSamples(stageBounds) {
    sampleGrid = new Map();
    sampleTotal = 0;
    sampleRevealed = 0;
    var range = document.createRange();
    range.selectNodeContents(english);
    Array.prototype.forEach.call(range.getClientRects(), function (rect) {
      var left = Math.max(0, rect.left - stageBounds.left);
      var right = Math.min(stageBounds.width, rect.right - stageBounds.left);
      var top = Math.max(0, rect.top - stageBounds.top);
      var bottom = Math.min(canvas.clientHeight, rect.bottom - stageBounds.top);
      var heights = [top + (bottom - top) * 0.25, top + (bottom - top) * 0.75];
      heights.forEach(function (y) {
        for (var x = left + 4; x < right; x += 8) {
          var key = Math.floor(x / cellSize) + ":" + Math.floor(y / cellSize);
          var bucket = sampleGrid.get(key);
          if (!bucket) sampleGrid.set(key, bucket = []);
          bucket.push({ x: x, y: y, revealed: false });
          sampleTotal += 1;
        }
      });
    });
  }

  function markRevealed(x, y) {
    var r2 = revealRadius * revealRadius;
    var cx = Math.floor(x / cellSize);
    var cy = Math.floor(y / cellSize);
    for (var gx = cx - 1; gx <= cx + 1; gx += 1) {
      for (var gy = cy - 1; gy <= cy + 1; gy += 1) {
        var bucket = sampleGrid.get(gx + ":" + gy);
        if (!bucket) continue;
        for (var i = 0; i < bucket.length; i += 1) {
          var point = bucket[i];
          if (point.revealed) continue;
          var dx = point.x - x;
          var dy = point.y - y;
          if (dx * dx + dy * dy <= r2) {
            point.revealed = true;
            sampleRevealed += 1;
          }
        }
      }
    }
  }

  function stamp(x, y) {
    var gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
    gradient.addColorStop(0.7, "rgba(0, 0, 0, 1)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.globalCompositeOperation = "destination-out";
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    markRevealed(x, y);
  }

  function scratchTo(point) {
    if (completed) return;
    if (!lastPoint) {
      stamp(point.x, point.y);
    } else {
      var dx = point.x - lastPoint.x;
      var dy = point.y - lastPoint.y;
      var distance = Math.hypot(dx, dy);
      var spacing = Math.max(1, radius / 3);
      var steps = Math.max(1, Math.ceil(distance / spacing));
      for (var step = 1; step <= steps; step += 1) {
        var progress = step / steps;
        stamp(lastPoint.x + dx * progress, lastPoint.y + dy * progress);
      }
    }
    lastPoint = point;
  }

  // Pointer events can fire several times per frame; queue them and draw once per animation frame.
  function requestFrame() {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(flushFrame);
  }

  function flushFrame() {
    frameRequested = false;
    if (pendingGlow) {
      glow.style.transform = "translate3d(" + pendingGlow.x + "px, " + pendingGlow.y + "px, 0) translate(-50%, -50%)";
      pendingGlow = null;
    }
    if (completed || !pendingPoints.length) {
      pendingPoints.length = 0;
      return;
    }
    var bounds = canvas.getBoundingClientRect();
    for (var i = 0; i < pendingPoints.length; i += 1) {
      var item = pendingPoints[i];
      if (item === null) {
        lastPoint = null;
        continue;
      }
      scratchTo({ x: item.x - bounds.left - feather, y: item.y - bounds.top - feather });
    }
    pendingPoints.length = 0;
    if (sampleTotal && sampleRevealed / sampleTotal >= threshold) finishReveal();
  }

  function moveGlow(event) {
    pendingGlow = { x: event.clientX, y: event.clientY };
    requestFrame();
  }

  function queueScratch(event) {
    pendingPoints.push({ x: event.clientX, y: event.clientY });
    requestFrame();
  }

  function hideHint() {
    if (hintHidden) return;
    hintHidden = true;
    hint.hidden = true;
  }

  function finishReveal() {
    if (completed) return;
    completed = true;
    stage.classList.add("is-done");
    english.setAttribute("aria-hidden", "false");
    doneMessage.hidden = false;
    revealButton.hidden = true;
    replayButton.hidden = false;
    hint.hidden = true;
    glow.classList.remove("is-visible");
    lastPoint = null;
  }

  function resetReveal() {
    completed = false;
    pendingPoints.length = 0;
    lastPoint = null;
    stage.classList.remove("is-done");
    doneMessage.hidden = true;
    revealButton.hidden = false;
    replayButton.hidden = true;
    english.setAttribute("aria-hidden", "true");
    glow.classList.remove("is-visible");
    measureAndPaint();
  }

  stage.addEventListener("pointerenter", function (event) {
    if (completed) return;
    glow.classList.add("is-visible");
    moveGlow(event);
    stopStroke();
  });

  stage.addEventListener("pointermove", function (event) {
    if (completed) return;
    moveGlow(event);
    queueScratch(event);
    hideHint();
  });

  stage.addEventListener("pointerdown", function (event) {
    if (completed) return;
    if (stage.setPointerCapture) stage.setPointerCapture(event.pointerId);
    glow.classList.add("is-visible");
    moveGlow(event);
    queueScratch(event);
    hideHint();
  });

  // Stroke breaks are queued in order so they apply between the right points.
  function stopStroke() {
    pendingPoints.push(null);
    requestFrame();
  }
  stage.addEventListener("pointerup", stopStroke);
  stage.addEventListener("pointercancel", stopStroke);
  stage.addEventListener("pointerleave", function () {
    stopStroke();
    glow.classList.remove("is-visible");
  });
  revealButton.addEventListener("click", finishReveal);
  replayButton.addEventListener("click", resetReveal);

  // Scrolling moves the text under a still cursor without firing pointer events, so re-check
  // what the torch is over on scroll and keep lighting (or stop) accordingly.
  var lastClient = null;
  var torchOverStage = false;
  window.addEventListener("pointermove", function (event) {
    lastClient = { clientX: event.clientX, clientY: event.clientY, pointerType: event.pointerType };
  }, { passive: true });

  window.addEventListener("scroll", function () {
    if (completed || !lastClient || lastClient.pointerType === "touch") return;
    var bounds = stage.getBoundingClientRect();
    var inside = lastClient.clientX >= bounds.left && lastClient.clientX <= bounds.right &&
      lastClient.clientY >= bounds.top && lastClient.clientY <= bounds.bottom;
    if (inside) {
      if (!torchOverStage) stopStroke();
      glow.classList.add("is-visible");
      moveGlow(lastClient);
      queueScratch(lastClient);
    } else if (torchOverStage) {
      stopStroke();
      glow.classList.remove("is-visible");
    }
    torchOverStage = inside;
  }, { passive: true });

  stage.addEventListener("pointerenter", function () { torchOverStage = true; });
  stage.addEventListener("pointerleave", function () { torchOverStage = false; });

  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      if (!completed) measureAndPaint();
    }, 150);
  }, { passive: true });

  document.fonts.ready.then(measureAndPaint);
}());
