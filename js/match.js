// Έλεγχος γραπτών απαντήσεων: δέχεται ελληνικά ή λατινικά, χωρίς τόνους, με μικρά ορθογραφικά λάθη.
(function () {
  const GR = [
    ['ου', 'ou'], ['μπ', 'b'], ['ντ', 'd'], ['γκ', 'g'], ['γγ', 'ng'], ['τσ', 'ts'], ['τζ', 'tz'], ['αι', 'e'], ['ει', 'i'], ['οι', 'i'], ['υι', 'i'],
    ['αυ', 'av'], ['ευ', 'ev'], ['α', 'a'], ['β', 'v'], ['γ', 'g'], ['δ', 'd'], ['ε', 'e'], ['ζ', 'z'], ['η', 'i'], ['θ', 'th'], ['ι', 'i'],
    ['κ', 'k'], ['λ', 'l'], ['μ', 'm'], ['ν', 'n'], ['ξ', 'x'], ['ο', 'o'], ['π', 'p'], ['ρ', 'r'], ['σ', 's'], ['ς', 's'], ['τ', 't'],
    ['υ', 'i'], ['φ', 'f'], ['χ', 'h'], ['ψ', 'ps'], ['ω', 'o'],
  ];
  const STOP = new Set(['fc', 'cf', 'ac', 'afc', 'sc', 'ssc', 'cd', 'rcd', 'sl', 'sv', 'fk', 'sk', 'bk', 'ss', 'tsv', 'vfb', 'vfl', 'bv', 'ca', 'cr', 'us', 'as', 'pfc', 'jfc', 'sad', 'kv', 'rsc', 'osc', 'ogc', 'παε', 'ποδοσφαιρικη', 'ομαδα']);
  function base(s) {
    return String(s || '').toLowerCase().replace(/[ϊΐ]/g, '_ι').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\(.*?\)/g, ' ').replace(/\b([a-z])\.(?=[a-z]\.)/g, '$1').replace(/[^\p{L}\p{N}_ ]+/gu, ' ')
      .split(/\s+/).filter((w) => w && !STOP.has(w)).join(' ');
  }
  // «Σκελετός» ήχου: κοινή μορφή για ελληνικά και λατινικά
  // Επιστρέφει έναν ή περισσότερους σκελετούς (για αμφίσημα λατινικά γράμματα: j, ch)
  function skels(s) {
    let t = base(s);
    const greek = /[α-ω]/.test(t);
    if (greek) {
      t = t.replace(/γι(?=[αεηιοωυ])/g, 'i').replace(/τζ/g, 'g');
      for (const [g, l] of GR) t = t.split(g).join(l);
      t = t.replace(/_/g, '');
      return [fin(t)];
    }
    t = t.replace(/_/g, '').replace(/sh/g, 's').replace(/sch/g, 's');
    const outs = new Set();
    for (const j of ['i', 'g']) for (const ch of ['ts', 'k']) for (const x of ['ks', 'ts']) outs.add(fin(t.replace(/ch/g, ch).replace(/j/g, j).replace(/x/g, x)));
    return [...outs];
  }
  function fin(t) {
    return t.replace(/ph/g, 'f').replace(/th/g, 't').replace(/ck/g, 'k').replace(/c(?=[ei])/g, 's').replace(/c/g, 'k').replace(/q/g, 'k')
      .replace(/w/g, 'v').replace(/y/g, 'i').replace(/x/g, 'ks').replace(/z/g, 's').replace(/ou/g, 'u').replace(/oo/g, 'u')
      .replace(/oe/g, 'u').replace(/ai/g, 'e').replace(/ei/g, 'i').replace(/oi/g, 'i').replace(/ee/g, 'i').replace(/e/g, 'i').replace(/h/g, '')
      .replace(/nt|nd/g, 'd').replace(/mp|mb/g, 'b').replace(/ng|gk/g, 'g').replace(/(.)\1+/g, '$1');
  }
  const skel = (s) => skels(s)[0];
  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  const close = (a, b) => { const d = lev(a, b); return d === 0 || (Math.min(a.length, b.length) >= 5 && d <= Math.floor(Math.max(a.length, b.length) / 5)); };
  // Παραλλαγές ενός ονόματος: ολόκληρο, χωρίς παρενθέσεις, επώνυμο (τελευταία λέξη)
  const GENERIC = new Set(['real', 'manchester', 'sporting', 'athletic', 'atletico', 'dynamo', 'dinamo', 'olympique', 'borussia', 'racing', 'red', 'inter', 'union', 'deportivo', 'club', 'crvena', 'ρεαλ', 'μαντσεστερ', 'σπορτινγκ', 'ατλετικο', 'ντιναμο', 'ολιμπικ', 'μπορουσια', 'ρασινγκ', 'ιντερ', 'ντεπορτιβο', 'αθλετικ', 'αθλητικος']);
  // kind: 'person' -> δεκτό και σκέτο επώνυμο, 'club' -> δεκτή και η πρώτη χαρακτηριστική λέξη
  function variants(names, kind) {
    const out = new Set();
    for (const n of names || []) {
      const b = base(n); if (!b) continue;
      skels(n).forEach((x) => out.add(x));
      const parts = b.split(' ');
      if (parts.length < 2) continue;
      if (kind === 'person' && parts[parts.length - 1].length >= 4) skels(parts[parts.length - 1]).forEach((x) => out.add(x));
      if (kind === 'club' && parts[0].length >= 5 && !GENERIC.has(parts[0])) skels(parts[0]).forEach((x) => out.add(x));
    }
    return [...out];
  }
  // names: λίστα αποδεκτών ονομάτων για ΜΙΑ οντότητα
  function matches(text, names, kind) {
    const ss = skels(text).filter(Boolean); if (!ss.length) return false;
    const vs = variants(names, kind);
    return ss.some((s) => vs.some((v) => close(s, v)));
  }
  // Επιστρέφει τον δείκτη της πρώτης οντότητας (από λίστα ονομάτων) που ταιριάζει, ή -1
  function which(text, list, kind) { for (let i = 0; i < list.length; i++) if (matches(text, list[i], kind)) return i; return -1; }
  window.QZMatch = { matches, which, skel, base };
})();
