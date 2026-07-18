/* «flash» — the mig speed reader in the browser. Pick a ready-made set, then
   read it at speed: russian first, the translation revealed in the second half
   of each beat (or никогда, in ru-only mode). No scorekeeping on the web; this
   is the reading, not the ledger. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  // russian chrome stays primary; a quiet latin gloss rides along (.lat inline,
  // .lat-under as a second line). styles live in the shared style.css.
  function withGloss(el, ru, en, under) {
    el.textContent = ru;
    if (!en) return el;
    var g = document.createElement('span');
    g.className = under ? 'lat-under' : 'lat';
    g.textContent = en;
    if (!under) el.appendChild(document.createTextNode(' '));
    el.appendChild(g);
    return el;
  }

  var MIG = window.MIG_SETS || [];
  var LEVELS = [['a1', 'a1 · начало · start'], ['a2', 'a2 · дальше · further'], ['b1', 'b1 · увереннее · more confident']];

  var els = {
    pick: $('v-pick'), pickList: $('pickList'),
    play: $('v-play'), pos: $('pos'), back: $('back'),
    trackFill: $('trackFill'), stage: $('stage'),
    word: $('fword'), translit: $('ftranslit'), reveal: $('freveal'), hint: $('fhint'),
    wpm: $('wpm'), wpmValue: $('wpmValue'), modeSeg: $('modeSeg'),
    endcard: $('endcard'), again: $('again'), shuffleGo: $('shuffleGo'), toSets: $('toSets'),
  };

  // ---- settings (remembered locally, like the theme) -------------------------
  var wpm = parseInt(localStorage.getItem('mig-flash-wpm') || '120', 10);
  if (!(wpm >= 50 && wpm <= 1000)) wpm = 120;
  var mode = localStorage.getItem('mig-flash-mode') === 'ruonly' ? 'ruonly' : 'paired';

  // ---- picker ----------------------------------------------------------------
  function labelEl(cls, ru, en) {
    var el = document.createElement('div');
    el.className = cls;
    return withGloss(el, ru, en);
  }

  function rowEl(name, count, onGo) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'setrow';
    var n = document.createElement('span');
    n.className = 'setname';
    n.textContent = name;
    var c = document.createElement('span');
    c.className = 'setcount';
    c.textContent = count;
    b.appendChild(n); b.appendChild(c);
    b.addEventListener('click', onGo);
    return b;
  }

  function renderPick() {
    var host = els.pickList;
    host.textContent = '';
    host.appendChild(labelEl('setshead', 'готовые наборы миг', 'ready-made mig sets'));
    LEVELS.forEach(function (lvl) {
      var sets = MIG.filter(function (s) { return s.level === lvl[0]; });
      if (!sets.length) return;
      host.appendChild(labelEl('setslevel', lvl[1], ''));
      var g = document.createElement('div');
      g.className = 'setgrid';
      sets.forEach(function (s) {
        g.appendChild(rowEl(s.name, s.cards.length, function () { start(s.cards.slice()); }));
      });
      host.appendChild(g);
    });
  }

  // ---- the reader ------------------------------------------------------------
  var deck = [], i = 0, phase = 'ru', timer = null, running = false;

  function beatMs() { return 60000 / wpm; }

  function start(cards) {
    deck = cards;
    i = 0;
    els.pick.hidden = true;
    els.play.hidden = false;
    els.endcard.hidden = true;
    els.stage.hidden = false;
    window.scrollTo(0, 0);
    show(0, 'ru');
    resume();
  }

  function show(index, ph) {
    i = index;
    phase = ph;
    var card = deck[i];
    els.word.textContent = card.ru;
    els.translit.textContent = card.translit || '';
    els.reveal.textContent = card.en;
    // en space is reserved either way, so the word never jumps; в paired mode
    // it becomes visible on the second half of the beat.
    els.reveal.classList.toggle('dimmed', !(mode === 'paired' && ph === 'en'));
    withGloss(els.pos, (i + 1) + ' / ' + deck.length, '');
    els.trackFill.style.width = (100 * (i + 1) / deck.length) + '%';
  }

  function tick() {
    if (mode === 'paired' && phase === 'ru') {
      show(i, 'en');
      schedule(beatMs() * 0.45);
      return;
    }
    if (i + 1 < deck.length) {
      show(i + 1, 'ru');
      schedule(mode === 'paired' ? beatMs() * 0.55 : beatMs());
    } else {
      finish();
    }
  }

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(tick, ms);
  }

  function resume() {
    running = true;
    els.stage.classList.add('running');
    els.stage.classList.remove('paused');
    withGloss(els.hint, 'нажми, чтобы поставить на паузу', 'tap to pause · space works too', false);
    schedule(mode === 'paired' && phase === 'ru' ? beatMs() * 0.55 : beatMs() * 0.45);
  }

  function pause() {
    running = false;
    clearTimeout(timer);
    els.stage.classList.remove('running');
    els.stage.classList.add('paused');
    // paused is also the moment to study: reveal the translation.
    els.reveal.classList.remove('dimmed');
    withGloss(els.hint, 'пауза. нажми, чтобы продолжить', 'paused. tap to continue', false);
  }

  function finish() {
    running = false;
    clearTimeout(timer);
    els.stage.hidden = true;
    els.endcard.hidden = false;
  }

  function toPicker() {
    running = false;
    clearTimeout(timer);
    els.play.hidden = true;
    els.pick.hidden = false;
  }

  // ---- wiring ----------------------------------------------------------------
  // A speed reader must not run while nobody is looking: browsers throttle
  // hidden-tab timers anyway, so switching away pauses cleanly instead of
  // letting clamped timeouts burst through words on return.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && running) pause();
  });

  els.stage.addEventListener('click', function () { running ? pause() : resume(); });
  els.stage.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); running ? pause() : resume(); }
  });
  document.addEventListener('keydown', function (e) {
    if (els.play.hidden || !els.endcard.hidden) return;
    if (e.key === ' ') { e.preventDefault(); running ? pause() : resume(); }
    if (e.key === 'ArrowRight' && i + 1 < deck.length) { show(i + 1, 'ru'); if (running) schedule(beatMs()); }
    if (e.key === 'ArrowLeft' && i > 0) { show(i - 1, 'ru'); if (running) schedule(beatMs()); }
  });

  els.wpm.value = String(wpm);
  function renderWpm() { withGloss(els.wpmValue, String(wpm), 'wpm'); }
  renderWpm();
  els.wpm.addEventListener('input', function () {
    wpm = parseInt(els.wpm.value, 10);
    localStorage.setItem('mig-flash-wpm', String(wpm));
    renderWpm();
  });

  function renderMode() {
    Array.prototype.forEach.call(els.modeSeg.children, function (b) {
      b.classList.toggle('on', b.dataset.mode === mode);
    });
  }
  renderMode();
  els.modeSeg.addEventListener('click', function (e) {
    var b = e.target.closest('.segbtn');
    if (!b) return;
    mode = b.dataset.mode === 'ruonly' ? 'ruonly' : 'paired';
    localStorage.setItem('mig-flash-mode', mode);
    renderMode();
    if (!els.play.hidden && els.endcard.hidden) show(i, 'ru');
  });

  els.back.addEventListener('click', toPicker);
  els.toSets.addEventListener('click', toPicker);
  els.again.addEventListener('click', function () { start(deck); });
  els.shuffleGo.addEventListener('click', function () {
    var d = deck.slice();
    for (var k = d.length - 1; k > 0; k--) {
      var j = Math.floor(Math.random() * (k + 1));
      var t = d[k]; d[k] = d[j]; d[j] = t;
    }
    start(d);
  });

  renderPick();
})();
