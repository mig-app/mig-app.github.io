/* «карточки» — make or import a deck, then review it as flashcards.
   Decks live in localStorage: no backend, nothing leaves the browser.
   Tap the card to flip, tap the speaker to hear the russian (speechSynthesis). */
(function () {
  'use strict';

  var KEY = 'mig.cards.v1';
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

  // ---- storage ---------------------------------------------------------------
  function loadDecks() {
    try {
      var raw = localStorage.getItem(KEY);
      var d = raw ? JSON.parse(raw) : [];
      return Array.isArray(d) ? d : [];
    } catch (e) { return []; }
  }
  function saveDecks(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* private mode: session only */ }
  }
  function newId() { return 'd' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

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
    var v = pickVoice('ru-RU');
    if (v) u.voice = v;
    u.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = function () { window.speechSynthesis.getVoices(); };
  }

  // ---- import parsing --------------------------------------------------------
  // one pair per line. tab wins (that is what a quizlet export gives you), then
  // a bar, then " - ", then the first comma. anything without both halves is skipped.
  function parseImport(text) {
    var out = [];
    String(text).split(/\r?\n/).forEach(function (line) {
      var s = line.trim();
      if (!s) return;
      var parts = null;
      if (s.indexOf('\t') > -1) parts = s.split('\t');
      else if (s.indexOf(' | ') > -1) parts = s.split(' | ');
      else if (s.indexOf(' - ') > -1) parts = s.split(' - ');
      else if (s.indexOf(',') > -1) { var i = s.indexOf(','); parts = [s.slice(0, i), s.slice(i + 1)]; }
      if (!parts || parts.length < 2) return;
      var ru = parts[0].trim(), en = parts.slice(1).join(' ').trim();
      if (ru && en) out.push({ ru: ru, en: en });
    });
    return out;
  }

  // ---- state -----------------------------------------------------------------
  var decks = loadDecks();
  var editingId = null;   // deck being edited, null = new
  var deck = null;        // deck under review
  var order = [];         // indices into deck.cards
  var at = 0;
  var flipped = false;

  var views = ['v-decks', 'v-edit', 'v-import', 'v-review'];
  function show(view, crumb, crumbEn) {
    views.forEach(function (v) { $(v).hidden = v !== view; });
    withGloss($('crumb'), crumb || '', crumbEn);
    $('lede').hidden = view !== 'v-decks';
  }

  // ---- decks view ------------------------------------------------------------
  function renderDecks() {
    var list = $('deckList');
    list.innerHTML = '';
    if (!decks.length) {
      var p = document.createElement('div');
      p.className = 'empty';
      withGloss(p, 'пока пусто. сделай колоду или вставь готовый список.', 'nothing here yet. make a deck or paste a ready-made list.', true);
      list.appendChild(p);
    }
    decks.forEach(function (d) {
      var row = document.createElement('div');
      row.className = 'deck';
      row.addEventListener('click', function () { startReview(d); });

      var left = document.createElement('div');
      var name = document.createElement('div');
      name.className = 'deck-name';
      name.textContent = d.name;
      var meta = document.createElement('div');
      meta.className = 'deck-meta';
      var n = d.cards.length;
      withGloss(meta, n + (n === 1 ? ' карточка' : ' карточек'), n === 1 ? 'card' : 'cards');
      left.appendChild(name); left.appendChild(meta);

      var edit = document.createElement('button');
      edit.className = 'deck-edit';
      edit.type = 'button';
      withGloss(edit, 'править', 'edit');
      edit.addEventListener('click', function (e) { e.stopPropagation(); openEditor(d); });

      row.appendChild(left); row.appendChild(edit);
      list.appendChild(row);
    });
    show('v-decks', '');
  }

  // ---- editor ----------------------------------------------------------------
  function addRow(ru, en) {
    var wrap = document.createElement('div');
    wrap.className = 'row2';
    var a = document.createElement('input');
    a.type = 'text'; a.placeholder = 'по-русски · russian'; a.value = ru || ''; a.autocomplete = 'off';
    var b = document.createElement('input');
    b.type = 'text'; b.placeholder = 'перевод · translation'; b.value = en || ''; b.autocomplete = 'off';
    var del = document.createElement('button');
    del.className = 'row-del'; del.type = 'button'; del.textContent = '×';
    del.setAttribute('aria-label', 'убрать строку · remove row');
    del.addEventListener('click', function () { wrap.remove(); });
    wrap.appendChild(a); wrap.appendChild(b); wrap.appendChild(del);
    $('rows').appendChild(wrap);
  }

  function openEditor(d) {
    editingId = d ? d.id : null;
    $('deckName').value = d ? d.name : '';
    $('rows').innerHTML = '';
    if (d && d.cards.length) d.cards.forEach(function (c) { addRow(c.ru, c.en); });
    else { addRow(); addRow(); addRow(); }
    $('deleteDeck').hidden = !d;
    show('v-edit', d ? 'правка' : 'новая колода', d ? 'edit' : 'new deck');
  }

  function collectRows() {
    var out = [];
    Array.prototype.forEach.call($('rows').querySelectorAll('.row2'), function (r) {
      var ins = r.querySelectorAll('input');
      var ru = ins[0].value.trim(), en = ins[1].value.trim();
      if (ru && en) out.push({ ru: ru, en: en });
    });
    return out;
  }

  function saveDeck() {
    var cards = collectRows();
    var name = $('deckName').value.trim() || 'без названия';
    if (!cards.length) { withGloss($('crumb'), 'нужна хотя бы одна пара', 'at least one pair'); return; }
    if (editingId) {
      decks.forEach(function (d) { if (d.id === editingId) { d.name = name; d.cards = cards; } });
    } else {
      decks.push({ id: newId(), name: name, cards: cards });
    }
    saveDecks(decks);
    renderDecks();
  }

  function deleteDeck() {
    if (!editingId) return;
    decks = decks.filter(function (d) { return d.id !== editingId; });
    saveDecks(decks);
    renderDecks();
  }

  // ---- import ----------------------------------------------------------------
  function refreshCount() {
    var n = parseImport($('importText').value).length;
    if (!n) { $('pcount').textContent = ''; return; }
    withGloss($('pcount'), n + (n === 1 ? ' пара найдена' : ' пар найдено'), n === 1 ? 'pair found' : 'pairs found');
  }

  function doImport() {
    var cards = parseImport($('importText').value);
    if (!cards.length) { withGloss($('pcount'), 'ничего не разобрал. одна пара на строку.', 'could not parse that. one pair per line.', true); return; }
    decks.push({ id: newId(), name: 'вставленная колода', cards: cards });
    saveDecks(decks);
    $('importText').value = '';
    $('pcount').textContent = '';
    renderDecks();
  }

  // ---- ready-made mig sets ---------------------------------------------------
  // The curated vocabulary from the ios app (mig-sets.js), grouped by level.
  // Reviewed in place, read-only: they are not copied into the editable decks.
  var LEVELS = [['a1', 'a1 · начало · start'], ['a2', 'a2 · дальше · further'], ['b1', 'b1 · увереннее · more confident']];

  function renderMigSets() {
    var host = $('migSets');
    host.innerHTML = '';
    var sets = window.MIG_SETS || [];
    if (!sets.length) return;

    var head = document.createElement('div');
    head.className = 'setshead';
    withGloss(head, 'готовые наборы миг', 'ready-made mig sets');
    host.appendChild(head);

    LEVELS.forEach(function (lv) {
      var inLevel = sets.filter(function (s) { return s.level === lv[0]; });
      if (!inLevel.length) return;
      var lh = document.createElement('div');
      lh.className = 'setslevel';
      lh.textContent = lv[1];
      host.appendChild(lh);

      var grid = document.createElement('div');
      grid.className = 'setgrid';
      inLevel.forEach(function (s) {
        var row = document.createElement('button');
        row.type = 'button';
        row.className = 'setrow';
        var name = document.createElement('span');
        name.className = 'setname';
        name.textContent = s.name;
        var count = document.createElement('span');
        count.className = 'setcount';
        count.textContent = s.cards.length;
        row.appendChild(name);
        row.appendChild(count);
        row.addEventListener('click', function () { startReview({ name: s.name, cards: s.cards }); });
        grid.appendChild(row);
      });
      host.appendChild(grid);
    });
  }

  // ---- review ----------------------------------------------------------------
  function startReview(d) {
    deck = d;
    order = d.cards.map(function (_, i) { return i; });
    at = 0;
    setFace();
    show('v-review', d.name);
  }

  function card() { return deck.cards[order[at]]; }

  function setFace() {
    flipped = false;
    $('card').classList.remove('flipped');
    var c = card();
    $('front').textContent = c.ru;
    $('back').textContent = c.en;
    $('pos').textContent = (at + 1) + ' / ' + order.length;
    withGloss($('flipHint'), 'нажми на карточку, чтобы перевернуть', 'tap the card to flip', true);
  }

  function flip() {
    flipped = !flipped;
    $('card').classList.toggle('flipped', flipped);
    if (flipped) withGloss($('flipHint'), 'перевод', 'the translation', true);
    else withGloss($('flipHint'), 'нажми на карточку, чтобы перевернуть', 'tap the card to flip', true);
  }

  function step(n) {
    if (!order.length) return;
    at = (at + n + order.length) % order.length;
    setFace();
  }

  function shuffle() {
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = order[i]; order[i] = order[j]; order[j] = t;
    }
    at = 0;
    setFace();
  }

  // ---- wiring ----------------------------------------------------------------
  function init() {
    $('newDeck').addEventListener('click', function () { openEditor(null); });
    $('importDeck').addEventListener('click', function () { show('v-import', 'вставить список', 'paste a list'); });

    $('addRow').addEventListener('click', function () { addRow(); });
    $('saveDeck').addEventListener('click', saveDeck);
    $('cancelEdit').addEventListener('click', renderDecks);
    $('deleteDeck').addEventListener('click', deleteDeck);

    $('importText').addEventListener('input', refreshCount);
    $('doImport').addEventListener('click', doImport);
    $('cancelImport').addEventListener('click', renderDecks);

    $('card').addEventListener('click', flip);
    $('card').addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
    });
    $('speak').addEventListener('click', function (e) {
      e.stopPropagation();           // the speaker must not flip the card
      speak(card().ru);
    });
    $('prev').addEventListener('click', function () { step(-1); });
    $('next').addEventListener('click', function () { step(1); });
    $('shuffle').addEventListener('click', shuffle);
    $('exitReview').addEventListener('click', renderDecks);

    document.addEventListener('keydown', function (e) {
      if ($('v-review').hidden) return;
      if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    });

    renderMigSets();
    renderDecks();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
