/* sweats-links — renders shared event and tribe links for people without the
 * app and for link previews.
 *
 * Runs only on sweats.in/e/*, /event/*, /t/* and /community/* (see
 * wrangler.toml); everything else on sweats.in is GitHub Pages, untouched.
 * Installed apps never get here: iOS/Android open those paths in Sweats via
 * Universal/App Links. Browsers, desktop, and the crawlers behind WhatsApp,
 * iMessage and Telegram previews do — and the crawlers read og: tags and run
 * no JavaScript, which is why this has to be a server and not 404.html.
 *
 * Data: get_public_event_page / get_public_tribe_page
 * (mobile/supabase/migrations/365_public_event_pages.sql), called with the
 * publishable key. Anything not renderable (bad id, private, gone, Supabase
 * down) falls back to the origin's deep-link interstitial, 404.html.
 *
 * "I'm going" on an event signs in with phone OTP (Supabase Auth, straight
 * from the browser) and calls web_rsvp_event as that user, so RLS and the
 * attendee triggers apply exactly as in the app.
 */

const ORIGIN = 'https://sweats.in';
const MEDIA_ORIGIN = 'https://media.sweats.in/';
const APP_STORE = 'https://apps.apple.com/in/app/sweats-social-fitness/id6798016318';
const KINDS = { e: 'event', event: 'event', t: 'tribe', community: 'tribe' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CACHE_SECONDS = 60;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const [, seg = '', id = '', extra] = url.pathname.split('/');
    const kind = KINDS[seg.toLowerCase()];
    // ?checkin=1 is the event's QR — only meaningful in the app.
    if (!kind || !UUID.test(id) || extra || !['GET', 'HEAD'].includes(request.method) || url.searchParams.has('checkin')) {
      return passThrough(request, url);
    }

    const canonical = `${ORIGIN}/${kind === 'event' ? 'e' : 't'}/${id.toLowerCase()}`;
    const cacheKey = new Request(`${ORIGIN}/__links/${kind}/${id.toLowerCase()}`);
    const cached = await caches.default.match(cacheKey);
    if (cached) return cached;

    let data;
    try {
      data = kind === 'event'
        ? await rpc(env, 'get_public_event_page', { p_event_id: id })
        : await rpc(env, 'get_public_tribe_page', { p_tribe_id: id });
    } catch (err) {
      console.error(err);
      return passThrough(request, url);
    }

    if (data && data.next_event_id) {
      return Response.redirect(`${ORIGIN}/e/${data.next_event_id}`, 302);
    }
    if (!data || !data.visible) return passThrough(request, url);

    const html = kind === 'event' ? eventPage(data, canonical, env) : tribePage(data, canonical);
    const response = new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': `public, max-age=${CACHE_SECONDS}`,
        'x-robots-tag': 'noindex',
      },
    });
    ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
    return response;
  },
};

/** The origin's own response — on sweats.in that's GitHub Pages; on the
 * workers.dev preview, fetching our own URL would loop, so go to sweats.in. */
function passThrough(request, url) {
  return url.hostname === 'sweats.in' ? fetch(request) : fetch(ORIGIN + url.pathname + url.search);
}

async function rpc(env, fn, args) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${fn} → ${res.status} ${await res.text()}`);
  return res.json();
}

// ── Formatting ───────────────────────────────────────────────────────────

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Cloudflare Image Transformations on media.sweats.in (as in the app's
 * resized-image.ts). JPEG for og:image — preview crawlers don't all take
 * AVIF/WebP, and WhatsApp drops images that are too heavy. */
function sized(url, format) {
  if (!url) return null;
  // Older events/tribes still use Unsplash covers at w=3200 (~1.5 MB).
  if (url.startsWith('https://images.unsplash.com/')) {
    const u = new URL(url);
    u.searchParams.set('w', '1080');
    u.searchParams.set('q', '75');
    if (format === 'jpeg') u.searchParams.set('fm', 'jpg');
    return u.toString();
  }
  if (!url.startsWith(MEDIA_ORIGIN)) return url;
  return `${MEDIA_ORIGIN}cdn-cgi/image/width=1080,quality=75,format=${format},fit=scale-down/${url.slice(MEDIA_ORIGIN.length)}`;
}

const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' });

function when(startIso, endIso) {
  const start = new Date(startIso);
  const day = dayFmt.format(start);
  if (!endIso) return `${day} · ${timeFmt.format(start)}`;
  const end = new Date(endIso);
  const sameDay = dayFmt.format(end) === day;
  return `${day} · ${timeFmt.format(start)} – ${sameDay ? '' : `${dayFmt.format(end)} `}${timeFmt.format(end)}`;
}

function mapsUrl(e) {
  const q = e.latitude != null && e.longitude != null ? `${e.latitude},${e.longitude}` : e.location;
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

// ── Pages ────────────────────────────────────────────────────────────────

function eventPage(e, canonical, env) {
  const timeLine = when(e.event_at, e.ends_at);
  const spotsLeft = e.max_attendees != null ? Math.max(0, e.max_attendees - e.going_count) : null;
  const summary = [timeLine, e.location, `${e.going_count} going`].filter(Boolean).join(' · ');
  const maps = mapsUrl(e);
  const chips = [
    e.repeats_weekly && 'Every week',
    e.women_only && 'Women only',
    e.needs_approval && 'Host approves',
    e.ended && 'Ended',
  ].filter(Boolean);
  const host = e.tribe
    ? `${e.tribe.logo_url ? `<img class="lp-avatar" src="${esc(sized(e.tribe.logo_url, 'auto'))}" alt="" width="28" height="28">` : ''}<span>${esc(e.tribe.name)}${e.tribe.is_verified ? ' <span class="lp-tick" aria-label="Verified">✓</span>' : ''}</span>`
    : e.host
      ? `${e.host.avatar_url ? `<img class="lp-avatar" src="${esc(sized(e.host.avatar_url, 'auto'))}" alt="" width="28" height="28">` : ''}<span>${esc(e.host.name)}${e.host.is_verified ? ' <span class="lp-tick" aria-label="Verified">✓</span>' : ''}</span>`
      : '<span>Sweats</span>';
  const rsvpLabel = e.needs_approval ? 'Request to join' : e.is_full ? 'Join the waitlist' : 'I’m going';

  const body = `
    ${e.image_url ? `<img class="lp-cover" src="${esc(sized(e.image_url, 'auto'))}" alt="" width="1080" height="608">` : ''}
    <div class="lp-body">
      ${chips.length ? `<div class="lp-chips">${chips.map((c) => `<span class="lp-chip">${esc(c)}</span>`).join('')}</div>` : ''}
      <h1>${esc(e.title)}</h1>
      <dl class="lp-facts">
        <div><dt>When</dt><dd>${esc(timeLine)}</dd></div>
        ${e.location ? `<div><dt>Where</dt><dd>${maps ? `<a href="${esc(maps)}" target="_blank" rel="noopener">${esc(e.location)}</a>` : esc(e.location)}</dd></div>` : ''}
        <div><dt>Host</dt><dd class="lp-host">${host}</dd></div>
      </dl>
      <p class="lp-going"><strong id="lp-count">${e.going_count}</strong> going${spotsLeft != null && !e.ended ? ` · ${spotsLeft === 0 ? 'full' : plural(spotsLeft, 'spot', 'spots') + ' left'}` : ''}</p>
      ${e.description ? `<p class="lp-desc">${esc(e.description)}</p>` : ''}
      ${e.ended ? '<p class="lp-note">This one’s over. Open Sweats to see the next one and the photos.</p>' : `
      <div class="lp-actions" id="lp-actions">
        <button class="btn btn-primary" id="lp-rsvp" type="button">${esc(rsvpLabel)}</button>
        <a class="btn btn-ghost" id="lp-open" href="sweats://event/${esc(e.id)}">Open in Sweats</a>
      </div>
      <form class="lp-form" id="lp-form" hidden novalidate>
        <div id="lp-step-phone">
          <label for="lp-name">Your name</label>
          <input id="lp-name" name="name" autocomplete="name" maxlength="60" required>
          <label for="lp-phone">Phone number</label>
          <div class="lp-phone"><span>+91</span><input id="lp-phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="14" placeholder="98765 43210" required></div>
          <button class="btn btn-primary" id="lp-send" type="submit">Send code</button>
          <p class="lp-fine">We’ll text you a code. Same number as the app, so this RSVP is waiting for you there.</p>
        </div>
        <div id="lp-step-code" hidden>
          <label for="lp-code" id="lp-code-label">Enter the code</label>
          <input id="lp-code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required>
          <button class="btn btn-primary" id="lp-verify" type="submit">Confirm</button>
          <button class="lp-link" id="lp-back" type="button">Use a different number</button>
        </div>
      </form>`}
      <p class="lp-status" id="lp-status" role="status" aria-live="polite"></p>
      <a class="btn ${e.ended ? 'btn-primary' : 'btn-ghost'} lp-store" id="lp-store" href="${APP_STORE}" target="_blank" rel="noopener">Get the app — it’s free</a>
    </div>`;

  const config = {
    entity: 'event',
    id: e.id,
    supabaseUrl: env.SUPABASE_URL,
    key: env.SUPABASE_KEY,
    needsApproval: !!e.needs_approval,
    isFull: !!e.is_full,
  };
  return shell({
    title: e.title,
    description: summary,
    canonical,
    image: sized(e.image_url, 'jpeg'),
    body,
    script: e.ended ? OPEN_SCRIPT : OPEN_SCRIPT + RSVP_SCRIPT,
    config,
  });
}

function tribePage(t, canonical) {
  const chips = [t.is_verified && 'Verified', t.women_only && 'Women only', t.category].filter(Boolean);
  const summary = [plural(t.member_count, 'member', 'members'), t.location, t.category].filter(Boolean).join(' · ');
  const events = (t.events || []).map((ev) => `
      <li><a href="/e/${esc(ev.id)}"><strong>${esc(ev.title)}</strong><span>${esc(when(ev.event_at, null))}${ev.location ? ` · ${esc(ev.location)}` : ''}</span></a></li>`).join('');
  const cover = t.image_url || t.logo_url;
  const body = `
    ${cover ? `<img class="lp-cover" src="${esc(sized(cover, 'auto'))}" alt="" width="1080" height="608">` : ''}
    <div class="lp-body">
      ${chips.length ? `<div class="lp-chips">${chips.map((c) => `<span class="lp-chip">${esc(c)}</span>`).join('')}</div>` : ''}
      <h1>${esc(t.name)}</h1>
      <p class="lp-going"><strong>${t.member_count}</strong> ${t.member_count === 1 ? 'member' : 'members'}${t.location ? ` · ${esc(t.location)}` : ''}</p>
      ${t.description ? `<p class="lp-desc">${esc(t.description)}</p>` : ''}
      ${events ? `<h2>Coming up</h2><ul class="lp-events">${events}</ul>` : ''}
      <div class="lp-actions">
        <a class="btn btn-primary" id="lp-open" href="sweats://community/${esc(t.id)}">Join in Sweats</a>
        <a class="btn btn-ghost" id="lp-store" href="${APP_STORE}" target="_blank" rel="noopener">Get the app — it’s free</a>
      </div>
    </div>`;
  return shell({
    title: t.name,
    description: summary || 'A tribe on Sweats',
    canonical,
    image: sized(cover, 'jpeg'),
    body,
    script: OPEN_SCRIPT,
    config: { entity: 'community', id: t.id },
  });
}

function shell({ title, description, canonical, image, body, script, config }) {
  const ogImage = image || `${ORIGIN}/assets/og-image.png`;
  // JSON inside <script>: a "</script>" in any value would end the block.
  const json = JSON.stringify(config).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)} · Sweats</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="noindex">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Sweats">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#060706">
<meta name="apple-itunes-app" content="app-id=6798016318, app-argument=${esc(canonical)}">
<link rel="icon" href="/assets/favicon.png?v=2">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/Gilroy-Bold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/styles.css">
<style>${STYLES}</style>
<script src="/analytics.js" defer></script>
</head>
<body>
<div class="glow-field" aria-hidden="true"><span class="g1"></span><span class="g2"></span><span class="g3"></span></div>
<div class="noise" aria-hidden="true"></div>
<main class="lp-wrap">
  <article class="lp-card">${body}
  </article>
  <p class="lp-foot"><a href="/">sweats.in</a> · Move with your people</p>
</main>
<script type="application/json" id="lp-cfg">${json}</script>
<script>${script}</script>
</body>
</html>`;
}

// Page-local styles on top of /styles.css (tokens, .btn, .glow-field).
const STYLES = `
[hidden] { display: none !important; }
.lp-wrap { min-height: 100svh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 28px 16px 24px; }
.lp-card { width: 100%; max-width: 460px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; backdrop-filter: blur(12px); }
.lp-cover { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; background: var(--bg-elevated); }
.lp-body { padding: 22px 22px 26px; display: flex; flex-direction: column; gap: 14px; }
.lp-body h1 { font-size: 26px; line-height: 1.2; letter-spacing: -0.02em; margin: 0; overflow-wrap: anywhere; }
.lp-body h2 { font-size: 15px; margin: 6px 0 0; color: var(--text-dim); font-weight: 600; }
.lp-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.lp-chip { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border-strong); color: var(--accent); }
.lp-facts { margin: 0; display: grid; gap: 10px; }
.lp-facts div { display: grid; grid-template-columns: 56px 1fr; gap: 12px; align-items: center; }
.lp-facts dt { font-size: 13px; color: var(--text-faint); }
.lp-facts dd { margin: 0; font-size: 15px; overflow-wrap: anywhere; }
.lp-facts a { color: var(--text); text-decoration: underline; text-decoration-color: var(--border-strong); text-underline-offset: 3px; }
.lp-host { display: flex; align-items: center; gap: 8px; }
.lp-avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; background: var(--bg-elevated); }
.lp-tick { color: var(--brand); font-weight: 700; }
.lp-going { margin: 0; color: var(--text-dim); font-size: 15px; }
.lp-going strong { color: var(--text); }
.lp-desc { margin: 0; color: var(--text-dim); font-size: 15px; line-height: 1.55; white-space: pre-line; overflow-wrap: anywhere; }
.lp-note { margin: 0; color: var(--text-dim); font-size: 15px; }
.lp-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
.lp-actions .btn, .lp-store, .lp-form .btn { width: 100%; }
.lp-store { margin-top: 2px; }
.lp-form { display: flex; flex-direction: column; }
.lp-form > div { display: flex; flex-direction: column; gap: 8px; }
.lp-form label { font-size: 13px; color: var(--text-dim); margin-top: 4px; }
.lp-form input { height: 48px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong); background: var(--bg-elevated); color: var(--text); font: inherit; font-size: 16px; padding: 0 14px; width: 100%; }
.lp-form input:focus { outline: 2px solid var(--brand); outline-offset: 1px; }
.lp-phone { display: flex; align-items: center; gap: 8px; }
.lp-phone span { color: var(--text-dim); font-size: 16px; }
.lp-form .btn { margin-top: 8px; }
.lp-fine { margin: 2px 0 0; font-size: 12.5px; color: var(--text-faint); line-height: 1.5; }
.lp-link { background: none; border: 0; color: var(--text-dim); font: inherit; font-size: 14px; padding: 8px; cursor: pointer; text-decoration: underline; }
.lp-status { margin: 0; font-size: 14.5px; color: var(--accent); min-height: 0; }
.lp-status:empty { display: none; }
.lp-status.bad { color: var(--danger); }
.lp-events { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.lp-events a { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border); color: var(--text); }
.lp-events span { font-size: 13px; color: var(--text-dim); }
.lp-foot { margin: 18px 0 0; font-size: 13px; color: var(--text-faint); }
.lp-foot a { color: var(--text-dim); }
button[disabled] { opacity: 0.6; pointer-events: none; }
`;

// "Open in Sweats" / "Get the app": same rules as 404.html — Android gets an
// intent: URL that falls back to the Play listing, in-app browsers (which
// swallow Universal Links) get one automatic try.
const OPEN_SCRIPT = `
(function () {
  var cfg = JSON.parse(document.getElementById('lp-cfg').textContent);
  var ua = navigator.userAgent || '';
  var open = document.getElementById('lp-open');
  var store = document.getElementById('lp-store');
  if (/Android/i.test(ua)) {
    if (open) open.href = 'intent://' + cfg.entity + '/' + cfg.id + '#Intent;scheme=sweats;package=in.sweats.sweats;S.browser_fallback_url=' + encodeURIComponent('https://play.google.com/store/apps/details?id=in.sweats.sweats') + ';end';
    if (store) store.href = '/android';
  }
  if (open && /(FBAN|FBAV|Instagram|Line|Twitter|Snapchat|LinkedInApp|Pinterest)/i.test(ua)) {
    setTimeout(function () { window.location.href = open.href; }, 250);
  }
})();
`;

// RSVP: phone OTP against Supabase Auth, then web_rsvp_event as that user.
// The session is kept (localStorage) until it expires, so a second RSVP from
// the same browser skips the code.
const RSVP_SCRIPT = `
(function () {
  var cfg = JSON.parse(document.getElementById('lp-cfg').textContent);
  var $ = function (id) { return document.getElementById(id); };
  var form = $('lp-form'), rsvpBtn = $('lp-rsvp'), status = $('lp-status');
  var stepPhone = $('lp-step-phone'), stepCode = $('lp-step-code');
  var SESSION_KEY = 'sweats.web.session';
  var phone = '';

  function say(msg, bad) { status.textContent = msg || ''; status.className = 'lp-status' + (bad ? ' bad' : ''); }
  function busy(btn, label) { btn.disabled = !!label; if (label) { btn.dataset.label = btn.textContent; btn.textContent = label; } else if (btn.dataset.label) { btn.textContent = btn.dataset.label; } }
  function loadSession() { try { var s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); return s && s.exp > Date.now() + 60000 ? s : null; } catch (e) { return null; } }
  function saveSession(s) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {} }
  function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }
  function normalize(raw) {
    var d = String(raw || '').replace(/\\D/g, '');
    if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
    if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
    return /^[6-9]\\d{9}$/.test(d) ? d : null;
  }
  function api(path, body, token) {
    var headers = { apikey: cfg.key, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch(cfg.supabaseUrl + path, { method: 'POST', headers: headers, body: JSON.stringify(body) })
      .then(function (res) {
        return res.text().then(function (text) {
          var data = null; try { data = text ? JSON.parse(text) : null; } catch (e) {}
          if (!res.ok) { var err = new Error((data && (data.msg || data.message || data.error_description)) || 'Request failed'); err.status = res.status; err.data = data || {}; throw err; }
          return data;
        });
      });
  }
  function showStep(which) {
    form.hidden = false;
    stepPhone.hidden = which !== 'phone';
    stepCode.hidden = which !== 'code';
    (which === 'phone' ? $('lp-name') : $('lp-code')).focus();
  }

  function done(result) {
    form.hidden = true;
    $('lp-actions').hidden = true;
    var store = $('lp-store');
    store.className = 'btn btn-primary lp-store';
    if (result.status === 'joined') {
      if (!result.already) { var c = $('lp-count'); c.textContent = String(Number(c.textContent) + 1); }
      say(result.already ? 'You’re already going. Get the app for the reminder and the group chat.' : 'You’re going! Get the app for the reminder and the group chat.');
    } else {
      say(cfg.needsApproval ? 'Request sent. The host will let you know.' : 'You’re on the waitlist. We’ll tell you if a spot opens up.');
    }
  }

  function rsvp(session) {
    busy(rsvpBtn, 'Saving…');
    return api('/rest/v1/rpc/web_rsvp_event', { p_event_id: cfg.id, p_name: ($('lp-name').value || '').trim() || null }, session.token)
      .then(done)
      .catch(function (err) {
        busy(rsvpBtn);
        if (err.status === 401) { clearSession(); showStep('phone'); say('Please confirm your number again.', true); return; }
        var d = err.data || {};
        if (d.hint === 'women_only') say('This event is for women only.', true);
        else if (/row-level security/i.test(d.message || '')) say('This event has already ended.', true);
        else say('Couldn’t save your RSVP. Please try again.', true);
      });
  }

  rsvpBtn.addEventListener('click', function () {
    say('');
    var session = loadSession();
    if (session) rsvp(session); else showStep('phone');
  });

  $('lp-back').addEventListener('click', function () { say(''); showStep('phone'); });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    say('');
    if (!stepPhone.hidden) {
      var name = ($('lp-name').value || '').trim();
      var digits = normalize($('lp-phone').value);
      if (name.length < 2) { say('Add your name so the host knows who’s coming.', true); $('lp-name').focus(); return; }
      if (!digits) { say('Enter a 10-digit Indian mobile number.', true); $('lp-phone').focus(); return; }
      phone = '+91' + digits;
      var send = $('lp-send');
      busy(send, 'Sending…');
      api('/auth/v1/otp', { phone: phone, create_user: true, channel: 'sms', data: { full_name: name } })
        .then(function () {
          busy(send);
          $('lp-code-label').textContent = 'Enter the code sent to +91 ' + digits.slice(0, 5) + ' ' + digits.slice(5);
          showStep('code');
        })
        .catch(function (err) {
          busy(send);
          say(err.status === 429 ? 'Too many codes asked for. Try again in a few minutes.' : 'Couldn’t send the code. Check the number and try again.', true);
        });
      return;
    }
    var code = ($('lp-code').value || '').replace(/\\D/g, '');
    if (code.length < 6) { say('Enter the 6-digit code.', true); $('lp-code').focus(); return; }
    var verify = $('lp-verify');
    busy(verify, 'Checking…');
    api('/auth/v1/verify', { type: 'sms', phone: phone, token: code })
      .then(function (data) {
        busy(verify);
        var session = { token: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 };
        saveSession(session);
        return rsvp(session);
      })
      .catch(function (err) {
        busy(verify);
        say(err.status === 429 ? 'Too many tries. Wait a minute and try again.' : 'That code didn’t work. Check it, or use a different number.', true);
      });
  });
})();
`;
