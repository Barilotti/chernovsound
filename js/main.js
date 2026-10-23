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
  var calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
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

  /* ---------- плавна поява блоків при прокрутці ---------- */
  // Клас .reveal ставить лише скрипт: без JS усе видно одразу. Те, що вже вище екрана, не ховаємо.
  var revealIO = ("IntersectionObserver" in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      revealIO.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px" }) : null;

  // step — затримка між сусідами в групі, щоб вони виходили по черзі
  function reveal(nodes, step) {
    if (!revealIO) return;
    nodes.forEach(function (n, i) {
      if (n.getBoundingClientRect().bottom < 0) return;
      n.classList.add("reveal");
      n.style.setProperty("--d", Math.min(i, 6) * (step || 0.08) + "s");
      revealIO.observe(n);
    });
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
    $all("[data-i18n-label]").forEach(function (n) { n.setAttribute("aria-label", t(n.getAttribute("data-i18n-label"))); });
    $all(".lang-switch button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.lang === lang)); });
    document.title = t("meta.title");
    setMeta('meta[name="description"]', t("meta.description"));
    setMeta('meta[property="og:locale"]', lang === "uk" ? "uk_UA" : "en_US");
    // Кожна мовна версія вказує сама на себе (інакше Google вважає англійську копією української)
    var pageUrl = "https://barilotti.github.io/chernovsound/" + (lang === "uk" ? "" : "?lang=" + lang);
    var canon = $('link[rel="canonical"]'); if (canon) canon.setAttribute("href", pageUrl);
    setMeta('meta[property="og:url"]', pageUrl);
    setMeta('meta[property="og:title"]', t("meta.og"));
    setMeta('meta[name="twitter:title"]', t("meta.og"));
    startRotator();
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

  /* ---------- слово в заголовку: пісень → фільмів → аніме … ---------- */
  var rot = { words: [], i: 0, timer: null };
  function startRotator() {
    var node = $("#hero-rotator");
    if (!node) return;
    clearInterval(rot.timer);
    rot.words = t("hero.words").split("|");
    rot.i = 0;
    node.className = "rotator";
    node.textContent = rot.words[0];
    rot.timer = setInterval(function () {
      node.className = "rotator out";
      setTimeout(function () {
        rot.i = (rot.i + 1) % rot.words.length;
        node.textContent = rot.words[rot.i];
        node.className = "rotator";
        void node.offsetWidth; // перезапуск анімації появи
        node.className = "rotator in";
      }, 400);
    }, 2400);
  }

  $all(".lang-switch button").forEach(function (b) {
    b.addEventListener("click", function () { applyLang(b.dataset.lang, true); });
  });

  /* ---------- портфоліо ---------- */
  var currentAudio = null;

  // Фільтри лише для послуг, де вже є роботи; якщо така послуга одна, фільтри не потрібні
  function renderFilters() {
    var box = $("#portfolio-filters");
    box.innerHTML = "";
    var used = SERVICES.filter(function (id) { return PORTFOLIO.some(function (p) { return services(p).indexOf(id) > -1; }); });
    box.hidden = used.length < 2;
    if (used.indexOf(filter) < 0) filter = "all";
    ["all"].concat(used).forEach(function (id) {
      var b = el("button", { type: "button", class: "chip", role: "tab", "aria-selected": String(filter === id), "data-id": id,
        text: id === "all" ? t("portfolio.all") : t("svc." + id + ".title") });
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

  function serviceLine(item) {
    return services(item).map(function (s) { return t("svc." + s + ".title"); }).join(" · ") + (item.year ? " · " + item.year : "");
  }
  function isAudio(item) { return !item.type || item.type === "audio"; }

  // Відео: обкладинка з кнопкою; autoplay — одразу вмикає
  function mediaBlock(item, autoplay) {
    var box = el("div", { class: "work-media" });
    if (item.type === "youtube" || item.type === "gdrive") {
      var yt = item.type === "youtube", id = yt ? youtubeId(item.youtube) : driveId(item.gdrive);
      var thumb = url(item.cover) || (id ? (yt ? "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg" : "https://drive.google.com/thumbnail?id=" + id + "&sz=w1280") : "");
      if (thumb) {
        var im = el("img", { src: thumb, alt: field(item, "title") || "", loading: "lazy", referrerpolicy: "no-referrer" });
        im.addEventListener("error", function () { im.remove(); });
        box.appendChild(im);
      }
      var start = function () {
        if (!id) { window.open(yt ? item.youtube : item.gdrive, "_blank", "noopener"); return; }
        if (currentAudio) currentAudio.pause();
        box.innerHTML = "";
        var frame = el("iframe", yt ? {
          // enablejsapi: плеєр повідомляє, коли грає і коли на паузі (див. «стан відео з YouTube» нижче)
          src: "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0&enablejsapi=1&origin=" + encodeURIComponent(location.origin),
          title: field(item, "title"), allow: "autoplay; encrypted-media; picture-in-picture", allowfullscreen: ""
        } : {
          src: "https://drive.google.com/file/d/" + id + "/preview",
          title: field(item, "title"), allow: "autoplay; fullscreen", allowfullscreen: ""
        });
        if (yt) frame.addEventListener("load", function () {
          frame.contentWindow.postMessage(JSON.stringify({ event: "listening", id: id, channel: "widget" }), "*");
        });
        box.appendChild(frame);
      };
      var playBtn = el("button", { type: "button", class: "yt-play", "aria-label": t("portfolio.watch") }, [el("span", null, [icon("i-play")])]);
      playBtn.addEventListener("click", start);
      box.appendChild(playBtn);
      if (autoplay) start();
      return box;
    }
    // відеофайл із сайту: фон аналізує його так само, як аудіо
    var attrs = { src: url(item.video), controls: "", preload: "metadata", playsinline: "" };
    if (item.cover) attrs.poster = url(item.cover);
    var video = el("video", attrs);
    video.addEventListener("play", function () {
      if (currentAudio && currentAudio !== video) currentAudio.pause();
      currentAudio = video;
      document.dispatchEvent(new CustomEvent("cs:audio", { detail: video }));
    });
    ["pause", "ended"].forEach(function (ev) {
      video.addEventListener(ev, function () { document.dispatchEvent(new CustomEvent("cs:audio-stop", { detail: video })); });
    });
    box.appendChild(video);
    if (autoplay) { var pr = video.play(); if (pr && pr.catch) pr.catch(function () {}); }
    return box;
  }

  /* ---------- роботи: простий список ---------- */
  // Рядок: кнопка ▶, назва з послугою, праворуч «До / Після» і час.
  // Поки трек грає, нижня лінія рядка стає прогресом (клік перемотує). Відео розгортається під рядком.
  var stopActive = null; // зупиняє попередній рядок: аудіо на паузу, відео згортає

  function setPlayIcon(btn, playing) {
    btn.innerHTML = "";
    btn.appendChild(icon(playing ? "i-pause" : "i-play"));
    btn.classList.toggle("playing", playing);
    btn.setAttribute("aria-label", playing ? t("portfolio.pause") : t("portfolio.play"));
  }

  function audioRow(item, li, btn, side) {
    var audio = new Audio();
    audio.preload = "metadata";
    var srcAfter = url(item.audio), srcBefore = url(item.audio_before), which = "after";
    audio.src = srcAfter;
    var time = el("span", { class: "wtime" });
    var bar = el("span", { class: "wbar" });
    var prog = el("div", { class: "wprog", "aria-hidden": "true" }, [bar]);

    function stop() { audio.pause(); }
    function play() {
      if (stopActive && stopActive !== stop) stopActive();
      stopActive = stop;
      currentAudio = audio;
      // фон блоку «Роботи» (works-bg.js) підхоплює звук; шлемо до play(), поки клік ще рахується жестом
      document.dispatchEvent(new CustomEvent("cs:audio", { detail: audio }));
      var pr = audio.play();
      if (pr && pr.catch) pr.catch(function () {});
    }
    function stopped() {
      setPlayIcon(btn, false);
      li.classList.remove("is-playing");
      time.textContent = fmt(audio.duration);
      document.dispatchEvent(new CustomEvent("cs:audio-stop", { detail: audio }));
    }
    btn.addEventListener("click", function () { if (audio.paused) play(); else audio.pause(); });
    audio.addEventListener("play", function () { setPlayIcon(btn, true); li.classList.add("is-playing"); });
    audio.addEventListener("pause", stopped);
    audio.addEventListener("ended", stopped);
    audio.addEventListener("loadedmetadata", function () { if (audio.paused) time.textContent = fmt(audio.duration); });
    audio.addEventListener("timeupdate", function () {
      bar.style.transform = "scaleX(" + (audio.duration ? audio.currentTime / audio.duration : 0) + ")";
      if (!audio.paused) time.textContent = fmt(audio.currentTime);
    });
    prog.addEventListener("click", function (e) {
      if (!audio.duration) return;
      var r = prog.getBoundingClientRect();
      audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
    });

    if (item.audio_before) {
      var ab = el("div", { class: "wab", role: "group", "aria-label": t("portfolio.compare") });
      [["before", "portfolio.before"], ["after", "portfolio.after"]].forEach(function (pair) {
        var b = el("button", { type: "button", "aria-pressed": String(pair[0] === which), text: t(pair[1]) });
        b.addEventListener("click", function () {
          if (which === pair[0]) return;
          which = pair[0];
          $all("button", ab).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          placeAbPill(ab);
          var pos = audio.currentTime, playing = !audio.paused;
          audio.src = which === "after" ? srcAfter : srcBefore;
          audio.addEventListener("loadedmetadata", function once() {
            audio.removeEventListener("loadedmetadata", once);
            try { audio.currentTime = Math.min(pos, audio.duration || pos); } catch (e) {}
            if (playing) audio.play();
          });
        });
        ab.appendChild(b);
      });
      ab.insertBefore(el("span", { class: "wab-pill", "aria-hidden": "true" }), ab.firstChild);
      side.appendChild(ab);
      // місце плашки відоме лише після того, як рядок потрапив на сторінку і завантажився шрифт
      requestAnimationFrame(function () { placeAbPill(ab); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { placeAbPill(ab); });
    }
    side.appendChild(time);
    li.appendChild(prog);
  }

  // «До / Після»: біла плашка під обраним варіантом, при перемиканні переїжджає
  function placeAbPill(ab) {
    var on = $("button[aria-pressed='true']", ab), pill = $(".wab-pill", ab);
    if (!on || !pill || !on.offsetWidth) return;
    var first = !pill.dataset.placed; // першого разу ставимо без анімації, далі — ковзає
    if (first) pill.style.transition = "none";
    pill.style.width = on.offsetWidth + "px";
    pill.style.transform = "translateX(" + (on.offsetLeft - pill.offsetLeft) + "px)";
    if (first) { void pill.offsetWidth; pill.style.transition = ""; pill.dataset.placed = "1"; }
  }
  window.addEventListener("resize", function () { $all(".wab").forEach(placeAbPill); });

  // Відео виїжджає під рядком і так само плавно від'їжджає; після закриття плеєр прибираємо
  function videoRow(item, li, btn, side) {
    var drawer = null;
    side.appendChild(el("span", { class: "wtime", text: t("portfolio.video") }));
    function close() {
      if (!drawer) return;
      var d = drawer;
      drawer = null;
      d.classList.remove("open");
      var gone = function () { d.remove(); };
      if (calm) gone(); else { d.addEventListener("transitionend", gone, { once: true }); setTimeout(gone, 700); }
      setPlayIcon(btn, false);
      li.classList.remove("is-playing");
    }
    btn.addEventListener("click", function () {
      if (drawer) { close(); stopActive = null; return; }
      if (stopActive) stopActive();
      stopActive = close;
      drawer = el("div", { class: "wdrawer" }, [el("div", { class: "wdrawer-in" }, [mediaBlock(item, true)])]);
      li.appendChild(drawer);
      void drawer.offsetHeight; // зафіксувати закритий стан, щоб спрацював перехід
      drawer.classList.add("open");
      setPlayIcon(btn, true);
      li.classList.add("is-playing");
    });
  }

  var listShown = false; // перший показ — плавна поява при прокрутці, далі (фільтр, мова) рядки в'їжджають збоку

  function renderPortfolio() {
    if (stopActive) { stopActive(); stopActive = null; }
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    var list = $("#portfolio-list");
    list.innerHTML = "";
    var items = PORTFOLIO.filter(function (p) { return filter === "all" || services(p).indexOf(filter) > -1; });
    $("#portfolio-empty").hidden = items.length > 0;
    items.forEach(function (item) {
      var btn = el("button", { type: "button", class: "wplay", "aria-label": t("portfolio.play") }, [icon("i-play")]);
      var meta = el("span", { class: "wmeta" });
      if (item.demo) meta.appendChild(el("span", { class: "badge", text: t("portfolio.demo") }));
      meta.appendChild(el("span", { text: serviceLine(item) }));
      var side = el("div", { class: "wside" });
      var li = el("li", { class: "wrow" }, [
        el("div", { class: "wline" }, [btn, el("div", { class: "winfo" }, [el("h3", { class: "wtitle", text: field(item, "title") }), meta]), side])
      ]);
      if (isAudio(item)) audioRow(item, li, btn, side); else videoRow(item, li, btn, side);
      list.appendChild(li);
    });
    var rows = $all(".wrow", list);
    if (!listShown) { reveal(rows, 0.06); listShown = true; return; }
    if (calm) return;
    rows.forEach(function (r, i) { r.style.setProperty("--d", Math.min(i, 8) * 0.06 + "s"); r.classList.add("slide-in"); });
  }

  /* ---------- послуги: по колу підсвічується одна, від першої до останньої ---------- */
  // Під курсором активна та, що під ним, а коло чекає; коло йде лише поки блок видно
  (function () {
    var list = $all(".services li");
    if (!list.length) return;
    var i = -1, timer = null, hovered = false, visible = false;
    function activate(li) { list.forEach(function (x) { x.classList.toggle("is-active", x === li); }); }
    function next() { i = (i + 1) % list.length; activate(list[i]); }
    function run() {
      if (timer || hovered || !visible || document.hidden || calm) return;
      next();
      timer = setInterval(next, 2600);
    }
    function pause() { clearInterval(timer); timer = null; }
    list.forEach(function (li, k) {
      li.addEventListener("pointerenter", function () { hovered = true; pause(); i = k; activate(li); });
      li.addEventListener("pointerleave", function () { hovered = false; activate(null); run(); });
    });
    document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); else run(); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        visible = en[0].isIntersecting;
        if (visible) run(); else pause();
      }, { threshold: 0.3 }).observe($(".services"));
    } else { visible = true; run(); }
  })();

  /* ---------- стан відео з YouTube ---------- */
  // Звук із YouTube браузер аналізувати не дає, тому фон (works-bg.js) отримує лише «грає / пауза»
  window.addEventListener("message", function (e) {
    if (!/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(e.origin)) return;
    var d;
    try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch (err) { return; }
    if (!d) return;
    var state = d.event === "onStateChange" ? d.info : (d.event === "infoDelivery" && d.info ? d.info.playerState : undefined);
    // 1 — грає, 2 — пауза, 0 — скінчилось; буферизацію та «не почато» пропускаємо, щоб фон не смикався
    if (state !== 0 && state !== 1 && state !== 2) return;
    if (state === 1 && currentAudio) currentAudio.pause();
    document.dispatchEvent(new CustomEvent("cs:video", { detail: { source: e.source, playing: state === 1 } }));
  });

  /* ---------- відгуки ---------- */
  function renderReviews() {
    var list = $("#reviews-list");
    list.innerHTML = "";
    $("#reviews").hidden = REVIEWS.length === 0;
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
    reveal($all(".review", list), 0.1);
  }

  /* ---------- про мене ---------- */
  function renderAbout() {
    var box = $("#about-block");
    box.innerHTML = "";
    box.hidden = !ABOUT;
    if (!ABOUT) return;

    var photo = ABOUT.photo
      ? el("img", { class: "about-photo", src: url(ABOUT.photo), alt: (field(ABOUT, "name") || "CHERNOVsound") + ", " + (field(ABOUT, "role") || "CHERNOVsound"), loading: "lazy" })
      : el("div", { class: "about-photo about-photo-empty", "aria-hidden": "true" }, [icon("i-logo")]);

    var text = el("div", { class: "about-text" });
    var head = el("div", { class: "about-head" }, [el("p", { class: "eyebrow", text: t("about.eyebrow") })]);
    if (ABOUT.demo) head.appendChild(el("span", { class: "badge", text: t("portfolio.demo") }));
    text.appendChild(head);
    // Ім'я великим, під ним підпис; без імені в адмінці — старий заголовок
    var name = field(ABOUT, "name");
    text.appendChild(el("h2", { id: "about-title", class: "about-name", text: name || t("about.title") }));
    var role = field(ABOUT, "role");
    if (role) text.appendChild(el("p", { class: "about-role", text: role }));
    // Перший абзац — вступ, крупніше
    field(ABOUT, "text").split(/\n\s*\n/).filter(function (p) { return p.trim(); }).forEach(function (para, k) {
      text.appendChild(el("p", { class: k ? "about-para" : "about-para about-lead", text: para.trim() }));
    });

    var facts = (ABOUT.facts || []).filter(function (f) { return f && f.value; });
    if (facts.length) {
      var dl = el("dl", { class: "facts" }, facts.map(function (f) {
        return el("div", { class: "fact" }, [el("dt", { text: f.value, "data-value": f.value }), el("dd", { text: field(f, "label") })]);
      }));
      text.appendChild(dl);
      countFacts(dl);
    }
    var write = el("a", { class: "about-write", href: SETTINGS.contact || "https://t.me/ukrainskiygul", target: "_blank", rel: "noopener", "data-contact": "" },
      [el("span", { text: t("about.write") }), icon("i-arrow", "ico")]);
    text.appendChild(write);

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
    reveal([photo, text], 0.15);
  }

  // Цифри «5+», «100+» один раз рахують від нуля, коли блок уперше видно (при зміні мови — одразу готові)
  var factsCounted = false;
  function countFacts(dl) {
    if (factsCounted || calm || !("IntersectionObserver" in window)) return;
    var dts = $all("dt", dl).filter(function (d) { return /\d/.test(d.dataset.value); });
    dts.forEach(function (d) { d.textContent = d.dataset.value.replace(/\d+/, "0"); });
    var io = new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting) return;
      io.disconnect();
      factsCounted = true;
      var t0 = null;
      function step(ts) {
        if (!t0) t0 = ts;
        var k = Math.min(1, (ts - t0) / 1600), e = 1 - Math.pow(1 - k, 3);
        dts.forEach(function (d) {
          var m = d.dataset.value.match(/^(\D*)(\d+)(.*)$/);
          d.textContent = m[1] + Math.round(+m[2] * e) + m[3];
        });
        if (k < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }, { threshold: 0.6 });
    io.observe(dl);
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

  // Кнопки «Написати» / «Обговорити проєкт»: Telegram для зв'язку з адмінки, інакше той, що в index.html
  function renderContact() {
    if (!SETTINGS.contact) return;
    $all("[data-contact]").forEach(function (a) { a.href = SETTINGS.contact; });
  }

  /* ---------- старт ---------- */
  function load(path) {
    // Автономна копія сайту (один HTML-файл) кладе вміст content/*.json прямо в сторінку
    if (window.CS_CONTENT && window.CS_CONTENT[path]) return Promise.resolve(window.CS_CONTENT[path]);
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
      renderContact();
      applyLang(lang, false);
      $all(".section-title").forEach(function (h) { reveal([h]); });
      reveal($all("#portfolio-filters"));
      reveal($all(".services li"), 0.07);
      reveal($all(".contact-inner > *"), 0.1);
    });
})();
