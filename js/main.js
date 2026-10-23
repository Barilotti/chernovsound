/* CHERNOVsound: мова, портфоліо, відгуки, «Про мене».
   Вміст лежить у content/*.json і редагується через адмінпанель (Pages CMS). */
(function () {
  "use strict";

  var SETTINGS = {};
  var PORTFOLIO = [];
  var REVIEWS = [];
  var ABOUT = null;
  var DICT = window.I18N || { uk: {}, en: {} };
  var SERVICES = ["mixing", "dubmix", "sounddesign", "voiceover", "podcast", "ads"];
  var LANGS = ["uk", "en"];

  var lang = "uk";
  var filter = "all";

  /* ---------- допоміжні ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function t(key) { return (DICT[lang] && DICT[lang][key]) || DICT.uk[key] || ""; }
  // Текст з content/*.js: рядок або { uk, en }
  function pick(v) {
    if (v == null) return "";
    if (typeof v === "string") return v;
    return v[lang] || v.uk || v.en || "";
  }
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "class") n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function icon(id, cls) {
    var ns = "http://www.w3.org/2000/svg";
    var s = document.createElementNS(ns, "svg");
    s.setAttribute("aria-hidden", "true");
    if (cls) s.setAttribute("class", cls);
    var u = document.createElementNS(ns, "use");
    u.setAttribute("href", "#" + id);
    s.appendChild(u);
    return s;
  }
  // Поле двома мовами: title_uk / title_en (або старий формат { uk, en })
  function field(o, name) {
    if (!o) return "";
    return o[name + "_" + lang] || o[name + "_uk"] || o[name + "_en"] || pick(o[name]);
  }
  // Шлях до файлу з адмінки: без початкового "/", щоб працювало і в підпапці
  function url(p) { return p ? String(p).replace(/^\/+/, "") : ""; }
  function services(item) { return [].concat(item.service || []).filter(Boolean); }
  function store(key, val) {
    try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { return null; }
  }

  /* ---------- мова ---------- */
  function initialLang() {
    var q = null;
    try { q = new URLSearchParams(location.search).get("lang"); } catch (e) {}
    if (LANGS.indexOf(q) > -1) return q;
    var saved = store("cs-lang");
    if (LANGS.indexOf(saved) > -1) return saved;
    return "uk";
  }

  function setMeta(selector, value) { var m = $(selector); if (m) m.setAttribute("content", value); }

  function applyLang(next, push) {
    lang = next;
    document.documentElement.lang = lang;
    $all("[data-i18n]").forEach(function (n) { var v = t(n.getAttribute("data-i18n")); if (v) n.textContent = v; });
    $all("[data-i18n-placeholder]").forEach(function (n) { n.placeholder = t(n.getAttribute("data-i18n-placeholder")); });
    $all(".lang-switch button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.lang === lang)); });
    document.title = t("meta.title");
    setMeta('meta[name="description"]', t("meta.description"));
    setMeta('meta[property="og:locale"]', lang === "uk" ? "uk_UA" : "en_US");
    renderFilters();
    renderPortfolio();
    renderReviews();
    renderAbout();
    if (push) {
      store("cs-lang", lang);
      try {
        var url = new URL(location.href);
        if (lang === "uk") url.searchParams.delete("lang"); else url.searchParams.set("lang", lang);
        history.replaceState(null, "", url);
      } catch (e) {}
    }
  }

  $all(".lang-switch button").forEach(function (b) {
    b.addEventListener("click", function () { applyLang(b.dataset.lang, true); });
  });

  /* ---------- меню на телефоні ---------- */
  var header = $(".site-header");
  var toggle = $(".menu-toggle");
  function closeMenu() { header.classList.remove("menu-open"); toggle.setAttribute("aria-expanded", "false"); }
  toggle.addEventListener("click", function () {
    var open = header.classList.toggle("menu-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  $all(".main-nav a").forEach(function (a) { a.addEventListener("click", closeMenu); });

  /* ---------- портфоліо ---------- */
  var currentAudio = null;

  function renderFilters() {
    var box = $("#portfolio-filters");
    box.innerHTML = "";
    ["all"].concat(SERVICES).forEach(function (id) {
      var count = id === "all" ? PORTFOLIO.length : PORTFOLIO.filter(function (p) { return services(p).indexOf(id) > -1; }).length;
      var b = el("button", { type: "button", class: "chip", role: "tab", "aria-selected": String(filter === id), "data-id": id });
      b.appendChild(document.createTextNode(id === "all" ? t("portfolio.all") : t("svc." + id + ".title")));
      b.appendChild(el("span", { class: "count", text: String(count) }));
      b.addEventListener("click", function () { filter = id; renderFilters(); renderPortfolio(); });
      box.appendChild(b);
    });
  }

  function youtubeId(url) {
    var m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
    return m ? m[1] : null;
  }

  // Посилання Google Drive: .../file/d/ID/view, ...?id=ID або просто ID
  function driveId(link) {
    var m = String(link || "").match(/(?:\/d\/|[?&]id=)([\w-]{20,})/) || String(link || "").match(/^([\w-]{20,})$/);
    return m ? m[1] : null;
  }

  function fmt(sec) {
    if (!isFinite(sec)) return "0:00";
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  // Хвиля: справжня (з файлу) або умовна, якщо файл не вдалося прочитати.
  var peaksCache = {};
  function fakePeaks(seed, n) {
    var out = [], x = 0;
    for (var i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) >>> 0;
    for (var j = 0; j < n; j++) { x = (x * 1103515245 + 12345) >>> 0; out.push(0.25 + 0.75 * Math.abs(Math.sin(j / 5 + (x % 100) / 40)) * ((x % 1000) / 1000 * 0.5 + 0.5)); }
    return out;
  }
  function loadPeaks(src, n) {
    if (peaksCache[src]) return peaksCache[src];
    var Ctx = window.AudioContext || window.webkitAudioContext;
    peaksCache[src] = (Ctx && window.fetch ? fetch(src).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.arrayBuffer();
    }).then(function (buf) {
      var ctx = new Ctx();
      return new Promise(function (res, rej) { ctx.decodeAudioData(buf, res, rej); }).then(function (audio) {
        if (ctx.close) ctx.close();
        var data = audio.getChannelData(0), step = Math.floor(data.length / n), peaks = [], max = 0;
        for (var i = 0; i < n; i++) {
          var p = 0;
          for (var k = i * step; k < (i + 1) * step; k += 16) { var v = Math.abs(data[k]); if (v > p) p = v; }
          peaks.push(p); if (p > max) max = p;
        }
        return peaks.map(function (p) { return 0.12 + 0.88 * (max ? p / max : 0); });
      });
    }) : Promise.reject()).catch(function () { return fakePeaks(src, n); });
    return peaksCache[src];
  }

  function drawWave(canvas, peaks, progress) {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w) return;
    canvas.width = w * dpr; canvas.height = h * dpr;
    var c = canvas.getContext("2d");
    c.scale(dpr, dpr);
    var n = peaks.length, gap = 2, bw = Math.max(1.5, w / n - gap);
    for (var i = 0; i < n; i++) {
      var x = i * (w / n), bh = Math.max(2, peaks[i] * h);
      c.fillStyle = i / n < progress ? "#eef1f5" : "rgba(185,205,224,0.28)";
      c.fillRect(x, (h - bh) / 2, bw, bh);
    }
  }

  function audioPlayer(item) {
    var hasBefore = !!item.audio_before;
    var audio = new Audio();
    audio.preload = "metadata";
    var srcAfter = url(item.audio), srcBefore = url(item.audio_before), which = "after";
    audio.src = srcAfter;

    var btn = el("button", { type: "button", class: "player-btn", "aria-label": t("portfolio.play") }, [icon("i-play")]);
    var canvas = el("canvas", { class: "wave", "aria-hidden": "true" });
    var time = el("span", { text: "0:00" });
    var row = el("div", { class: "player-row" }, [time]);
    var peaks = fakePeaks(srcAfter, 70);

    function redraw() { drawWave(canvas, peaks, audio.duration ? audio.currentTime / audio.duration : 0); }
    function setIcon(playing) {
      btn.innerHTML = ""; btn.appendChild(icon(playing ? "i-pause" : "i-play"));
      btn.setAttribute("aria-label", playing ? t("portfolio.pause") : t("portfolio.play"));
    }
    function loadWave(src) { loadPeaks(src, 70).then(function (p) { peaks = p; redraw(); }); }

    if (hasBefore) {
      var ab = el("div", { class: "ab", role: "group" });
      [["before", "portfolio.before"], ["after", "portfolio.after"]].forEach(function (pair) {
        var b = el("button", { type: "button", "aria-pressed": String(pair[0] === which), text: t(pair[1]) });
        b.addEventListener("click", function () {
          if (which === pair[0]) return;
          which = pair[0];
          $all("button", ab).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          var pos = audio.currentTime, playing = !audio.paused;
          audio.src = which === "after" ? srcAfter : srcBefore;
          audio.addEventListener("loadedmetadata", function once() {
            audio.removeEventListener("loadedmetadata", once);
            try { audio.currentTime = Math.min(pos, audio.duration || pos); } catch (e) {}
            if (playing) audio.play();
          });
          loadWave(audio.src);
        });
        ab.appendChild(b);
      });
      row.appendChild(ab);
    }

    btn.addEventListener("click", function () {
      if (audio.paused) {
        if (currentAudio && currentAudio !== audio) currentAudio.pause();
        currentAudio = audio;
        audio.play();
      } else audio.pause();
    });
    audio.addEventListener("play", function () { setIcon(true); });
    audio.addEventListener("pause", function () { setIcon(false); });
    audio.addEventListener("ended", function () { setIcon(false); });
    audio.addEventListener("timeupdate", function () { time.textContent = fmt(audio.currentTime) + " / " + fmt(audio.duration); redraw(); });
    audio.addEventListener("loadedmetadata", function () { time.textContent = "0:00 / " + fmt(audio.duration); });
    canvas.addEventListener("click", function (e) {
      if (!audio.duration) return;
      var r = canvas.getBoundingClientRect();
      audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
      redraw();
    });
    requestAnimationFrame(redraw);
    window.addEventListener("resize", redraw);
    loadWave(srcAfter);

    return el("div", { class: "player" }, [btn, el("div", { class: "player-main" }, [canvas, row])]);
  }

  function mediaBlock(item) {
    if (item.type === "youtube") {
      var id = youtubeId(item.youtube);
      var box = el("div", { class: "work-media" });
      var thumb = url(item.cover) || (id ? "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg" : "");
      if (thumb) {
        var im = el("img", { src: thumb, alt: "", loading: "lazy" });
        im.addEventListener("error", function () { im.remove(); });
        box.appendChild(im);
      }
      var play = el("button", { type: "button", class: "yt-play", "aria-label": t("portfolio.watch") }, [el("span", null, [icon("i-play")])]);
      play.addEventListener("click", function () {
        if (!id) { window.open(item.youtube, "_blank", "noopener"); return; }
        box.innerHTML = "";
        box.appendChild(el("iframe", {
          src: "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0",
          title: field(item, "title"), allow: "autoplay; encrypted-media; picture-in-picture", allowfullscreen: ""
        }));
      });
      box.appendChild(play);
      return [box];
    }
    if (item.type === "gdrive") {
      var gid = driveId(item.gdrive);
      var gbox = el("div", { class: "work-media" });
      var gthumb = url(item.cover) || (gid ? "https://drive.google.com/thumbnail?id=" + gid + "&sz=w1280" : "");
      if (gthumb) {
        var gim = el("img", { src: gthumb, alt: "", loading: "lazy", referrerpolicy: "no-referrer" });
        gim.addEventListener("error", function () { gim.remove(); });
        gbox.appendChild(gim);
      }
      var gplay = el("button", { type: "button", class: "yt-play", "aria-label": t("portfolio.watch") }, [el("span", null, [icon("i-play")])]);
      gplay.addEventListener("click", function () {
        if (!gid) { window.open(item.gdrive, "_blank", "noopener"); return; }
        if (currentAudio) currentAudio.pause();
        gbox.innerHTML = "";
        gbox.appendChild(el("iframe", {
          src: "https://drive.google.com/file/d/" + gid + "/preview",
          title: field(item, "title"), allow: "autoplay; fullscreen", allowfullscreen: ""
        }));
      });
      gbox.appendChild(gplay);
      return [gbox];
    }
    if (item.type === "video") {
      var attrs = { src: url(item.video), controls: "", preload: "metadata", playsinline: "" };
      if (item.cover) attrs.poster = url(item.cover);
      return [el("div", { class: "work-media" }, [el("video", attrs)])];
    }
    // audio
    var parts = [];
    if (item.cover) parts.push(el("div", { class: "work-cover" }, [el("img", { src: url(item.cover), alt: field(item, "title"), loading: "lazy" })]));
    parts.push(audioPlayer(item));
    return parts;
  }

  function renderPortfolio() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    var list = $("#portfolio-list");
    list.innerHTML = "";
    var items = PORTFOLIO.filter(function (p) { return filter === "all" || services(p).indexOf(filter) > -1; });
    $("#portfolio-empty").hidden = items.length > 0;
    items.forEach(function (item) {
      var meta = el("div", { class: "work-meta" });
      if (item.demo) meta.appendChild(el("span", { class: "badge", text: t("portfolio.demo") }));
      meta.appendChild(el("span", { text: services(item).map(function (s) { return t("svc." + s + ".title"); }).join(" · ") + (item.year ? " · " + item.year : "") }));
      var body = el("div", { class: "work-body" }, [meta, el("h3", { text: field(item, "title") })]);
      var desc = field(item, "description");
      if (desc) body.appendChild(el("p", { text: desc }));
      list.appendChild(el("article", { class: "work" }, mediaBlock(item).concat([body])));
    });
  }

  // Кнопки «Приклади робіт» у картках послуг вмикають потрібний фільтр
  $all("[data-filter]").forEach(function (a) {
    a.addEventListener("click", function () { filter = a.dataset.filter; renderFilters(); renderPortfolio(); });
  });

  /* ---------- відгуки ---------- */
  function renderReviews() {
    var list = $("#reviews-list");
    list.innerHTML = "";
    $("#reviews-empty").hidden = REVIEWS.length > 0;
    REVIEWS.forEach(function (r) {
      var top = el("div", { class: "review-top" });
      if (r.rating) {
        var stars = el("div", { class: "stars", "aria-label": r.rating + "/5" });
        for (var i = 1; i <= 5; i++) stars.appendChild(icon("i-star-fill", i <= r.rating ? "" : "off"));
        top.appendChild(stars);
      } else top.appendChild(el("span"));
      if (r.demo) top.appendChild(el("span", { class: "badge", text: t("reviews.demo") }));

      var name = field(r, "name");
      var avatar = r.photo ? el("img", { class: "avatar", src: url(r.photo), alt: "", loading: "lazy" }) : el("span", { class: "avatar", "aria-hidden": "true", text: name.charAt(0).toUpperCase() });
      var whoText = el("div", null, [el("div", { class: "review-name", text: name })]);
      var role = field(r, "role") || (r.service ? t("svc." + r.service + ".title") : "");
      if (role) whoText.appendChild(el("div", { class: "review-role", text: role }));

      var children = [top];
      var text = field(r, "text");
      if (text) children.push(el("blockquote", { text: text }));
      if (r.screenshot) children.push(el("img", { class: "review-shot", src: url(r.screenshot), alt: name, loading: "lazy" }));
      children.push(el("div", { class: "review-who" }, [avatar, whoText]));
      if (r.link) children.push(el("a", { class: "review-link", href: r.link, target: "_blank", rel: "noopener", text: t("reviews.source") + " ↗" }));
      list.appendChild(el("article", { class: "review" }, children));
    });
  }

  /* ---------- про мене ---------- */
  function renderAbout() {
    var box = $("#about-block");
    box.innerHTML = "";
    box.hidden = !ABOUT;
    if (!ABOUT) return;

    var photo = ABOUT.photo
      ? el("img", { class: "about-photo", src: url(ABOUT.photo), alt: "CHERNOVsound", loading: "lazy" })
      : el("div", { class: "about-photo about-photo-empty", "aria-hidden": "true" }, [icon("i-logo")]);

    var text = el("div", { class: "about-text" });
    var head = el("div", { class: "about-head" }, [el("p", { class: "eyebrow", text: t("about.eyebrow") })]);
    if (ABOUT.demo) head.appendChild(el("span", { class: "badge", text: t("portfolio.demo") }));
    text.appendChild(head);
    text.appendChild(el("h2", { id: "about-title", text: t("about.title") }));
    field(ABOUT, "text").split(/\n\s*\n/).forEach(function (para) {
      if (para.trim()) text.appendChild(el("p", { class: "about-para", text: para.trim() }));
    });

    var facts = (ABOUT.facts || []).filter(function (f) { return f && f.value; });
    if (facts.length) {
      text.appendChild(el("dl", { class: "facts" }, facts.map(function (f) {
        return el("div", { class: "fact" }, [el("dt", { text: f.value }), el("dd", { text: field(f, "label") })]);
      })));
    }

    var projects = (ABOUT.projects || []).filter(function (p) { return p && p.name; });
    if (projects.length) {
      text.appendChild(el("h3", { class: "projects-title", text: t("about.projects") }));
      text.appendChild(el("ul", { class: "projects" }, projects.map(function (p) {
        var name = p.link ? el("a", { href: p.link, target: "_blank", rel: "noopener", text: p.name + " ↗" }) : el("span", { text: p.name });
        var li = el("li", null, [el("div", { class: "project-name" }, [name])]);
        var role = field(p, "role");
        if (role || p.year) li.appendChild(el("div", { class: "project-role", text: [role, p.year].filter(Boolean).join(" · ") }));
        return li;
      })));
    }
    box.appendChild(photo);
    box.appendChild(text);
  }

  /* ---------- соцмережі ---------- */
  var SOCIALS = [
    ["telegram", "i-telegram", "Telegram"], ["discord", "i-discord", "Discord"], ["youtube", "i-youtube", "YouTube"],
    ["instagram", "i-instagram", "Instagram"], ["tiktok", "i-tiktok", "TikTok"]
  ];
  function renderSocials() {
    var socials = $("#socials");
    socials.innerHTML = "";
    SOCIALS.forEach(function (s) {
      if (!SETTINGS[s[0]]) return;
      socials.appendChild(el("a", { href: SETTINGS[s[0]], target: "_blank", rel: "noopener", "aria-label": s[2] }, [icon(s[1])]));
    });
    if (SETTINGS.email) socials.appendChild(el("a", { href: "mailto:" + SETTINGS.email, "aria-label": "Email" }, [icon("i-mail")]));
  }

  /* ---------- хвиля в блоці з цитатою ---------- */
  (function () {
    var c = $("#closing-wave");
    if (!c || !c.getContext) return;
    var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var t0 = 0;
    function frame(ts) {
      var dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
      if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
      var g = c.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      var n = Math.floor(w / 6), time = (ts || 0) / 1000;
      for (var i = 0; i < n; i++) {
        var x = i * 6, u = i / n;
        var env = Math.pow(Math.sin(Math.PI * u), 1.5) * (0.35 + 0.65 * Math.abs(Math.sin(u * 9 + time * 0.6)));
        var bh = Math.max(2, env * h * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.7 + time * 1.3))));
        g.fillStyle = "rgba(185,205,224," + (0.08 + 0.22 * env) + ")";
        g.fillRect(x, (h - bh) / 2, 2, bh);
      }
      if (!still) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    if (still) window.addEventListener("resize", function () { frame(t0); });
  })();

  /* ---------- старт ---------- */
  function load(path) {
    return fetch(path, { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function () { return null; });
  }
  $("#year").textContent = new Date().getFullYear();
  lang = initialLang();
  Promise.all([load("content/settings.json"), load("content/portfolio.json"), load("content/reviews.json"), load("content/about.json")])
    .then(function (res) {
      SETTINGS = res[0] || {};
      PORTFOLIO = (res[1] && res[1].items) || [];
      REVIEWS = (res[2] && res[2].items) || [];
      ABOUT = res[3];
      renderSocials();
      applyLang(lang, false);
    });
})();
