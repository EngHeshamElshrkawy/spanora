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
  var context = canvas.getContext("2d", { willReadFrequently: true });
  var lastPoint = null;
  var samplePoints = [];
  var dpr = 1;
  var radius = 38;
  var completed = false;
  var progressTimer = 0;
  var progressPending = false;
  var resizeTimer = 0;
  var threshold = window.SPANORA.config.revealThreshold || 0.9;
  var coverColor = "#FFEED9";
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
    canvas.style.width = width + "px";
    canvas.style.height = "100%";
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
    canvas.style.height = stageHeight + "px";
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(stageHeight * dpr));
    context = canvas.getContext("2d", { willReadFrequently: true });
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.font = style.font;
    if (!context.font || context.font === "10px sans-serif") {
      context.font = style.fontSize + " " + style.fontFamily;
    }
    context.textBaseline = "top";
    context.textAlign = style.textAlign === "start" ? "left" : style.textAlign;
    context.clearRect(0, 0, width, stageHeight);
    context.globalCompositeOperation = "source-over";
    context.fillStyle = coverColor;
    context.fillRect(0, 0, width, stageHeight);
    context.fillStyle = style.color;

    var y = 0;
    spanishLayout.forEach(function (paragraph, index) {
      paragraph.lines.forEach(function (line) {
        context.fillText(line, 0, y);
        y += lineHeight;
      });
      if (index < spanishLayout.length - 1) y += paragraph.marginBottom;
    });

    buildSamples(bounds);
  }

  function buildSamples(stageBounds) {
    var points = [];
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
          points.push({
            x: Math.min(canvas.width - 1, Math.round(x * dpr)),
            y: Math.min(canvas.height - 1, Math.round(y * dpr))
          });
        }
      });
    });
    samplePoints = points;
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
    scheduleProgressCheck();
  }

  function scheduleProgressCheck() {
    progressPending = true;
    if (progressTimer) return;
    progressTimer = window.setTimeout(function checkProgress() {
      progressTimer = 0;
      if (completed || !progressPending) return;
      progressPending = false;
      var pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      var revealed = 0;
      samplePoints.forEach(function (point) {
        var alphaIndex = (point.y * canvas.width + point.x) * 4 + 3;
        if (pixels[alphaIndex] < 60) revealed += 1;
      });
      if (samplePoints.length && revealed / samplePoints.length >= threshold) finishReveal();
      else if (progressPending) progressTimer = window.setTimeout(checkProgress, 150);
    }, 150);
  }

  function moveGlow(event) {
    glow.style.transform = "translate(" + event.clientX + "px, " + event.clientY + "px) translate(-50%, -50%)";
  }

  function pointFromEvent(event) {
    var bounds = canvas.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top
    };
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
    progressPending = false;
    window.clearTimeout(progressTimer);
    progressTimer = 0;
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
    lastPoint = null;
  });

  stage.addEventListener("pointermove", function (event) {
    if (completed) return;
    moveGlow(event);
    scratchTo(pointFromEvent(event));
    hint.hidden = true;
  });

  stage.addEventListener("pointerdown", function (event) {
    if (completed) return;
    if (stage.setPointerCapture) stage.setPointerCapture(event.pointerId);
    glow.classList.add("is-visible");
    moveGlow(event);
    scratchTo(pointFromEvent(event));
    hint.hidden = true;
  });

  function stopStroke() {
    lastPoint = null;
  }
  stage.addEventListener("pointerup", stopStroke);
  stage.addEventListener("pointercancel", stopStroke);
  stage.addEventListener("pointerleave", function () {
    stopStroke();
    glow.classList.remove("is-visible");
  });
  revealButton.addEventListener("click", finishReveal);
  replayButton.addEventListener("click", resetReveal);

  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      if (!completed) measureAndPaint();
    }, 150);
  }, { passive: true });

  document.fonts.ready.then(measureAndPaint);
}());
