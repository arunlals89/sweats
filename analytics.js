/* Shared by every page of sweats.in: one-tap store links + Google Analytics 4.
   Measurement ID comes from Google Analytics → Admin → Data streams.
   Left as a G-XXXX placeholder, nothing loads and no requests are made. */

/* One-tap download: every "Get the app" button ([data-get-app]) opens the
   App Store on iPhone/iPad and Google Play on Android directly, instead of
   scrolling to the download band, which stays the target on desktop. */
(function () {
  var APP_STORE = "https://apps.apple.com/in/app/sweats-social-fitness/id6798016318";
  var PLAY_STORE = "https://play.google.com/store/apps/details?id=in.sweats.sweats";
  var isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(navigator.userAgent);
  if (!isIOS && !isAndroid) return;
  var store = isIOS ? APP_STORE : PLAY_STORE;
  document.querySelectorAll("[data-get-app]").forEach(function (a) {
    a.href = store;
    a.target = "_blank";
    a.rel = "noopener";
  });
})();

(function () {
  var GA_MEASUREMENT_ID = "G-8HWQWNRMVE";

  if (!GA_MEASUREMENT_ID || GA_MEASUREMENT_ID.indexOf("XXXX") !== -1) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID, { anonymize_ip: true });

  /* gtag.js is ~150 KB of script. Calls above queue in dataLayer, so it can
     load after the page has finished rendering without losing the pageview. */
  var loadGtag = function () {
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_MEASUREMENT_ID);
    document.head.appendChild(s);
  };
  if (document.readyState === "complete") loadGtag();
  else window.addEventListener("load", loadGtag, { once: true });

  /* Which button was it? A data-cta on the link or an ancestor names it
     (hero, nav, menu, sticky_bar, download); otherwise the enclosing
     section's id, so story and feature pages report something useful too. */
  var ctaLocation = function (a) {
    var tagged = a.closest("[data-cta]");
    if (tagged) return tagged.getAttribute("data-cta");
    var block = a.closest("section[id], header, nav, footer, article");
    if (!block) return "page";
    return block.id || block.tagName.toLowerCase();
  };

  /* Outbound clicks — store taps (App Store, Google Play) are the conversion that matters here. */
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";

    var store = /apps\.apple\.com/i.test(href) ? "app_store"
      : /play\.google\.com/i.test(href) ? "google_play"
      : /\.apk(\?|$)/i.test(href) ? "android_apk"
      : null;
    if (store) {
      gtag("event", "app_store_click", {
        store: store,
        cta_location: ctaLocation(a),
        link_url: href,
        link_text: (a.textContent || "").trim().slice(0, 100)
      });
      return;
    }

    /* "Get the app" taps that scroll to the download band (desktop):
       the first step of the funnel, before a store badge is chosen. */
    if (a.hasAttribute("data-get-app")) {
      gtag("event", "get_app_click", { cta_location: ctaLocation(a) });
      return;
    }

    if (/^https?:/i.test(href) && a.hostname && a.hostname !== window.location.hostname) {
      gtag("event", "click", {
        link_url: href,
        link_domain: a.hostname,
        outbound: true
      });
    }
  }, true);
})();
