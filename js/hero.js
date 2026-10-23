/* Головний екран: логотип малюється сам, а хвиля з нього «грає», як живий осцилограф.
   Під курсором (або пальцем) лінія дрижить, як струна. Геометрія — та сама, що в #i-logo (поле 64×48). */
(function () {
  "use strict";
  var c = document.getElementById("hero-canvas");
  if (!c || !c.getContext) return;
  var g = c.getContext("2d");
  var hero = c.parentNode;
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Пульс логотипа: x і зсув від середньої лінії (y = 24)
  var PULSE = [[14, 0], [22, 0], [25, -7], [29, 8], [33, -14], [37, 12], [40, -5], [43, 4], [45, 0]];
  // Дуга «C»: коло r = 20 через точки (40, 8.5) і (40, 39.5)
  var R = 20, CX = 40 - Math.sqrt(R * R - 15.5 * 15.5), CY = 24;
  var A0 = Math.atan2(-15.5, 40 - CX), SWEEP = 2 * Math.PI + 2 * A0;

  var W, H, dpr, s, ox, oy;
  var mouse = { x: -1e4, y: -1e4, k: 0, target: 0 };
  var start = null, running = false, visible = true;

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(v) { return 1 - Math.pow(1 - v, 3); }

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = c.clientWidth; H = c.clientHeight;
    c.width = W * dpr; c.height = H * dpr;
    var L;
    if (W >= 760) {
      var right = (W + Math.min(W, 1040)) / 2 - 20;
      L = Math.min(440, W * 0.36);
      ox = right - L; oy = H / 2 - 24 * L / 64;
    } else {
      L = Math.min(230, W * 0.62);
      ox = (W - L) / 2; oy = 28;
    }
    s = L / 64;
  }

  // «Гучність»: дихання плюс удар раз на 1,6 с
  function kick(t) { var ph = (t % 1.6) / 1.6; return Math.exp(-ph * 7); }
  function level(t) { return 0.78 + 0.1 * Math.sin(t * 1.7) + 0.07 * Math.sin(t * 4.3) + 0.4 * kick(t); }

  function pulse(u, t) {
    for (var i = 1; i < PULSE.length; i++) {
      var a = PULSE[i - 1], b = PULSE[i];
      if (u <= b[0]) {
        var k = (u - a[0]) / (b[0] - a[0]);
        // кожен пік живе трохи по-своєму
        var ya = a[1] * (1 + 0.18 * Math.sin(t * 7 + i)), yb = b[1] * (1 + 0.18 * Math.sin(t * 7 + i + 1));
        return ya + (yb - ya) * k;
      }
    }
    return 0;
  }

  function waveY(x, t, amp) {
    var u = (x - ox) / s, lv = level(t), y = 0;
    if (u > 14 && u < 45) y += pulse(u, t) * s * lv * amp;
    var env = Math.exp(-Math.abs(u - 30) / 64 * 1.4);
    y += (0.6 * Math.sin(x * 0.021 - t * 2.1) + 0.4 * Math.sin(x * 0.047 + t * 3.3)) * s * 1.4 * env * (0.4 + 0.6 * lv) * amp;
    var dx = x - mouse.x;
    y += mouse.k * Math.exp(-dx * dx / 7200) * Math.sin(dx * 0.09 - t * 12) * s * 3;
    return y;
  }

  function line(from, to, t, amp, y0) {
    g.beginPath();
    for (var x = from; x <= to; x += 3) g.lineTo(x, y0 + waveY(x, t, amp));
    g.lineTo(to, y0 + waveY(to, t, amp));
  }

  function draw(t) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    mouse.k += (mouse.target - mouse.k) * 0.08;

    var y0 = oy + 24 * s, mid = ox + 30 * s;
    var arcP = ease(clamp(t / 1.1));
    var rev = ease(clamp((t - 0.5) / 1.4));
    var amp = ease(clamp((t - 0.9) / 0.9));
    var glow = 0.5 + 0.5 * kick(t) * amp;
    g.lineCap = "round"; g.lineJoin = "round";

    // Тонка лінія на всю ширину: яскрава біля логотипа, тане до країв
    var p = mid / W, grad = g.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(Math.max(0, p - 0.4), "rgba(255,255,255,0.16)");
    grad.addColorStop(clamp(p), "rgba(255,255,255,0.55)");
    grad.addColorStop(Math.min(1, p + 0.4), "rgba(255,255,255,0.16)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.strokeStyle = grad; g.lineWidth = 1.5;
    line(mid - rev * mid, mid + rev * (W - mid), t, amp, y0);
    g.stroke();

    // Хвиля логотипа з «шлейфом», як на екрані осцилографа
    var a = ox + 14 * s, b = ox + 62 * s, half = (b - a) / 2;
    var la = mid - rev * (mid - a), lb = Math.min(b, mid + rev * half * 2);
    if (lb > la) {
      [[0.16, 0.1], [0.08, 0.22], [0, 1]].forEach(function (e) {
        g.globalAlpha = e[1];
        g.strokeStyle = "#f2f3f5";
        g.lineWidth = 2.4 * s * 0.75;
        g.shadowColor = "rgba(255,255,255,0.5)";
        g.shadowBlur = e[0] ? 0 : 10 + 22 * glow;
        line(la, lb, t - e[0], amp, y0);
        g.stroke();
      });
      g.globalAlpha = 1;
    }

    // Дуга «C»
    if (arcP > 0) {
      g.beginPath();
      g.arc(ox + CX * s, oy + CY * s, R * s, A0, A0 - arcP * SWEEP, true);
      g.strokeStyle = "#f2f3f5";
      g.lineWidth = 6 * s;
      g.shadowColor = "rgba(255,255,255,0.35)";
      g.shadowBlur = 8 + 26 * glow;
      g.stroke();
    }
    g.shadowBlur = 0;
  }

  function frame(ts) {
    if (!running) return;
    if (start === null) start = ts;
    draw((ts - start) / 1000);
    requestAnimationFrame(frame);
  }
  function play() {
    if (running || still || !visible || document.hidden) return;
    running = true;
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  hero.addEventListener("pointermove", function (e) {
    var r = c.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    var dy = (mouse.y - (oy + 24 * s)) / 140;
    mouse.target = Math.exp(-dy * dy);
  });
  hero.addEventListener("pointerleave", function () { mouse.target = 0; });

  layout();
  window.addEventListener("resize", function () { layout(); if (still) draw(10); });
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else play(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible) play(); else stop();
    }).observe(hero);
  }
  if (still) draw(10); else play();
})();
