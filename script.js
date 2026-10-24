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
  // Appears once the hero's own CTA has scrolled away; steps aside while the
  // download band or the footer is on screen so it never doubles up.
  let stickyCta = document.querySelector(".sticky-cta");
  let hero = document.querySelector(".hero");
  if (stickyCta && hero && "IntersectionObserver" in window) {
    let pastHero = false;
    let blockers = 0;
    let stickyLink = stickyCta.querySelector("a");
    let render = function () {
      let show = pastHero && blockers === 0;
      stickyCta.classList.toggle("is-shown", show);
      stickyCta.setAttribute("aria-hidden", show ? "false" : "true");
      if (stickyLink) stickyLink.tabIndex = show ? 0 : -1;
    };
    new IntersectionObserver(function (entries) {
      pastHero = !entries[0].isIntersecting;
      render();
    }).observe(hero);
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
