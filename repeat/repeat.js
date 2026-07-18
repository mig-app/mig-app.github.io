/* «повторяй» — hear a russian word, repeat it aloud, get scored.
   Pick a source (built-in words/phrases, or a ready-made mig set), then walk it
   with назад / дальше one at a time. Web Speech only: speechSynthesis says it,
   SpeechRecognition grades it. Scoring lives in score.js. */
(function () {
  'use strict';
  var match = window.RepeatScore.match;
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

  // ---- sources ---------------------------------------------------------------
  var PHRASES = (window.PHRASES || []).filter(function (p) { return p && p.ru && p.kind; });
  var MIG = window.MIG_SETS || [];
  var LEVELS = [['a1', 'a1 · начало · start'], ['a2', 'a2 · дальше · further'], ['b1', 'b1 · увереннее · more confident']];
  function builtin(kind) { return PHRASES.filter(function (p) { return p.kind === kind; }); }

  // ---- text to speech --------------------------------------------------------
  function pickVoice(lang) {
    if (!window.speechSynthesis) return null;
    var vs = window.speechSynthesis.getVoices(), l = lang.toLowerCase();
    return vs.filter(function (v) { return v.lang && v.lang.toLowerCase() === l; })[0] ||
      vs.filter(function (v) { return v.lang && v.lang.toLowerCase().indexOf(l.slice(0, 2)) === 0; })[0] || null;
  }
  function speak(text) {
    if (!window.speechSynthesis || !text) return;
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    var v = pickVoice(u.lang);
    if (v) u.voice = v;
    u.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = function () { window.speechSynthesis.getVoices(); };
  }

  // ---- speech recognition ----------------------------------------------------
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var srSupported = !!SR;

  // ---- state -----------------------------------------------------------------
  var pool = [], order = [], at = 0, current = null;
  var listening = false, reco = null, score = 0, streak = 0;
  var els = {};

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---- picker ----------------------------------------------------------------
  function rowEl(name, en, count, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'setrow';
    var n = document.createElement('span'); n.className = 'setname'; withGloss(n, name, en);
    var c = document.createElement('span'); c.className = 'setcount'; c.textContent = count;
    b.appendChild(n); b.appendChild(c);
    b.addEventListener('click', onClick);
    return b;
  }
  function labelEl(cls, text, en) { var d = document.createElement('div'); d.className = cls; withGloss(d, text, en); return d; }
  function gridEl() { var d = document.createElement('div'); d.className = 'setgrid'; return d; }

  function renderPick() {
    var host = $('pickList');
    host.innerHTML = '';

    host.appendChild(labelEl('setshead', 'разминка', 'warm-up'));
    var g = gridEl();
    g.appendChild(rowEl('слова', 'words', builtin('word').length, function () { start('слова', builtin('word')); }));
    g.appendChild(rowEl('фразы', 'phrases', builtin('sentence').length, function () { start('фразы', builtin('sentence')); }));
    host.appendChild(g);

    if (MIG.length) {
      host.appendChild(labelEl('setshead', 'готовые наборы миг', 'ready-made mig sets'));
      LEVELS.forEach(function (lv) {
        var inLevel = MIG.filter(function (s) { return s.level === lv[0]; });
        if (!inLevel.length) return;
        host.appendChild(labelEl('setslevel', lv[1]));
        var grid = gridEl();
        inLevel.forEach(function (s) {
          grid.appendChild(rowEl(s.name, null, s.cards.length, function () { start(s.name, s.cards); }));
        });
        host.appendChild(grid);
      });
    }
  }

  // ---- practice --------------------------------------------------------------
  function start(name, items) {
    if (!items || !items.length) return;
    pool = items;
    order = shuffle(pool.map(function (_, i) { return i; }));
    at = 0;
    $('v-pick').hidden = true;
    $('v-practice').hidden = false;
    if (!srSupported) $('srnote').hidden = false;
    loadAt(0, true);
  }

  function toPicker() {
    stopListen();
    window.speechSynthesis && window.speechSynthesis.cancel();
    $('v-practice').hidden = true;
    $('v-pick').hidden = false;
  }

  function loadAt(i, speakIt) {
    at = (i % order.length + order.length) % order.length;
    current = pool[order[at]];
    els.ru.textContent = current.ru;
    els.en.textContent = current.en || '';
    els.translit.textContent = current.translit || '';
    els.result.hidden = true;
    els.result.className = 'result';
    els.mic.classList.remove('listening');
    els.pos.textContent = (at + 1) + ' / ' + order.length;
    if (srSupported) setStatus('нажми и повтори', 'tap and repeat', false);
    else setStatus('слушай и повторяй вслух', 'listen and repeat aloud', false);
    if (speakIt) setTimeout(function () { speak(current.ru); }, 220);
  }

  function move(d) { stopListen(); loadAt(at + d, true); }

  function setStatus(text, en, live) {
    withGloss(els.status, text, en, true);
    els.status.classList.toggle('live', !!live);
  }
  function renderScore() {
    els.score.innerHTML =
      '<span class="s-item"><span class="dot"></span>серия ' + streak + ' <span class="lat">streak</span></span>' +
      '<span class="s-item">очки ' + score + ' <span class="lat">points</span></span>';
  }

  function showResult(res, heard) {
    var label = res.verdict === 'great' ? 'отлично' : res.verdict === 'close' ? 'почти, ещё разок' : 'ещё раз';
    var gloss = res.verdict === 'great' ? 'great' : res.verdict === 'close' ? 'close, one more try' : 'try again';
    var parts = (current.ru || '').split(/\s+/).map(function (w, i) {
      var ok = res.words[i] && res.words[i].ok;
      return '<span class="' + (ok ? 'w-ok' : 'w-miss') + '">' + w + '</span>';
    }).join(' ');
    els.result.className = 'result v-' + res.verdict;
    els.result.innerHTML =
      '<div class="verdict">' + label + ' <span class="lat">' + gloss + '</span> <span class="pct">' + res.score + '%</span></div>' +
      '<div class="target">' + parts + '</div>' +
      '<div class="heard">услышано <span class="lat">heard</span>: «' + (heard || '—') + '»</div>';
    els.result.hidden = false;
  }

  // ---- microphone ------------------------------------------------------------
  function stopListen() {
    listening = false;
    els.mic.classList.remove('listening');
    if (reco) { try { reco.stop(); } catch (e) {} }
  }

  function listen() {
    if (!srSupported) { speak(current.ru); return; }
    if (listening) { stopListen(); return; }
    try {
      reco = new SR();
      reco.lang = 'ru-RU';
      reco.interimResults = true;
      reco.maxAlternatives = 1;
      var finalText = '';
      reco.onstart = function () { listening = true; els.mic.classList.add('listening'); setStatus('слушаю, говори', 'listening, speak', true); els.result.hidden = true; };
      reco.onresult = function (e) {
        var interim = '';
        for (var i = e.resultIndex; i < e.results.length; i++) {
          var r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        if (interim) setStatus('…' + interim, null, true);
      };
      reco.onerror = function (e) {
        listening = false; els.mic.classList.remove('listening');
        if (e.error === 'not-allowed') setStatus('нет доступа к микрофону, разреши его в браузере', 'no mic access, allow it in the browser', false);
        else setStatus('не расслышал, нажми ещё раз', 'did not catch that, tap again', false);
      };
      reco.onend = function () {
        listening = false; els.mic.classList.remove('listening');
        var said = finalText.trim();
        if (!said) { setStatus('нажми и повтори', 'tap and repeat', false); return; }
        var res = match(current.ru, said);
        if (res.verdict === 'great') { score += 10; streak += 1; }
        else if (res.verdict === 'close') { score += 5; streak = 0; }
        else { streak = 0; }
        renderScore();
        setStatus('нажми, чтобы повторить снова', 'tap to try again', false);
        showResult(res, said);
      };
      reco.start();
    } catch (err) {
      setStatus('распознавание недоступно, попробуй chrome', 'speech recognition unavailable, try chrome', false);
    }
  }

  // ---- init ------------------------------------------------------------------
  function init() {
    els.ru = $('ru'); els.en = $('en'); els.translit = $('translit');
    els.result = $('result'); els.status = $('status'); els.mic = $('mic');
    els.score = $('score'); els.pos = $('pos');

    els.mic.addEventListener('click', listen);
    $('listen').addEventListener('click', function () { speak(current.ru); });
    $('prev').addEventListener('click', function () { move(-1); });
    $('next').addEventListener('click', function () { move(1); });
    $('back').addEventListener('click', toPicker);
    document.addEventListener('keydown', function (e) {
      if ($('v-practice').hidden) return;
      if (e.key === 'ArrowRight') move(1);
      else if (e.key === 'ArrowLeft') move(-1);
    });

    renderScore();
    renderPick();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
