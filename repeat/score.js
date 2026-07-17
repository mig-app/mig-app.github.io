/* Pronunciation scoring for «повторяй».
   Standalone on purpose: it is the crux of the game, it needs unit tests, and
   it gets ported verbatim to the iOS app so web and phone grade identically.

   ASR is imperfect, so multi-word phrases are graded generously (per-word fuzzy
   + whole-string ratio). A SINGLE word is graded strictly: that word IS the
   pronunciation test, and "том" must not pass as "дом". */
(function (root) {
  'use strict';

  function normalize(s) {
    return String(s).toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
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

  function verdictFor(score, greatAt, closeAt) {
    return score >= greatAt ? 'great' : score >= closeAt ? 'close' : 'off';
  }

  function match(target, said) {
    var t = normalize(target), s = normalize(said);
    var tw = t.split(' ').filter(Boolean), sw = s.split(' ').filter(Boolean);

    // one word: grade strictly on edit ratio against the closest thing heard.
    if (tw.length === 1) {
      var goal = tw[0], best = null, bestD = Infinity;
      for (var i = 0; i < sw.length; i++) {
        var d = lev(sw[i], goal);
        if (d < bestD) { bestD = d; best = sw[i]; }
      }
      if (best === null) return { score: 0, verdict: 'off', words: [{ target: goal, ok: false }] };
      var ratio = 1 - bestD / Math.max(goal.length, best.length, 1);
      var sc = Math.round(Math.max(0, ratio) * 100);
      var vd = verdictFor(sc, 90, 65);
      return { score: sc, verdict: vd, words: [{ target: goal, ok: vd === 'great' }] };
    }

    // phrase: generous, per-word fuzzy + whole-string ratio.
    var words = tw.map(function (w) { return { target: w, ok: sw.some(function (x) { return wordClose(x, w); }) }; });
    var wordScore = tw.length ? words.filter(function (w) { return w.ok; }).length / tw.length : 0;
    var charScore = 1 - lev(t, s) / Math.max(t.length, s.length, 1);
    var score = Math.round((0.7 * wordScore + 0.3 * Math.max(0, charScore)) * 100);
    return { score: score, verdict: verdictFor(score, 80, 55), words: words };
  }

  var api = { normalize: normalize, match: match };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RepeatScore = api;
})(typeof self !== 'undefined' ? self : this);
