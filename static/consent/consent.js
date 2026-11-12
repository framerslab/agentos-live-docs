/*
 * Analytics choices for agentos.sh and docs.agentos.sh.
 *
 * The same file ships in both sites: agentos.sh serves it from public/consent/consent.js and
 * docs.agentos.sh from static/consent/consent.js. Keep the two copies identical.
 *
 * The <script> tag that loads this file configures it:
 *   data-ga       Google Analytics 4 measurement id. Without it the Measurement purpose is not offered.
 *   data-clarity  Microsoft Clarity project id. Without it the Session recordings purpose is not offered.
 *   data-policy   address of the cookie policy
 *   data-site     the site's name, as the bar's words use it
 *
 * Purposes, stored under localStorage "analytics_consent_purposes":
 *   measure  Google Analytics
 *   record   Microsoft Clarity
 * Each is off until the visitor turns it on. No request goes to Google or Microsoft before its purpose
 * is on. A browser that sends Global Privacy Control or Do Not Track gets neither, and no bar.
 * Any element with a data-analytics-choices attribute reopens the choices.
 */
(function () {
  'use strict';
  if (window.agentosConsent) return;

  var KEY = 'analytics_consent_purposes';
  var LEGACY_KEY = 'agentos-cookie-consent';
  var VERSION = '2026-11-11';
  var GOOGLE_COOKIES = ['_ga', '_gid', '_gat'];
  var CLARITY_COOKIES = ['_clck', '_clsk'];

  var script = document.currentScript || document.querySelector('script[src*="/consent/consent.js"]');
  var data = (script && script.dataset) || {};
  var ids = { measure: (data.ga || '').trim(), record: (data.clarity || '').trim() };
  var policy = data.policy || '/legal/cookies';
  var site = data.site || location.hostname;

  var PURPOSES = [];
  if (ids.measure) {
    PURPOSES.push({
      key: 'measure',
      name: 'Measurement',
      text: 'Google Analytics counts visits, the pages read and where visitors came from. It sets the _ga cookies.',
    });
  }
  if (ids.record) {
    PURPOSES.push({
      key: 'record',
      name: 'Session recordings',
      text: 'Microsoft Clarity records clicks and scrolling, with all page text masked. It sets the _clck and _clsk cookies.',
    });
  }

  function none() {
    return { measure: false, record: false };
  }

  function signalOff() {
    var n = navigator;
    return n.globalPrivacyControl === true || n.doNotTrack === '1' || n.doNotTrack === 'yes' || window.doNotTrack === '1';
  }

  // The choice made on this page, kept in memory too, so it holds here when storage is blocked.
  var remembered = null;

  function readStored() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return remembered;
      var value = JSON.parse(raw);
      if (!value || typeof value.purposes !== 'object' || value.purposes === null) return null;
      return { measure: value.purposes.measure === true, record: value.purposes.record === true };
    } catch (e) {
      return remembered;
    }
  }

  function effective() {
    if (signalOff()) return none();
    return readStored() || none();
  }

  function store(purposes) {
    remembered = { measure: purposes.measure === true, record: purposes.record === true };
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          purposes: { measure: purposes.measure === true, record: purposes.record === true },
          chosenAt: new Date().toISOString(),
          version: VERSION,
        }),
      );
      localStorage.removeItem(LEGACY_KEY);
    } catch (e) {
      /* Storage blocked: the choice holds for this page only. */
    }
  }

  // A vendor may write its cookie host-only or on any parent domain (Google Analytics writes _ga on
  // the top domain it can reach), so the cookie is expired once without a domain and once on each
  // parent domain. A domain the browser refuses is ignored.
  function dropCookie(name) {
    var parts = location.hostname.split('.');
    var domains = [''];
    for (var i = 0; i < parts.length - 1; i++) domains.push('; domain=.' + parts.slice(i).join('.'));
    for (var j = 0; j < domains.length; j++) {
      document.cookie = name + '=; Max-Age=0; path=/' + domains[j];
    }
  }

  // Removes every cookie named exactly as a prefix or starting with prefix + "_" (_ga_<property id>).
  function clearCookies(prefixes) {
    var cookies = document.cookie ? document.cookie.split(';') : [];
    for (var i = 0; i < cookies.length; i++) {
      var name = cookies[i].split('=')[0].trim();
      for (var j = 0; j < prefixes.length; j++) {
        if (name === prefixes[j] || name.indexOf(prefixes[j] + '_') === 0) {
          dropCookie(name);
          break;
        }
      }
    }
  }

  var loaded = { measure: false, record: false };
  var clarityStopped = false;

  function startGoogle(id) {
    window['ga-disable-' + id] = false;
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') {
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
    }
    if (loaded.measure) {
      window.gtag('consent', 'update', { analytics_storage: 'granted' });
      return;
    }
    loaded.measure = true;
    window.gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted',
    });
    window.gtag('js', new Date());
    window.gtag('config', id, { allow_google_signals: false, allow_ad_personalization_signals: false });
    var tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(tag);
  }

  // Google's documented opt-out: with window['ga-disable-<id>'] true, gtag.js sends nothing more.
  function stopGoogle(id) {
    if (id) window['ga-disable-' + id] = true;
    if (typeof window.gtag === 'function') window.gtag('consent', 'update', { analytics_storage: 'denied' });
    clearCookies(GOOGLE_COOKIES);
  }

  function startClarity(id) {
    document.body.setAttribute('data-clarity-mask', 'True');
    if (!loaded.record) {
      loaded.record = true;
      window.clarity =
        window.clarity ||
        function () {
          (window.clarity.q = window.clarity.q || []).push(arguments);
        };
      var tag = document.createElement('script');
      tag.async = true;
      tag.src = 'https://www.clarity.ms/tag/' + encodeURIComponent(id);
      document.head.appendChild(tag);
    } else if (clarityStopped) {
      // Turned off and on again on the same page: stop ended the recording, so start resumes it.
      window.clarity('start');
    }
    clarityStopped = false;
    window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' });
  }

  // consentv2 with analytics_Storage denied makes Clarity drop its cookies; stop ends the recording on
  // this page, which otherwise carries on cookieless until a full page load.
  function stopClarity() {
    if (typeof window.clarity === 'function') {
      window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' });
      if (loaded.record && !clarityStopped) {
        window.clarity('stop');
        clarityStopped = true;
      }
    }
    clearCookies(CLARITY_COOKIES);
  }

  function apply(purposes) {
    if (purposes.measure && ids.measure) startGoogle(ids.measure);
    else stopGoogle(ids.measure);
    if (purposes.record && ids.record) startClarity(ids.record);
    else stopClarity();
  }

  var STYLE =
    '.aoc{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;padding:12px;pointer-events:none;' +
    'font:15px/1.5 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;' +
    '--aoc-bg:#ffffff;--aoc-fg:#0f172a;--aoc-muted:#475569;--aoc-line:#cbd5e1;--aoc-soft:#f1f5f9;--aoc-on:#4f46e5;--aoc-focus:#4f46e5}' +
    'html.dark .aoc,html[data-theme="dark"] .aoc{--aoc-bg:#0b1120;--aoc-fg:#e2e8f0;--aoc-muted:#a5b4c8;--aoc-line:#334155;--aoc-soft:#111a2e;--aoc-on:#818cf8;--aoc-focus:#a5b4fc}' +
    '@media (prefers-color-scheme:dark){html:not(.light):not([data-theme="light"]) .aoc{--aoc-bg:#0b1120;--aoc-fg:#e2e8f0;--aoc-muted:#a5b4c8;--aoc-line:#334155;--aoc-soft:#111a2e;--aoc-on:#818cf8;--aoc-focus:#a5b4fc}}' +
    '.aoc-card{pointer-events:auto;box-sizing:border-box;max-width:44rem;max-height:calc(100vh - 24px);overflow:auto;margin:0 auto;padding:14px 16px;' +
    'background:var(--aoc-bg);color:var(--aoc-fg);border:1px solid var(--aoc-line);border-radius:14px;box-shadow:0 10px 30px rgba(15,23,42,.18)}' +
    '.aoc-title{margin:0 0 4px;font-size:16px;font-weight:650;line-height:1.3;color:var(--aoc-fg)}' +
    '.aoc-text{margin:0;font-size:14px;color:var(--aoc-muted)}' +
    '.aoc-link{display:inline-flex;align-items:center;min-height:44px;font-size:14px;color:var(--aoc-fg);text-decoration:underline;text-underline-offset:3px}' +
    '.aoc-rows{margin:10px 0 0;padding:0;list-style:none;display:grid;gap:8px}' +
    '.aoc-row{display:flex;align-items:center;gap:12px;padding:8px 12px;border-radius:10px;background:var(--aoc-soft)}' +
    '.aoc-row-text{flex:1;min-width:0}' +
    '.aoc-row-name{display:block;font-size:14px;font-weight:600;color:var(--aoc-fg)}' +
    '.aoc-row-note{display:block;font-size:13px;color:var(--aoc-muted)}' +
    '.aoc-always{font-size:13px;font-weight:600;color:var(--aoc-fg);white-space:nowrap}' +
    '.aoc-switch{flex:none;display:inline-flex;align-items:center;justify-content:center;width:56px;height:44px;padding:0;border:0;background:none;cursor:pointer}' +
    '.aoc-track{position:relative;width:44px;height:26px;border-radius:13px;background:var(--aoc-line);transition:background .15s}' +
    '.aoc-track::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.3);transition:transform .15s}' +
    '.aoc-switch[aria-checked="true"] .aoc-track{background:var(--aoc-on)}' +
    '.aoc-switch[aria-checked="true"] .aoc-track::after{transform:translateX(18px)}' +
    '.aoc-keys{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}' +
    '.aoc-key{min-height:44px;padding:4px 8px;border:1px solid var(--aoc-fg);border-radius:10px;background:var(--aoc-bg);color:var(--aoc-fg);' +
    'font:inherit;font-size:14px;font-weight:600;line-height:1.2;cursor:pointer}' +
    '.aoc-key:hover{background:var(--aoc-soft)}' +
    '.aoc-key:focus-visible,.aoc-switch:focus-visible,.aoc-link:focus-visible{outline:3px solid var(--aoc-focus);outline-offset:2px}' +
    '.aoc-keys-one{grid-template-columns:minmax(0,1fr)}' +
    '@media (prefers-reduced-motion:reduce){.aoc-track,.aoc-track::after{transition:none}}' +
    '@media print{.aoc{display:none}}';

  var root = null;
  var draft = none();
  var expanded = false;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function opener() {
    var names = [];
    if (ids.measure) names.push('Google Analytics counts visits');
    if (ids.record) names.push('Microsoft Clarity records how pages are used');
    var both = names.length > 1 ? 'Both stay' : 'It stays';
    return 'With your yes, ' + names.join(' and ') + ', so we can see what to fix on ' + site + '. ' + both + ' off until you choose.';
  }

  function close() {
    if (root) root.remove();
    root = null;
    expanded = false;
  }

  function decide(purposes) {
    store(purposes);
    apply(purposes);
    close();
    try {
      window.dispatchEvent(new CustomEvent('agentos:consent', { detail: purposes }));
    } catch (e) {
      /* old browsers */
    }
  }

  function key(label, onPress) {
    var button = el('button', 'aoc-key', label);
    button.type = 'button';
    button.addEventListener('click', onPress);
    return button;
  }

  function renderSignal(card) {
    card.appendChild(
      el(
        'p',
        'aoc-text',
        'Your browser asks sites not to track you (Global Privacy Control or Do Not Track), so Google Analytics and Microsoft Clarity stay off on ' +
          site +
          '.',
      ),
    );
    var keys = el('div', 'aoc-keys aoc-keys-one');
    keys.appendChild(key('Close', close));
    card.appendChild(keys);
  }

  function renderRows(card) {
    var list = el('ul', 'aoc-rows');
    var fixed = el('li', 'aoc-row');
    var fixedText = el('span', 'aoc-row-text');
    fixedText.appendChild(el('span', 'aoc-row-name', 'Strictly necessary'));
    fixedText.appendChild(el('span', 'aoc-row-note', 'Keeps this choice and your light or dark theme on this device.'));
    fixed.appendChild(fixedText);
    fixed.appendChild(el('span', 'aoc-always', 'Always on'));
    list.appendChild(fixed);

    PURPOSES.forEach(function (purpose) {
      var row = el('li', 'aoc-row');
      var text = el('span', 'aoc-row-text');
      var nameId = 'aoc-' + purpose.key + '-name';
      var name = el('span', 'aoc-row-name', purpose.name);
      name.id = nameId;
      var note = el('span', 'aoc-row-note', purpose.text);
      note.id = 'aoc-' + purpose.key + '-note';
      text.appendChild(name);
      text.appendChild(note);
      var toggle = el('button', 'aoc-switch');
      toggle.type = 'button';
      toggle.setAttribute('role', 'switch');
      toggle.setAttribute('aria-labelledby', nameId);
      toggle.setAttribute('aria-describedby', note.id);
      toggle.setAttribute('aria-checked', draft[purpose.key] ? 'true' : 'false');
      toggle.setAttribute('data-purpose', purpose.key);
      toggle.appendChild(el('span', 'aoc-track'));
      toggle.addEventListener('click', function () {
        draft[purpose.key] = !draft[purpose.key];
        toggle.setAttribute('aria-checked', draft[purpose.key] ? 'true' : 'false');
      });
      row.appendChild(text);
      row.appendChild(toggle);
      list.appendChild(row);
    });
    card.appendChild(list);
  }

  function render(focusFirstSwitch) {
    if (!document.getElementById('aoc-style')) {
      var style = el('style');
      style.id = 'aoc-style';
      style.textContent = STYLE;
      document.head.appendChild(style);
    }
    if (root) root.remove();
    root = el('section', 'aoc');
    root.setAttribute('aria-label', 'Analytics choices');
    root.setAttribute('data-analytics-bar', '');
    var card = el('div', 'aoc-card');
    card.appendChild(el('h2', 'aoc-title', 'Analytics choices'));

    if (signalOff()) {
      renderSignal(card);
    } else {
      card.appendChild(el('p', 'aoc-text', opener()));
      if (expanded) renderRows(card);
      var keys = el('div', 'aoc-keys');
      keys.appendChild(
        key('Reject all', function () {
          decide(none());
        }),
      );
      keys.appendChild(
        expanded
          ? key('Save choices', function () {
              decide({ measure: draft.measure, record: draft.record });
            })
          : key('Choose', function () {
              expanded = true;
              render(true);
            }),
      );
      keys.appendChild(
        key('Accept all', function () {
          decide({ measure: Boolean(ids.measure), record: Boolean(ids.record) });
        }),
      );
      card.appendChild(keys);
    }
    var link = el('a', 'aoc-link', 'Cookie policy');
    link.href = policy;
    card.appendChild(link);
    root.appendChild(card);
    document.body.appendChild(root);
    if (focusFirstSwitch) {
      var first = root.querySelector('.aoc-switch') || root.querySelector('.aoc-key');
      if (first) first.focus();
    }
  }

  function open() {
    if (PURPOSES.length === 0) return;
    draft = effective();
    expanded = true;
    render(true);
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    var trigger = target && target.closest ? target.closest('[data-analytics-choices]') : null;
    if (!trigger) return;
    event.preventDefault();
    open();
  });

  // A choice saved in another tab applies here too, so withdrawing in one tab stops the vendors in all.
  window.addEventListener('storage', function (event) {
    if (event.key !== KEY) return;
    apply(effective());
    if (root && readStored() !== null) close();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && root && readStored() !== null) close();
  });

  function start() {
    apply(effective());
    if (PURPOSES.length > 0 && !signalOff() && readStored() === null) {
      draft = none();
      render(false);
    }
  }

  window.agentosConsent = { open: open, purposes: effective };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
