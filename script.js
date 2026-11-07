// Sweats marketing site — nav state, scroll reveal, FAQ accordion.
// No dependencies, no external requests.

(function () {
  let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let nav = document.querySelector(".nav");
  let progressBar = document.querySelector(".scroll-progress span");

  // Cache the scrollable height instead of reading it on every scroll tick —
  // querying scrollHeight right after a classList mutation forces a
  // synchronous layout (a "forced reflow"). Recompute only when the page's
  // height can actually change: on resize, and once more after everything
  // (including lazy-loaded images) has finished loading.
  let scrollMax = 0;
  let updateScrollMax = function () {
    scrollMax = document.documentElement.scrollHeight - window.innerHeight;
  };
  updateScrollMax();
  window.addEventListener("resize", updateScrollMax, { passive: true });
  window.addEventListener("load", updateScrollMax);

  let onScroll = function () {
    if (window.scrollY > 8) {
      nav.classList.add("is-scrolled");
    } else {
      nav.classList.remove("is-scrolled");
    }
    if (progressBar) {
      let pct = scrollMax > 0 ? Math.min(window.scrollY / scrollMax, 1) : 0;
      progressBar.style.transform = "scaleX(" + pct.toFixed(4) + ")";
    }
  };
  if (nav) {
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // ---- active nav link on scroll ----
  let navLinks = document.querySelectorAll(".nav-links a[href^='#']");
  let sections = Array.prototype.slice
    .call(navLinks)
    .map(function (link) {
      return document.querySelector(link.getAttribute("href"));
    })
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    let navIo = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          let link = document.querySelector(".nav-links a[href='#" + entry.target.id + "']");
          if (!link) return;
          if (entry.isIntersecting) {
            navLinks.forEach(function (l) { l.classList.remove("active"); });
            link.classList.add("active");
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    sections.forEach(function (s) { navIo.observe(s); });
  }

  // ---- cursor spotlight on cards/panels ----
  if (!reducedMotion && window.matchMedia("(pointer: fine)").matches) {
    document.addEventListener("mousemove", function (e) {
      let target = e.target.closest(".feature-card, .step, .panel");
      if (!target) return;
      let rect = target.getBoundingClientRect();
      let x = ((e.clientX - rect.left) / rect.width) * 100;
      let y = ((e.clientY - rect.top) / rect.height) * 100;
      target.style.setProperty("--mx", x + "%");
      target.style.setProperty("--my", y + "%");
    });

    // ---- phone tilt ----
    let phoneStage = document.querySelector(".phone-stage");
    if (phoneStage) {
      phoneStage.addEventListener("mousemove", function (e) {
        let rect = phoneStage.getBoundingClientRect();
        let px = (e.clientX - rect.left) / rect.width - 0.5;
        let py = (e.clientY - rect.top) / rect.height - 0.5;
        phoneStage.style.transform =
          "rotateX(" + (py * -10).toFixed(2) + "deg) rotateY(" + (px * 12).toFixed(2) + "deg)";
      });
      phoneStage.addEventListener("mouseleave", function () {
        phoneStage.style.transform = "";
      });
    }

    // ---- glow field parallax ----
    let glowField = document.querySelector(".glow-field");
    if (glowField) {
      let ticking = false;
      window.addEventListener(
        "mousemove",
        function (e) {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(function () {
            let x = (e.clientX / window.innerWidth - 0.5) * 2;
            let y = (e.clientY / window.innerHeight - 0.5) * 2;
            glowField.style.transform = "translate3d(" + (x * 16).toFixed(1) + "px," + (y * 16).toFixed(1) + "px,0)";
            ticking = false;
          });
        },
        { passive: true }
      );
    }
  }

  let toggle = document.querySelector(".nav-toggle");
  let mobileMenu = document.querySelector(".nav-mobile");
  if (toggle && mobileMenu) {
    let setMenu = function (open) {
      mobileMenu.classList.toggle("open", open);
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.documentElement.style.overflow = open ? "hidden" : "";
    };
    toggle.addEventListener("click", function () {
      setMenu(!mobileMenu.classList.contains("open"));
    });
    mobileMenu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () { setMenu(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mobileMenu.classList.contains("open")) setMenu(false);
    });
  }

  let revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach(function (el) {
      io.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  // ---- showcase screenshot resilience ----
  // A flaky connection (mobile data, an in-app browser) can fail one of
  // these <img> loads outright, leaving the browser's raw broken-image
  // glyph sitting inside an otherwise polished phone frame. Retry once
  // with a cache-busting query, then fall back to a plain frame instead
  // of that glyph.
  document.querySelectorAll(".showcase-phone .frame img").forEach(function (img) {
    let retried = false;
    img.addEventListener("error", function () {
      if (!retried) {
        retried = true;
        let src = img.getAttribute("src").split("?")[0];
        img.src = src + "?retry=" + Date.now();
        return;
      }
      img.closest(".frame").classList.add("frame-failed");
    });
  });

  // ---- sticky download bar (phones) ----
  // The phone layout's only "Get the app" button (the header one is hidden
  // there), so it shows from the first screen. Steps aside while the
  // download band or the footer is on screen so it never doubles up.
  let stickyCta = document.querySelector(".sticky-cta");
  if (stickyCta && "IntersectionObserver" in window) {
    let blockers = 0;
    let stickyLink = stickyCta.querySelector("a");
    let render = function () {
      let show = blockers === 0;
      stickyCta.classList.toggle("is-shown", show);
      stickyCta.setAttribute("aria-hidden", show ? "false" : "true");
      if (stickyLink) stickyLink.tabIndex = show ? 0 : -1;
    };
    render();
    let seen = new Set();
    let blockIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target);
      });
      blockers = seen.size;
      render();
    });
    ["#download", "footer"].forEach(function (sel) {
      let el = document.querySelector(sel);
      if (el) blockIo.observe(el);
    });
  }

  document.querySelectorAll(".faq-item").forEach(function (item) {
    let q = item.querySelector(".faq-q");
    let a = item.querySelector(".faq-a");
    q.addEventListener("click", function () {
      let isOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach(function (other) {
        if (other !== item) {
          other.classList.remove("open");
          other.querySelector(".faq-a").style.maxHeight = null;
          other.querySelector(".faq-q").setAttribute("aria-expanded", "false");
        }
      });
      if (isOpen) {
        item.classList.remove("open");
        a.style.maxHeight = null;
      } else {
        item.classList.add("open");
        a.style.maxHeight = a.scrollHeight + "px";
      }
      q.setAttribute("aria-expanded", isOpen ? "false" : "true");
    });
  });
})();

// Hero phone: animated feed. Scrolls post to post, then plays each post's
// moment (route draws, cheers land, bars fill). Loops seamlessly by cloning
// the first two posts; pauses when the hero is off screen or the tab is hidden.
(function () {
  var feed = document.querySelector(".phone-screen--feed");
  if (!feed) return;
  var track = feed.querySelector(".fx-track");
  var posts = Array.prototype.slice.call(track.querySelectorAll(".fx-post"));
  if (!posts.length) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    posts.forEach(function (p) { p.classList.add("is-on"); });
    return;
  }

  track.appendChild(posts[0].cloneNode(true));
  track.appendChild(posts[1].cloneNode(true));
  var clone0 = track.querySelectorAll(".fx-post")[posts.length];
  var stops = posts.concat([clone0]);

  var DWELL = 2900, MOVE = 1150;
  var i = 0, firstLap = true, timer = null, tickTimer = null, running = false, current = null;
  var kmEl = feed.querySelectorAll("[data-live-km]");
  var timeEl = feed.querySelectorAll("[data-live-time]");
  var liveSecs = 32 * 60 + 10, liveKm = 12.4;

  function activate(el) {
    el.classList.add("is-on");
    var c = el.querySelector(".fx-cheer i");
    if (c) setTimeout(function () { if (el.classList.contains("is-on")) c.textContent = +c.dataset.n + 1; }, 950);
    var g = el.querySelector("[data-going]");
    if (g) setTimeout(function () { if (el.classList.contains("is-on")) g.textContent = +g.dataset.going + 1; }, 1050);
  }

  function deactivate(el) {
    if (el === posts[0]) return; // stays "done" so the loop snap back to it is invisible
    el.classList.remove("is-on");
    var c = el.querySelector(".fx-cheer i");
    if (c) c.textContent = c.dataset.n;
    var g = el.querySelector("[data-going]");
    if (g) g.textContent = g.dataset.going;
  }

  function offsetFor(idx) {
    return idx === 0 && firstLap ? 0 : stops[idx].offsetTop;
  }

  function show(idx) {
    var prev = current;
    current = stops[idx];
    track.style.transform = "translate3d(0," + -offsetFor(idx) + "px,0)";
    setTimeout(function () { activate(current); }, idx === 0 && firstLap ? 500 : MOVE - 250);
    if (prev && prev !== current) setTimeout(function () { deactivate(prev); }, MOVE + 50);
  }

  function step() {
    if (!running) return;
    if (current === clone0) {
      // snap back to the real first post (identical frame), then carry on
      firstLap = false;
      track.classList.add("is-snap");
      track.style.transform = "translate3d(0," + -posts[0].offsetTop + "px,0)";
      void track.offsetHeight;
      track.classList.remove("is-snap");
      deactivate(clone0);
      current = posts[0];
      i = 0;
    }
    i += 1;
    show(i);
    timer = setTimeout(step, MOVE + DWELL);
  }

  function tick() {
    if (!running) return;
    liveSecs += 1;
    liveKm += 0.0074;
    var t = Math.floor(liveSecs / 60) + ":" + ("0" + (liveSecs % 60)).slice(-2);
    timeEl.forEach(function (e) { e.textContent = t; });
    kmEl.forEach(function (e) { e.textContent = liveKm.toFixed(2); });
    tickTimer = setTimeout(tick, 1000);
  }

  function start() {
    if (running) return;
    running = true;
    if (!current) { show(0); timer = setTimeout(step, DWELL + 600); }
    else timer = setTimeout(step, 1200);
    tickTimer = setTimeout(tick, 1000);
  }

  function stop() {
    running = false;
    clearTimeout(timer);
    clearTimeout(tickTimer);
  }

  var visible = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      visible && !document.hidden ? start() : stop();
    }).observe(feed);
  } else {
    start();
  }
  document.addEventListener("visibilitychange", function () {
    document.hidden ? stop() : visible && start();
  });
})();
