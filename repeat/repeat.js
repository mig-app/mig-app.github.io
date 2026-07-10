/* «повторяй» — hear a russian phrase, repeat it aloud, get scored.
   Web Speech only: speechSynthesis to say it, SpeechRecognition to grade it.
   Scoring ported from the mavis engine (per-word fuzzy + char ratio). */
(function () {
  'use strict';
  var PHRASES = (window.PHRASES || []).filter(function (p) { return p && p.ru && p.kind; });

  // ---- scoring ---------------------------------------------------------------
  function normalize(s) {
    return s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  }
  function lev(a, b) {
    var m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      for (j = 0; j <= n; j++) prev[j] = cur[j];
    }
    return prev[n];
  }
  function wordClose(a, b) {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 2) return false;
    return lev(a, b) <= (b.length <= 4 ? 1 : 2);
  }
  function match(target, said) {
    var t = normalize(target), s = normalize(said);
    var tw = t.split(' ').filter(Boolean), sw = s.split(' ').filter(Boolean);
    var words = tw.map(function (w) { return { target: w, ok: sw.some(function (x) { return wordClose(x, w); }) }; });
    var wordScore = tw.length ? words.filter(function (w) { return w.ok; }).length / tw.length : 0;
    var charScore = 1 - lev(t, s) / Math.max(t.length, s.length, 1);
    var score = Math.round((0.7 * wordScore + 0.3 * Math.max(0, charScore)) * 100);
    var verdict = score >= 80 ? 'great' : score >= 55 ? 'close' : 'off';
    return { score: score, verdict: verdict, words: words };
  }

  // ---- text to speech --------------------------------------------------------
  function pickVoice(lang) {
    if (!window.speechSynthesis) return null;
    var vs = window.speechSynthesis.getVoices(), l = lang.toLowerCase();
    return vs.filter(function (v) { return v.lang && v.lang.toLowerCase() === l; })[0] ||
      vs.filter(function (v) { return v.lang && v.lang.toLowerCase().indexOf(l.slice(0, 2)) === 0; })[0] || null;
  }
  function speak(text, lang, rate) {
    if (!window.speechSynthesis) return;
    var u = new SpeechSynthesisUtterance(text);
    u.lang = lang || 'ru-RU';
    var v = pickVoice(u.lang);
    if (v) u.voice = v;
    u.rate = rate || (u.lang.indexOf('ru') === 0 ? 0.9 : 1);
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
  var mode = 'sentence', current = null, listening = false, reco = null;
  var score = 0, streak = 0, done = 0;

  var $ = function (id) { return document.getElementById(id); };
  var els = {};

  function poolFor(m) {
    var p = PHRASES.filter(function (x) { return x.kind === m; });
    return p.length ? p : PHRASES;
  }
  function pick() {
    var p = poolFor(mode);
    if (p.length <= 1) return p[0];
    var x;
    do { x = p[Math.floor(Math.random() * p.length)]; } while (x === current);
    return x;
  }

  function setStatus(text, live) {
    els.status.textContent = text;
    els.status.classList.toggle('live', !!live);
  }
  function renderScore() {
    els.score.innerHTML =
      '<span class="s-item"><span class="dot"></span>серия ' + streak + '</span>' +
      '<span class="s-item">очки ' + score + '</span>';
  }

  function render(speakIt) {
    current = pick();
    els.ru.textContent = current.ru;
    els.en.textContent = current.en;
    els.translit.textContent = current.translit || '';
    els.result.hidden = true;
    els.result.className = 'result';
    els.mic.classList.remove('listening');
    setStatus(srSupported ? 'нажми и повтори' : 'слушай и повторяй вслух', false);
    if (speakIt) setTimeout(function () { speak(current.ru); }, 250);
  }

  function showResult(res, heard) {
    var label = res.verdict === 'great' ? 'отлично' : res.verdict === 'close' ? 'почти, ещё разок' : 'ещё раз';
    var parts = current.ru.split(/\s+/).map(function (w, i) {
      var ok = res.words[i] && res.words[i].ok;
      return '<span class="' + (ok ? 'w-ok' : 'w-miss') + '">' + w + '</span>';
    }).join(' ');
    els.result.className = 'result v-' + res.verdict;
    els.result.innerHTML =
      '<div class="verdict">' + label + ' <span class="pct">' + res.score + '%</span></div>' +
      '<div class="target">' + parts + '</div>' +
      '<div class="heard">услышано: «' + (heard || '—') + '»</div>';
    els.result.hidden = false;
  }

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
      reco.onstart = function () { listening = true; els.mic.classList.add('listening'); setStatus('слушаю, говори', true); els.result.hidden = true; };
      reco.onresult = function (e) {
        var interim = '';
        for (var i = e.resultIndex; i < e.results.length; i++) {
          var r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        if (interim) setStatus('…' + interim, true);
      };
      reco.onerror = function (e) {
        listening = false; els.mic.classList.remove('listening');
        setStatus(e.error === 'not-allowed' ? 'нет доступа к микрофону, разреши его в браузере' : 'не расслышал, нажми ещё раз', false);
      };
      reco.onend = function () {
        listening = false; els.mic.classList.remove('listening');
        var said = finalText.trim();
        if (!said) { setStatus('нажми и повтори', false); return; }
        var res = match(current.ru, said);
        done += 1;
        if (res.verdict === 'great') { score += 10; streak += 1; }
        else if (res.verdict === 'close') { score += 5; streak = 0; }
        else { streak = 0; }
        renderScore();
        setStatus('нажми, чтобы повторить снова', false);
        showResult(res, said);
      };
      reco.start();
    } catch (err) {
      setStatus('распознавание недоступно, попробуй chrome', false);
    }
  }

  function setMode(m) {
    if (mode === m) return;
    mode = m;
    els.modeBtns.forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-mode') === m); });
    stopListen();
    render(true);
  }

  function init() {
    els.ru = $('ru'); els.en = $('en'); els.translit = $('translit');
    els.result = $('result'); els.status = $('status'); els.mic = $('mic');
    els.score = $('score');
    els.modeBtns = Array.prototype.slice.call(document.querySelectorAll('.mode'));

    if (!srSupported) $('srnote').hidden = false;

    els.mic.addEventListener('click', listen);
    $('listen').addEventListener('click', function () { speak(current.ru); });
    $('next').addEventListener('click', function () { stopListen(); render(true); });
    els.modeBtns.forEach(function (b) { b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); }); });

    renderScore();
    render(false); // don't auto-speak on first paint (needs a user gesture in some browsers)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
