// Sweats marketing site — nav state, scroll reveal, FAQ accordion.
// No dependencies, no external requests.

(function () {
  let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let nav = document.querySelector(".nav");
  let progressBar = document.querySelector(".scroll-progress span");
  let onScroll = function () {
    if (window.scrollY > 8) {
      nav.classList.add("is-scrolled");
    } else {
      nav.classList.remove("is-scrolled");
    }
    if (progressBar) {
      let max = document.documentElement.scrollHeight - window.innerHeight;
      let pct = max > 0 ? (window.scrollY / max) * 100 : 0;
      progressBar.style.width = pct + "%";
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
    toggle.addEventListener("click", function () {
      mobileMenu.classList.toggle("open");
      toggle.classList.toggle("open");
    });
    mobileMenu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        mobileMenu.classList.remove("open");
        toggle.classList.remove("open");
      });
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

  // ---- AI showcase tabs ----
  let aiTabs = document.querySelectorAll(".ai-tab");
  let aiPanels = document.querySelectorAll(".ai-panel");
  aiTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      let target = tab.getAttribute("data-tab");
      aiTabs.forEach(function (t) {
        t.classList.toggle("is-active", t === tab);
        t.setAttribute("aria-selected", t === tab ? "true" : "false");
      });
      aiPanels.forEach(function (panel) {
        panel.classList.toggle("is-active", panel.getAttribute("data-panel") === target);
      });
    });
  });

  document.querySelectorAll(".faq-item").forEach(function (item) {
    let q = item.querySelector(".faq-q");
    let a = item.querySelector(".faq-a");
    q.addEventListener("click", function () {
      let isOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach(function (other) {
        if (other !== item) {
          other.classList.remove("open");
          other.querySelector(".faq-a").style.maxHeight = null;
        }
      });
      if (isOpen) {
        item.classList.remove("open");
        a.style.maxHeight = null;
      } else {
        item.classList.add("open");
        a.style.maxHeight = a.scrollHeight + "px";
      }
    });
  });
})();
