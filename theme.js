/* MiG site theme. Default follows the device; a manual choice is remembered.
   The initial data-theme is set by a tiny inline script in each <head> so there
   is no flash of the wrong theme before this file loads. This file only adds the
   corner toggle and keeps following the system for visitors who never choose. */
(function () {
  var root = document.documentElement;

  function stored() { try { return localStorage.getItem('mig-theme'); } catch (e) { return null; } }
  function systemDark() { return !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); }
  function current() { return root.getAttribute('data-theme') || (systemDark() ? 'dark' : 'light'); }

  var SUN = '<svg viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.6v2.3M12 19.1v2.3M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.6 12h2.3M19.1 12h2.3M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" fill="none" aria-hidden><path d="M20 14.4A8 8 0 0 1 9.6 4 7 7 0 1 0 20 14.4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';

  var btn;
  function refresh() {
    if (!btn) return;
    var dark = current() === 'dark';
    btn.innerHTML = dark ? SUN : MOON; // show the mode you would switch to
    btn.setAttribute('aria-label', dark ? 'светлая тема' : 'тёмная тема');
    btn.setAttribute('title', dark ? 'светлая тема' : 'тёмная тема');
  }
  function apply(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem('mig-theme', theme); } catch (e) {}
    refresh();
  }

  function init() {
    if (!root.getAttribute('data-theme')) root.setAttribute('data-theme', current());
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'themetoggle';
    btn.addEventListener('click', function () { apply(current() === 'dark' ? 'light' : 'dark'); });
    document.body.appendChild(btn);
    refresh();

    // keep following the system for visitors who have not chosen a theme
    if (window.matchMedia) {
      var mq = matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () {
        if (!stored()) { root.setAttribute('data-theme', systemDark() ? 'dark' : 'light'); refresh(); }
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
