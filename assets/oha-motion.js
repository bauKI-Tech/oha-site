/* ════════════════════════════════════════════════════════
   OHÁ — shared motion
   smooth-scroll (Lenis) · reveal-on-scroll · parallax
   FAQ accordion · hero entrance · consent gate
   ════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── smooth scroll (Lenis, loaded via CDN in <head>) ── */
  if (!reduce && window.Lenis) {
    var lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true, wheelMultiplier: 1.0, touchMultiplier: 1.6
    });
    var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  /* ── reveal-on-scroll (degrades safely: no IntersectionObserver → show all) ── */
  var revealTargets = document.querySelectorAll('.reveal, .reveal-stagger');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealTargets.forEach(function (el) { io.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('in'); });
  }
  /* signal that the reveal system is live, so the inline head failsafe stands down */
  window.__ohaReveal = true;

  /* ── parallax (rAF-throttled) ── */
  var px = document.querySelectorAll('[data-parallax]');
  if (!reduce && px.length) {
    var ticking = false;
    var apply = function () {
      var vh = innerHeight;
      px.forEach(function (el) {
        var host = el.parentElement, r = host.getBoundingClientRect();
        if (r.bottom < -120 || r.top > vh + 120) return;
        var p = (r.top + r.height / 2 - vh / 2) / vh;
        var amt = parseFloat(el.getAttribute('data-parallax')) || 8;
        var img = el.tagName === 'IMG' ? el : el.querySelector('img');
        if (img) img.style.transform = 'translate3d(0,' + (p * -amt) + '%,0) scale(1.06)';
      });
      ticking = false;
    };
    var onScroll = function () { if (!ticking) { requestAnimationFrame(apply); ticking = true; } };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    apply();
  }

  /* ── FAQ accordion (event page) ── */
  document.querySelectorAll('.faq__item').forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (item.open) {
        item.classList.add('open');
        document.querySelectorAll('.faq__item').forEach(function (o) {
          if (o !== item && o.open) { o.open = false; o.classList.remove('open'); }
        });
      } else { item.classList.remove('open'); }
    });
  });

  /* ── hero entrance ── */
  requestAnimationFrame(function () { document.documentElement.classList.add('is-loaded'); });

  /* ── scarcity / FOMO — daily drip + real-sales sync ──
     Shown number = deterministic daily drip MINUS real sales since the anchor.
     Drip: −2/day while above SC_RESERVE, then ~1 every 2 days so the final week
     before the event still looks natural; never below SC_FLOOR unless really sold out.
     Real sales: a GitHub Action probes Shopify every few hours and writes spots.json
     ({"available":N,...}) next to this site; we subtract (SC_INV_ANCHOR − N).
     RE-ANCHOR anytime: SC_ANCHOR_DATE = today, SC_ANCHOR_LEFT = number to show today,
     SC_INV_ANCHOR = real Shopify stock that day (probe: cart/<variant>:99 → cart.js). */
  var SC_TOTAL = 40, SC_ANCHOR_DATE = '2026-06-11', SC_ANCHOR_LEFT = 14, SC_FLOOR = 2;
  var SC_RESERVE = 6, SC_INV_ANCHOR = 20;
  var SC_FROZEN = 2;   /* FREEZE: a number = always show exactly this, no drip, no sales-sync. Set to null to resume dynamic v2 behaviour. */
  var SC_SOLD_OUT = true;   /* MASTER: true = event is SOLD OUT → shows "Sold out", checkout blocked, CTAs become "Join the waitlist". Overrides SC_FROZEN/drip. Set false to reopen sales. */
  var OHA_WAITLIST = 'mailto:contact@shopoha.com?subject=' + encodeURIComponent('ohá — event waitlist (28 June)') + '&body=' + encodeURIComponent('Please add me to the waitlist for the ohá afternoon on 28 June. I would love to come if a spot opens up.');
  function ohaDayRand(d) { var r = Math.sin(d * 99.137) * 7841.91; return r - Math.floor(r); /* stable 0..1 per day */ }
  function ohaDripLeft() {
    var days = Math.floor((Date.now() - Date.parse(SC_ANCHOR_DATE + 'T09:00:00')) / 86400000);
    if (days < 0) days = 0;
    var left = SC_ANCHOR_LEFT;
    for (var d = 1; d <= days; d++) {
      if (left > SC_RESERVE) left -= 2;                                /* fast phase: 2/day */
      else if (left > SC_FLOOR && ohaDayRand(d) < 0.28) left -= 1;     /* final stretch: ~1 every 3–4 days, hits floor only just before the event */
    }
    return Math.max(SC_FLOOR, Math.min(SC_TOTAL, left));
  }
  function ohaRenderSpots(left) {
    var pct = Math.round((SC_TOTAL - left) / SC_TOTAL * 100);
    document.querySelectorAll('[data-spots]').forEach(function (el) { el.textContent = left; });
    document.querySelectorAll('[data-spots-total]').forEach(function (el) { el.textContent = SC_TOTAL; });
    document.querySelectorAll('[data-spots-fill]').forEach(function (el) { el.style.width = pct + '%'; });
  }
  function ohaApplySoldOut() {
    document.querySelectorAll('[data-spots-fill]').forEach(function (el) { el.style.width = '100%'; });
    document.querySelectorAll('[data-spots]').forEach(function (el) {
      var p = el.closest('p');
      if (p && p !== el) { p.textContent = 'Sold out'; }                 /* event: "<span>N</span> left" → "Sold out" */
      else { el.textContent = '0'; var sib = el.nextElementSibling; if (sib && /left/i.test(sib.textContent)) sib.textContent = 'Sold out · €49'; }  /* home fact */
    });
    var rsv = document.getElementById('reserve');
    if (rsv) {
      var w = rsv.cloneNode(true);                                       /* clone strips the inline checkout click handler */
      w.textContent = 'Join the waitlist';
      w.setAttribute('href', OHA_WAITLIST);
      w.classList.remove('is-disabled');
      w.removeAttribute('aria-disabled'); w.removeAttribute('tabindex'); w.removeAttribute('data-consent-target');
      rsv.parentNode.replaceChild(w, rsv);
    }
    document.querySelectorAll('a').forEach(function (a) {                 /* no CTA may say "Reserve" while sold out */
      if (a.getAttribute('href') === OHA_WAITLIST) return;
      if (/^\s*reserve/i.test(a.textContent || '')) a.textContent = 'Join the waitlist';
    });
    document.querySelectorAll('.tickets__eyebrow').forEach(function (e) { if (/reserve/i.test(e.textContent)) e.textContent = '— sold out'; });
  }
  (function () {
    if (SC_SOLD_OUT) { ohaApplySoldOut(); return; }                      /* master sold-out switch */
    if (typeof SC_FROZEN === 'number') { ohaRenderSpots(SC_FROZEN); return; }  /* frozen → fixed number, skip drip + sales overlay */
    ohaRenderSpots(ohaDripLeft());
    /* real-sales overlay: spots.json is same-origin, written by the inventory Action */
    fetch('spots.json?cb=' + Date.now()).then(function (r) {
      if (!r.ok) throw 0; return r.json();
    }).then(function (s) {
      if (!s || typeof s.available !== 'number') return;
      var real = s.available;
      if (real <= 0) return ohaRenderSpots(0);                          /* truly sold out */
      var sold = Math.max(0, SC_INV_ANCHOR - real);
      var left = Math.min(ohaDripLeft() - sold, real);
      ohaRenderSpots(Math.max(Math.min(SC_FLOOR, real), left));
    }).catch(function () {});                                           /* no file yet → drip only */
  })();

  /* ── consent gate (event tickets): unlock checkout only when consent is ticked ── */
  if (!SC_SOLD_OUT) document.querySelectorAll('[data-consent-gate]').forEach(function (gate) {
    var box = gate.querySelector('[data-consent]');
    var targets = gate.querySelectorAll('[data-consent-target]');
    if (!box) return;
    var sync = function () {
      var off = !box.checked;
      targets.forEach(function (t) {
        t.classList.toggle('is-disabled', off);
        t.setAttribute('aria-disabled', off ? 'true' : 'false');
        if (off) { t.setAttribute('tabindex', '-1'); } else { t.removeAttribute('tabindex'); }
      });
    };
    box.addEventListener('change', sync);
    sync();
  });
})();
