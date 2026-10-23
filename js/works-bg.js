/* Фон блоку «Роботи»: тихий спектр унизу секції.
   У спокої стовпчики повільно дихають, під курсором ледь піднімаються.
   Коли грає трек або відеофайл із сайту — показують справжній спектр (подія "cs:audio" з main.js).
   Звук YouTube браузер не віддає, тож поки відео грає ("cs:video"), спектр імітує музику в ритмі. */
(function () {
  "use strict";
  var section = document.getElementById("portfolio");
  var c = document.getElementById("works-bg");
  if (!section || !c || !c.getContext) return;
  var g = c.getContext("2d");
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var STEP = 8, BAR = 2;
  var W, H, dpr, n, vals = [];
  var mouse = { x: -1e4, k: 0, target: 0 };
  var running = false, visible = false, t0 = null, enter = 0;

  /* ---------- звук ---------- */
  var actx = null, analyser = null, data = null, active = null;
  var bound = typeof WeakMap === "function" ? new WeakMap() : null;

  document.addEventListener("cs:audio", function (e) {
    var a = e.detail, Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx || !bound) return;
    // Чужий домен без CORS зробив би трек німим, тому аналізуємо лише свої файли
    try { if (new URL(a.currentSrc || a.src, location.href).origin !== location.origin) return; } catch (err) { return; }
    try {
      if (!actx) {
        actx = new Ctx();
        analyser = actx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.82;
        analyser.connect(actx.destination);
        data = new Uint8Array(analyser.frequencyBinCount);
      }
      if (!bound.has(a)) { var src = actx.createMediaElementSource(a); src.connect(analyser); bound.set(a, src); }
      if (actx.state === "suspended") actx.resume();
      active = a;
    } catch (err) { active = null; }
  });
  document.addEventListener("cs:audio-stop", function (e) { if (e.detail === active) active = null; });

  // YouTube: лише «грає / пауза»; якщо плеєр прибрали зі сторінки (фільтр, мова), імітація гасне
  var videoWin = null;
  document.addEventListener("cs:video", function (e) { videoWin = e.detail.playing ? e.detail.source : null; });
  function videoPlaying() {
    if (!videoWin) return false;
    var frames = section.getElementsByTagName("iframe");
    for (var i = 0; i < frames.length; i++) if (frames[i].contentWindow === videoWin) return true;
    videoWin = null;
    return false;
  }
  // Імітація: баси посередині б'ють у ритмі ~120 уд/хв, верхи дрібно мерехтять
  function fake(i, t) {
    var k = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2 || 1);
    var kick = Math.exp(-((t * 2) % 1) * 6);
    var shimmer = 0.5 + 0.5 * Math.sin(i * 0.9 + t * 9) * Math.sin(i * 0.37 - t * 5.3);
    return 0.6 * Math.pow(1 - k, 1.5) * (0.45 + 0.55 * kick) + 0.25 * shimmer * (0.4 + 0.6 * (1 - k));
  }

  // Частота для стовпчика i: дзеркально від центру — баси посередині, верхи до країв
  function bin(i) {
    var k = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2 || 1);
    return 1 + Math.floor(Math.pow(k, 1.6) * (data.length * 0.7 - 1));
  }

  /* ---------- малювання ---------- */
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = c.clientWidth; H = c.clientHeight;
    c.width = W * dpr; c.height = H * dpr;
    n = Math.ceil(W / STEP);
    while (vals.length < n) vals.push(0);
  }

  function draw(t) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    mouse.k += (mouse.target - mouse.k) * 0.08;
    var playing = active && !active.paused && data;
    if (playing) analyser.getByteFrequencyData(data);
    var video = !playing && videoPlaying();
    g.fillStyle = "#f2f3f5";

    for (var i = 0; i < n; i++) {
      var x = i * STEP + (STEP - BAR) / 2;
      // поява: хвиля зліва направо, коли секцію вперше видно
      var gate = Math.max(0, Math.min(1, enter * 1.6 - i / n));
      var idle = 0.08 + 0.06 * (0.5 + 0.5 * Math.sin(i * 0.17 + t * 0.7) * Math.sin(i * 0.045 - t * 0.45));
      var dx = x - mouse.x;
      var hover = 0.22 * mouse.k * Math.exp(-dx * dx / 16000);
      var target = idle + hover;
      if (playing) { var v = data[bin(i)] / 255; target = Math.max(target, v * v * 0.8); }
      else if (video) target = Math.max(target, fake(i, t) * 0.75);
      target *= gate;
      vals[i] += (target - vals[i]) * (target > vals[i] ? 0.2 : 0.06);

      // низько й прозоро; до країв екрана тане
      var h = Math.max(1.5, vals[i] * H * 0.45);
      var edge = Math.pow(Math.sin(Math.PI * (i + 0.5) / n), 0.7);
      g.globalAlpha = (0.03 + 0.1 * vals[i]) * edge;
      roundTop(x, H - h, BAR, h);
    }
    g.globalAlpha = 1;
  }

  function roundTop(x, y, w, h) {
    var r = w / 2;
    g.beginPath();
    g.moveTo(x, y + r);
    g.arc(x + r, y + r, r, Math.PI, 0);
    g.lineTo(x + w, y + h);
    g.lineTo(x, y + h);
    g.fill();
  }

  function frame(ts) {
    if (!running) return;
    if (t0 === null) t0 = ts;
    var t = (ts - t0) / 1000;
    enter = Math.min(1, enter + 0.012);
    draw(t);
    requestAnimationFrame(frame);
  }
  function play() {
    if (running || !visible || document.hidden) return;
    running = true;
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  section.addEventListener("pointermove", function (e) {
    var r = c.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    // що ближче курсор до низу секції, то сильніше відгук
    var dy = (r.bottom - e.clientY) / (r.height * 1.6);
    mouse.target = Math.max(0, 1 - dy);
  });
  section.addEventListener("pointerleave", function () { mouse.target = 0; });

  layout();
  window.addEventListener("resize", function () { layout(); if (still) { enter = 1; draw(4); } });
  if (still) { enter = 1; draw(4); return; }
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else play(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible) play(); else stop();
    }).observe(section);
  } else { visible = true; play(); }
})();
