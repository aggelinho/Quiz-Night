// Γεννήτριες ερωτήσεων. Κάθε γεννήτρια: gen(rng, diff) -> {key, text, options[4], answer, media?} ή null.
(function () {
  // ---------- βοηθητικά ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  function shuffle(r, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const uniq = (a) => [...new Set(a)];
  // Φτιάχνει ερώτηση πολλαπλής επιλογής: σωστή + 3 διαφορετικές λάθος από το pool
  function mc(r, key, text, correct, pool, media) {
    const wrong = shuffle(r, uniq(pool.filter((x) => x && x !== correct))).slice(0, 3);
    if (wrong.length < 3) return null;
    const options = shuffle(r, [correct, ...wrong]);
    return { key, text, options, answer: options.indexOf(correct), media: media || null };
  }
  const fmtNum = (n) => n.toLocaleString('el-GR');

  // ---------- ΓΕΩΓΡΑΦΙΑ ----------
  const C = window.GEO_COUNTRIES || [];
  const byCode = Object.fromEntries(C.map((c) => [c.code, c]));
  const X = window.GEO_EXTRA || {};
  const byTier = (d) => C.filter((c) => c.tier === d);
  // Για μεγαλύτερη δυσκολία, οι λάθος απαντήσεις έρχονται από την ίδια περιοχή
  function similar(c, d) {
    if (d === 1) return C;
    const same = C.filter((x) => (d === 3 ? x.sub === c.sub : x.region === c.region) && x.code !== c.code);
    return same.length >= 3 ? same : C.filter((x) => x.region === c.region);
  }
  const TRANSCONT = new Set(['TR', 'RU', 'CY', 'EG', 'KZ', 'AZ', 'GE', 'AM', 'PA']);

  const geo = {
    flags: { label: 'Σημαίες', icon: '🏳️', gen(r, d) {
      const c = pick(r, byTier(d));
      return mc(r, 'flag-' + c.code, 'Ποιας χώρας είναι αυτή η σημαία;', c.name, similar(c, d).map((x) => x.name), { type: 'flag', code: c.code });
    } },
    map: { label: 'Χάρτες', icon: '🗺️', gen(r, d) {
      const c = pick(r, byTier(d).filter((x) => x.mapId));
      return mc(r, 'map-' + c.code, 'Ποια χώρα είναι σημειωμένη στον χάρτη;', c.name, similar(c, d).map((x) => x.name), { type: 'map', mapId: c.mapId, latlng: c.latlng, area: c.area });
    } },
    capitals: { label: 'Πρωτεύουσες', icon: '🏛️', gen(r, d) {
      const c = pick(r, byTier(d).filter((x) => x.capital));
      const pool = similar(c, d).filter((x) => x.capital);
      if (r() < 0.5) return mc(r, 'cap-' + c.code, `Ποια είναι η πρωτεύουσα της χώρας «${c.name}»;`, c.capital, pool.map((x) => x.capital));
      return mc(r, 'capr-' + c.code, `Η πόλη «${c.capital}» είναι πρωτεύουσα ποιας χώρας;`, c.name, pool.map((x) => x.name));
    } },
    neighbors: { label: 'Γείτονες & Σύνορα', icon: '🧭', gen(r, d) {
      const c = pick(r, byTier(d).filter((x) => x.borders.length >= 1));
      const nonB = similar(c, Math.max(d, 2)).filter((x) => !c.borders.includes(x.code) && x.code !== c.code);
      if (c.borders.length >= 3 && r() < 0.4) { // «ποια ΔΕΝ συνορεύει»
        const odd = pick(r, nonB); if (!odd) return null;
        const opts = shuffle(r, [odd.name, ...shuffle(r, c.borders).slice(0, 3).map((b) => byCode[b].name)]);
        return { key: 'nb-not-' + c.code, text: `Ποια από αυτές τις χώρες ΔΕΝ συνορεύει με τη χώρα «${c.name}»;`, options: opts, answer: opts.indexOf(odd.name) };
      }
      const b = byCode[pick(r, c.borders)];
      return mc(r, 'nb-' + c.code, `Ποια από αυτές τις χώρες συνορεύει με τη χώρα «${c.name}»;`, b.name, nonB.map((x) => x.name));
    } },
    population: { label: 'Πληθυσμός', icon: '👥', gen(r, d) {
      return compareQ(r, d, 'population', 'Ποια από αυτές τις χώρες έχει τον μεγαλύτερο πληθυσμό;', 1.3);
    } },
    area: { label: 'Έκταση', icon: '📐', gen(r, d) {
      return compareQ(r, d, 'area', 'Ποια από αυτές τις χώρες έχει τη μεγαλύτερη έκταση;', 1.15);
    } },
    currency: { label: 'Νομίσματα', icon: '💶', gen(r, d) {
      const c = pick(r, byTier(d).filter((x) => x.currency));
      return mc(r, 'cur-' + c.code, `Ποιο είναι το νόμισμα της χώρας «${c.name}»;`, c.currency, C.filter((x) => x.currency).map((x) => x.currency));
    } },
    peaks: { label: 'Βουνά', icon: '⛰️', gen(r, d) {
      if (d === 3 && r() < 0.35) { const [cont, peak] = pick(r, X.continentPeaks); return mc(r, 'cp-' + cont, `Ποια είναι η ψηλότερη κορυφή της ${cont};`, peak, X.continentPeaks.map((x) => x[1]).concat(['Λευκό Όρος', 'Ελμπρούς'])); }
      const list = C.filter((x) => x.highest && (d === 1 ? x.tier === 1 : d === 2 ? x.tier <= 2 : true));
      const c = pick(r, list);
      return mc(r, 'pk-' + c.code, `Ποιο είναι το ψηλότερο βουνό της χώρας «${c.name}»;`, c.highest, C.filter((x) => x.highest).map((x) => x.highest));
    } },
    rivers: { label: 'Ποτάμια', icon: '🌊', gen(r, d) {
      if (r() < 0.2) { const cap = pick(r, X.danubeCapitals); return mc(r, 'dan-' + cap, 'Από ποια πρωτεύουσα περνάει ο ποταμός Δούναβης;', cap, ['Πράγα', 'Βαρσοβία', 'Βουκουρέστι', 'Σόφια', 'Ζάγκρεμπ', 'Λιουμπλιάνα', 'Βερολίνο']); }
      const [riv, city] = pick(r, X.riverCities);
      return mc(r, 'riv-' + riv, `Από ποια πόλη περνάει ο ποταμός ${riv};`, city, X.riverCities.map((x) => x[1]));
    } },
    continents: { label: 'Ήπειροι', icon: '🌍', gen(r, d) {
      const c = pick(r, C.filter((x) => !TRANSCONT.has(x.code) && x.tier >= Math.min(d, 2) && x.tier <= d + 1));
      if (!c) return null;
      const opts = ['Ευρώπη', 'Ασία', 'Αφρική', 'Αμερική', 'Ωκεανία'];
      return mc(r, 'cont-' + c.code, `Σε ποια ήπειρο βρίσκεται η χώρα «${c.name}»;`, c.region, opts);
    } },
    greece: { label: 'Ελλάδα', icon: '🇬🇷', gen(r, d) {
      const t = r();
      if (t < 0.45) {
        const groups = Object.keys(X.islandGroups); const g = pick(r, groups); const isl = pick(r, X.islandGroups[g]);
        return mc(r, 'isl-' + isl, `Σε ποιο σύμπλεγμα ανήκει το νησί ${isl};`, g, groups);
      }
      if (t < 0.85) {
        const k = pick(r, Object.keys(X.prefectures));
        return mc(r, 'pref-' + k, `Ποια είναι η πρωτεύουσα του νομού ${k};`, X.prefectures[k], Object.values(X.prefectures));
      }
      const big = X.biggestIslands; const set = shuffle(r, big).slice(0, 4);
      const best = set.slice().sort((a, b) => big.indexOf(a) - big.indexOf(b))[0];
      const opts = shuffle(r, set);
      return { key: 'bigisl-' + set.slice().sort().join(), text: 'Ποιο από αυτά τα νησιά είναι το μεγαλύτερο σε έκταση;', options: opts, answer: opts.indexOf(best) };
    } },
  };
  function compareQ(r, d, field, text, minRatio) {
    const pool = C.filter((x) => x[field] > 0 && x.tier <= Math.max(d, 2));
    for (let tries = 0; tries < 40; tries++) {
      const set = shuffle(r, pool).slice(0, 4).sort((a, b) => b[field] - a[field]);
      const ratio = set[0][field] / set[1][field];
      const max = d === 1 ? 99 : d === 2 ? 3 : 1.8; // πιο κοντινές τιμές = πιο δύσκολο
      if (ratio < minRatio || ratio > max) continue;
      if (d === 1 && ratio < 2) continue;
      const opts = shuffle(r, set.map((x) => x.name));
      const unit = field === 'area' ? ' km²' : '';
      return { key: field + '-' + set.map((x) => x.code).sort().join(), text, options: opts, answer: opts.indexOf(set[0].name),
        explain: set.map((x) => `${x.name}: ${fmtNum(Math.round(x[field]))}${unit}`).join(' · ') };
    }
    return null;
  }

  // ---------- κοινά αθλητικά ----------
  const yearDiff = (y, a, b) => (y >= a ? 1 : y >= b ? 2 : 3);
  function yearQ(r, d, map, a, b, keyPfx, textFn) {
    const years = Object.keys(map).map(Number).filter((y) => yearDiff(y, a, b) === d);
    if (!years.length) return null;
    const y = pick(r, years);
    return mc(r, keyPfx + y, textFn(y), map[y], Object.values(map));
  }
  function careerQ(r, d, list, sport) {
    const p = pick(r, list.filter((x) => x.d === d));
    if (!p) return null;
    return mc(r, sport + '-car-' + p.n, 'Ποιος παίκτης είχε αυτή τη διαδρομή;', p.n, list.map((x) => x.n), { type: 'career', clubs: p.c });
  }
  function pairQ(r, d, list, keyPfx, textFn) { // list: [ερώτημα, απάντηση, δυσκολία]
    const it = pick(r, list.filter((x) => x[2] === d));
    if (!it) return null;
    return mc(r, keyPfx + it[0], textFn(it[0]), it[1], list.map((x) => x[1]));
  }
  function fixedQ(r, d, list, keyPfx) {
    const f = pick(r, list.filter((x) => x[3] === d));
    if (!f) return null;
    const opts = shuffle(r, [f[1], ...f[2]]);
    return { key: keyPfx + f[0], text: f[0], options: opts, answer: opts.indexOf(f[1]) };
  }
  // «Ποιος έχει περισσότερα»: counts = {όνομα: αριθμός}
  function moreQ(r, d, counts, text, keyPfx) {
    const names = Object.keys(counts);
    for (let i = 0; i < 40; i++) {
      const set = shuffle(r, names).slice(0, 4).sort((a, b) => counts[b] - counts[a]);
      const gap = counts[set[0]] - counts[set[1]];
      if (gap < 1) continue;
      if (d === 1 && gap < 3) continue;
      if (d === 2 && (gap < 2 || gap > 4)) continue;
      if (d === 3 && gap !== 1) continue;
      const opts = shuffle(r, set);
      return { key: keyPfx + set.slice().sort().join(), text, options: opts, answer: opts.indexOf(set[0]), explain: set.map((n) => `${n}: ${counts[n]}`).join(' · ') };
    }
    return null;
  }
  const countVals = (map, norm) => { const o = {}; Object.values(map).forEach((v) => { v = norm ? norm(v) : v; o[v] = (o[v] || 0) + 1; }); return o; };

  // ---------- ΜΠΑΣΚΕΤ ----------
  const B = window.BASKETBALL || {};
  const basketball = {
    careers: { label: 'Καριέρα', icon: '🧳', gen: (r, d) => careerQ(r, d, B.careers, 'bb') },
    nba: { label: 'Πρωταθλήματα NBA', icon: '🏀', gen: (r, d) => yearQ(r, d, B.nbaChampions, 2010, 1995, 'nba-', (y) => `Ποια ομάδα κατέκτησε το πρωτάθλημα NBA το ${y};`) },
    mvp: { label: 'MVP', icon: '🌟', gen(r, d) {
      if (r() < 0.5) return yearQ(r, d, B.mvp, 2012, 2000, 'mvp-', (y) => `Ποιος ήταν ο MVP της κανονικής περιόδου του NBA το ${y};`);
      return yearQ(r, d, B.finalsMvp, 2012, 2000, 'fmvp-', (y) => `Ποιος ήταν ο MVP των τελικών του NBA το ${y};`);
    } },
    euroleague: { label: 'Euroleague', icon: '🇪🇺', gen(r, d) {
      if (r() < 0.6) return yearQ(r, d, B.euroleague, 2012, 2003, 'el-', (y) => `Ποια ομάδα κατέκτησε την Euroleague το ${y};`);
      return yearQ(r, d, B.finalFourMvp, 2018, 2013, 'f4-', (y) => `Ποιος ήταν ο MVP του Final Four της Euroleague το ${y};`);
    } },
    national: { label: 'Εθνικές ομάδες', icon: '🌐', gen: (r, d) => yearQ(r, d, B.eurobasket, 2005, 1995, 'ebk-', (y) => `Ποια χώρα κατέκτησε το Eurobasket του ${y};`) },
    jerseys: { label: 'Φανέλες', icon: '👕', gen(r, d) {
      const it = pick(r, B.jerseys.filter((x) => x[2] === d)); if (!it) return null;
      const nums = []; for (let i = 0; i <= 99; i++) nums.push(String(i));
      return mc(r, 'jer-' + it[0], `Ποιο νούμερο φανέλας είναι συνδεδεμένο με τον παίκτη ${it[0]};`, it[1], d === 1 ? B.jerseys.map((x) => x[1]) : nums);
    } },
    cities: { label: 'Ομάδες & Πόλεις', icon: '🏙️', gen(r, d) {
      if (r() < 0.65) return pairQ(r, d, B.nbaCities, 'nbac-', (t) => `Σε ποια πόλη έχουν έδρα οι ${t};`);
      return pairQ(r, d, B.euroCities, 'euc-', (t) => `Σε ποια πόλη έχει έδρα η ${t};`);
    } },
    more: { label: 'Ποιος έχει περισσότερα;', icon: '📊', gen(r, d) {
      const t = r();
      if (t < 0.4) return moreQ(r, d, B.nbaTitles, 'Ποια ομάδα έχει τα περισσότερα πρωταθλήματα NBA (έως το 2025);', 'mnba-');
      if (t < 0.75) return moreQ(r, d, B.euroleagueTitles, 'Ποια ομάδα έχει τις περισσότερες Euroleague (έως το 2025);', 'mel-');
      const order = B.scoringOrder; const set = shuffle(r, order).slice(0, 4);
      const best = set.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
      const opts = shuffle(r, set);
      return { key: 'mpts-' + set.slice().sort().join(), text: 'Ποιος έχει σημειώσει περισσότερους πόντους στην κανονική περίοδο του NBA;', options: opts, answer: opts.indexOf(best) };
    } },
    fixed: { label: 'Ιστορικές στιγμές', icon: '📜', gen: (r, d) => fixedQ(r, d, B.fixed, 'bbfx-') },
  };

  // Παίρνει ερώτηση από κατηγορία, αποφεύγοντας επαναλήψεις. Αν δεν βρει στη ζητούμενη δυσκολία, δοκιμάζει γειτονική.
  function generate(topic, cat, rng, diff, used) {
    const g = QUIZ_TOPICS[topic][cat];
    const order = [diff, diff === 3 ? 2 : diff + 1, diff === 1 ? 3 : diff - 1];
    for (const d of order) {
      for (let i = 0; i < 30; i++) {
        let q = null;
        try { q = g.gen(rng, d); } catch (e) { q = null; }
        if (q && q.answer >= 0 && !used.has(q.key)) { used.add(q.key); q.diff = diff; q.cat = cat; return JSON.parse(JSON.stringify(q)); }
      }
    }
    return null;
  }

  const QUIZ_TOPICS = { geo, basketball };
  window.QUIZ_TOPICS = QUIZ_TOPICS;
  window.QZ = { mulberry32, shuffle, pick, generate };
})();
