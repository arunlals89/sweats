/* Google Analytics 4 — shared across every page of sweats.in
   Measurement ID comes from Google Analytics → Admin → Data streams.
   Left as a G-XXXX placeholder, nothing loads and no requests are made. */
(function () {
  var GA_MEASUREMENT_ID = "G-8HWQWNRMVE";

  if (!GA_MEASUREMENT_ID || GA_MEASUREMENT_ID.indexOf("XXXX") !== -1) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID, { anonymize_ip: true });

  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_MEASUREMENT_ID);
  document.head.appendChild(s);

  /* Outbound clicks — App Store / Play Store taps are the conversion that matters here. */
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";

    if (/apps\.apple\.com|play\.google\.com/i.test(href)) {
      gtag("event", "app_store_click", {
        store: /play\.google\.com/i.test(href) ? "google_play" : "app_store",
        link_url: href,
        link_text: (a.textContent || "").trim().slice(0, 100)
      });
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
