// Quizball: κατηγορίες, γεννήτριες ερωτήσεων, κανόνες (draft → ταμπλό → γραπτές απαντήσεις) και Η/Υ.
(function () {
  const D = window.QBD;
  const M = window.QZMatch;
  const F = window.FOOTBALL || {};
  const { shuffle, pick } = window.QZ;

  // ---------- βοηθητικά δεδομένων ----------
  const P = D.people, TM = D.teams;
  const pName = (id) => (P[id] ? P[id].n : String(id).replace(/^\?/, ''));
  const pNames = (id) => (P[id] ? [P[id].n, ...(P[id].a || [])] : [pName(id)]);
  const tName = (k) => (TM[k] ? TM[k].n : k);
  const tNames = (k) => (TM[k] ? [TM[k].n, ...(TM[k].a || [])] : [k]);
  const fameDiff = (f) => (f >= D.fame[0] ? 1 : f >= D.fame[1] ? 2 : 3);
  // σύλλογοι: f = πόσοι γνωστοί παίκτες τους υπάρχουν στα δεδομένα
  // πρόσφατοι παίκτες για εύκολες/μέτριες, παλιότεροι μόνο στις δύσκολες
  const lastYear = (p) => Math.max(...(p.cl || p.mc || [[0, 0, 0]]).map((c) => c[2] || c[1] || 0), 0) || 2026;
  const era = (p, d) => lastYear(p) >= (d === 3 ? 1955 : 1985);
  const teamDiff = (f) => (f >= 100 ? 1 : f >= 40 ? 2 : f >= 15 ? 3 : 0);
  const yrs = (y0, y1) => (y1 === y0 ? String(y0) : `${y0}–${y1 || ''}`);
  const COMP = {
    UCL: (y) => (y >= 1993 ? 'Champions League' : 'Κύπελλο Πρωταθλητριών'),
    WC: () => 'Μουντιάλ', EURO: () => 'Euro', UEL: (y) => (y >= 2010 ? 'Europa League' : 'Κύπελλο UEFA'), UECL: () => 'Conference League',
  };
  const compName = (m) => COMP[m.comp](m.year);
  const compGen = (m) => compName(m).replace('Κύπελλο ', 'Κυπέλλου '); // γενική πτώση
  const matchLabel = (m) => `Τελικός ${compGen(m)} ${m.year}`;
  const matchLabelLow = (m) => `τελικό του ${compGen(m)} ${m.year}`;
  const winnerIdx = (m) => (m.sc[0] !== m.sc[1] ? (m.sc[0] > m.sc[1] ? 0 : 1) : m.pens ? (m.pens[0] > m.pens[1] ? 0 : 1) : -1);
  // δυσκολία αγώνα: πρόσφατος + μεγάλη διοργάνωση = εύκολος
  const matchDiff = (m) => { const age = 2026 - m.year; const w = { WC: 0, UCL: 0, EURO: 5, UEL: 12, UECL: 12 }[m.comp]; const s = age + w; return s <= 12 ? 1 : s <= 30 ? 2 : 3; };
  const POSROW = { GK: 0, SW: 1, RB: 1, CB: 1, LB: 1, RWB: 1, LWB: 1, DF: 1, DM: 2, RM: 3, CM: 3, LM: 3, MF: 3, AM: 4, RW: 5, LW: 5, RF: 5, LF: 5, CF: 5, SS: 5, ST: 5, FW: 5 };
  const lineupRows = (xi) => { const rows = [[], [], [], [], [], []]; xi.forEach((p) => rows[POSROW[p[0]] ?? 3].push(p)); return rows.filter((r) => r.length); };

  // ---------- κατηγορίες ----------
  // Κάθε gen(r, diff) επιστρέφει ερώτηση ή null. kind: text | top5 | footballer | score
  const T = (key, prompt, names, ak, extra) => Object.assign({ kind: 'text', key, prompt, ans: { list: [names], ak }, reveal: names[0] }, extra || {});
  const decided = D.matches.filter((m) => m.sc && winnerIdx(m) >= 0);

  const CATS = {
    history: { label: 'Ιστορία', icon: '📜', desc: 'Ιστορικές ποδοσφαιρικές ερωτήσεις', gen(r, d) {
      const t = r();
      if (t < 0.25 && F.ballonDor) {
        const ys = Object.keys(F.ballonDor).map(Number).filter((y) => (y >= 2008 ? 1 : y >= 1998 ? 2 : 3) === d);
        if (!ys.length) return null; const y = pick(r, ys);
        return T('bd' + y, `Ποιος κέρδισε τη Χρυσή Μπάλα το ${y};`, [F.ballonDor[y]], 'person');
      }
      const m = pick(r, decided.filter((x) => matchDiff(x) === d)); if (!m) return null;
      const w = winnerIdx(m);
      if (t < 0.6) return T('win' + m.id, `Ποια ομάδα κατέκτησε το ${compName(m)} το ${m.year};`, tNames(m.t[w]), 'club');
      if (t < 0.8) return T('lose' + m.id, `Ποια ομάδα έχασε στον τελικό του ${compGen(m)} το ${m.year};`, tNames(m.t[1 - w]), 'club');
      const mg = m.lu && m.lu[w] && m.lu[w].mgr; if (!mg) return null;
      return T('mgr' + m.id, `Ποιος ήταν ο προπονητής της ομάδας «${tName(m.t[w])}» όταν κατέκτησε το ${compName(m)} το ${m.year};`, pNames(mg), 'person');
    } },
    geography: { label: 'Γεωγραφία', icon: '🌍', desc: 'Ποδόσφαιρο και γεωγραφία: πόλεις, χώρες, γήπεδα', gen(r, d) {
      const t = r();
      if (t < 0.35) {
        const m = pick(r, D.matches.filter((x) => x.city && matchDiff(x) === d)); if (!m) return null;
        return T('city' + m.id, `Σε ποια πόλη έγινε ο τελικός του ${compGen(m)} ${m.year};`, [m.city], 'city');
      }
      const clubs = Object.entries(TM).filter(([k, v]) => !k.startsWith('N:') && v.f && teamDiff(v.f) === d);
      if (t < 0.7) {
        const [k, c] = pick(r, clubs.filter(([, v]) => v.city) ) || []; if (!c) return null;
        return T('ccity' + k, `Σε ποια πόλη έχει την έδρα της η ομάδα «${c.n}»;`, [c.city], 'city');
      }
      const [k, c] = pick(r, clubs.filter(([, v]) => v.cn)) || []; if (!c) return null;
      return T('ccn' + k, `Σε ποια χώρα ανήκει η ομάδα «${c.n}»;`, [c.cn], 'country');
    } },
    missing: { label: 'Ποιος λείπει', icon: '🧩', desc: 'Βρες τον παίκτη που λείπει από την 11άδα', gen(r, d) {
      const m = pick(r, D.matches.filter((x) => x.lu && matchDiff(x) <= d + 1 && matchDiff(x) >= d - 1)); if (!m) return null;
      const side = r() < 0.5 ? 0 : 1; const xi = m.lu[side].xi;
      const cand = xi.map((p, i) => [p, i]).filter(([p]) => P[p[2]] && fameDiff(P[p[2]].f) === d);
      if (!cand.length) return null;
      const [p, idx] = pick(r, cand);
      const rows = lineupRows(xi.map((x, i) => [x[0], x[1], i === idx ? null : x[3]]));
      return T('miss' + m.id + side + idx, `${matchLabel(m)}: ${tName(m.t[side])} – ${tName(m.t[1 - side])}. Ποιος λείπει από την 11άδα της ομάδας «${tName(m.t[side])}»;`, pNames(p[2]), 'person', { media: { type: 'lineup', rows } });
    } },
    combo: { label: 'Club Combo', icon: '🔗', desc: 'Βρες παίκτη που έχει αγωνιστεί και στις 2 ομάδες', gen(r, d) {
      const pair = pick(r, D.combos.filter((c) => c.d === d)); if (!pair) return null;
      return { kind: 'text', key: 'combo' + pair.a + pair.b, prompt: 'Βρες έναν ποδοσφαιριστή που έχει αγωνιστεί και στις δύο ομάδες.',
        media: { type: 'pair', a: tName(pair.a), b: tName(pair.b) }, ans: { list: pair.p.map(pNames), ak: 'person' },
        reveal: pair.p.slice(0, 6).map(pName).join(', ') + (pair.p.length > 6 ? ` και άλλοι ${pair.p.length - 6}` : '') };
    } },
    playerId: { label: 'Player ID', icon: '🪪', desc: 'Βρες τον παίκτη από την καριέρα του', gen(r, d) {
      const ids = Object.keys(P).filter((k) => P[k].cl && P[k].cl.length >= 3 && fameDiff(P[k].f) === d && era(P[k], d));
      const id = pick(r, ids); if (!id) return null;
      return T('pid' + id, 'Ποιος ποδοσφαιριστής είχε αυτή την καριέρα;', pNames(id), 'person',
        { media: { type: 'career', rows: P[id].cl.map((c) => [yrs(c[1], c[2]), tName(c[0]) + (c[3] ? ' (δανεικός)' : '')]) } });
    } },
    managerId: { label: 'Manager ID', icon: '📋', desc: 'Βρες τον προπονητή από την καριέρα του', gen(r, d) {
      const ids = Object.keys(P).filter((k) => P[k].mc && P[k].mc.length >= 3 && P[k].f >= 40 && fameDiff(P[k].f) === d
        && P[k].mc.filter((c) => (TM[c[0]] || {}).f >= 10 || String(c[0]).startsWith('N:')).length >= 3);
      const id = pick(r, ids); if (!id) return null;
      return T('mid' + id, 'Ποιος προπονητής είχε αυτή την καριέρα;', pNames(id), 'person',
        { media: { type: 'career', rows: P[id].mc.map((c) => [yrs(c[1], c[2]), tName(c[0])]) } });
    } },
    nations: { label: 'Nations XI', icon: '🏳️', desc: 'Βρες την ομάδα από τις εθνικότητες της 11άδας', gen(r, d) {
      const opts = [];
      D.matches.forEach((m) => (m.lu || []).forEach((l, side) => { if (!m.t[side].startsWith('N:') && l.xi.every((x) => x[1])) opts.push([m, side]); }));
      const [m, side] = pick(r, opts.filter(([x]) => matchDiff(x) === d)) || []; if (!m) return null;
      const rows = lineupRows(m.lu[side].xi.map((x) => [x[0], x[1], null]));
      return T('nat' + m.id + side, `${matchLabel(m)}: ποια ομάδα παρατάχθηκε με αυτές τις εθνικότητες;`, tNames(m.t[side]), 'club', { media: { type: 'flags', rows } });
    } },
    top5: { label: 'Top 5', icon: '🖐️', desc: 'Βρες και τα 5. Έχεις ένα μαξιλαράκι για λάθος', gen(r, d) {
      const l = pick(r, D.top5.filter((x) => x.d === d)) || pick(r, D.top5); if (!l) return null;
      return { kind: 'top5', key: 'top5' + l.label, prompt: l.label, items: l.items.map((i) => ({ names: [i.n, ...(i.a || [])], label: i.n, v: i.v })), ak: l.ak || 'person', note: l.note || '' };
    } },
    transfer: { label: 'Retro Transfer', icon: '🔁', desc: 'Βρες ποιος έκανε αυτή τη μεταγραφή', gen(r, d) {
      const tr = pick(r, D.transfers.filter((x) => fameDiff(P[x.p].f) === d && era(P[x.p], d))); if (!tr) return null;
      return T('tr' + tr.p + tr.to, 'Ποιος ποδοσφαιριστής έκανε αυτή τη μεταγραφή;', pNames(tr.p), 'person',
        { media: { type: 'transfer', from: tName(tr.from), to: tName(tr.to), when: tr.w } });
    } },
    score: { label: 'Guess The Score', icon: '🎯', desc: 'Βρες το σκορ (1 πόντος) και όλους τους σκόρερ (1 πόντος)', gen(r, d) {
      const m = pick(r, D.matches.filter((x) => x.sc && x.g && matchDiff(x) === d)); if (!m) return null;
      const req = []; const seen = new Set();
      m.g.forEach((side) => side.forEach(([pid, n, og]) => { if (!og && !seen.has(pid)) { seen.add(pid); req.push({ names: pNames(pid), label: pName(pid) }); } }));
      const ogs = m.g.reduce((n, side) => n + side.filter((x) => x[2]).reduce((a, x) => a + x[1], 0), 0);
      return { kind: 'score', key: 'gts' + m.id, prompt: `${matchLabel(m)}`, teams: [tName(m.t[0]), tName(m.t[1])], sc: m.sc, scorers: req,
        note: (m.aet ? 'Το σκορ μετά την παράταση (χωρίς πέναλτι).' : 'Το τελικό σκορ.') + (ogs ? ` Στα γκολ υπάρχει ${ogs === 1 ? 'ένα αυτογκόλ, που δεν μετράει' : ogs + ' αυτογκόλ, που δεν μετράνε'} στους σκόρερ.` : ''),
        reveal: `${m.sc[0]}–${m.sc[1]}${m.pens ? ` (πέναλτι ${m.pens[0]}–${m.pens[1]})` : ''}. Σκόρερ: ${req.map((x) => x.label).join(', ') || 'κανένας'}` };
    } },
    lost: { label: 'Lost Files', icon: '🗂️', desc: 'Συμπλήρωσε ό,τι λείπει από τη δήλωση', gen(r, d) {
      const t = r();
      const m = pick(r, decided.filter((x) => matchDiff(x) === d)); if (!m) return null;
      const w = winnerIdx(m);
      if (t < 0.3) return T('lw' + m.id, `Η ομάδα «___» κατέκτησε το ${compName(m)} το ${m.year}, νικώντας στον τελικό την ομάδα «${tName(m.t[1 - w])}».`, tNames(m.t[w]), 'club');
      if (t < 0.6) {
        const side = r() < 0.5 ? 0 : 1; const sc = m.g[side].filter((x) => !x[2]); if (!sc.length) return null;
        return { kind: 'text', key: 'ls' + m.id + side, prompt: `Ο ___ σκόραρε για την ομάδα «${tName(m.t[side])}» στον ${matchLabelLow(m)}.`, ans: { list: sc.map((x) => pNames(x[0])), ak: 'person' }, reveal: sc.map((x) => pName(x[0])).join(', ') };
      }
      if (t < 0.8 && m.lu && m.lu[w].mgr) return T('lm' + m.id, `Ο ___ ήταν ο προπονητής της ομάδας «${tName(m.t[w])}» που κατέκτησε το ${compName(m)} το ${m.year}.`, pNames(m.lu[w].mgr), 'person');
      const tr = pick(r, D.transfers.filter((x) => fameDiff(P[x.p].f) === d)); if (!tr) return null;
      return T('lt' + tr.p + tr.to, `Ο ${pName(tr.p)} πήγε από την ομάδα «${tName(tr.from)}» στην ομάδα «___» (${tr.w}).`, tNames(tr.to), 'club');
    } },
    footballer: { label: 'Guess The Footballer', icon: '🕵️', desc: '3 στοιχεία: απάντησε νωρίς για περισσότερους πόντους', gen(r, d) {
      const ids = Object.keys(P).filter((k) => P[k].cl && P[k].cl.length >= 2 && P[k].born && fameDiff(P[k].f) === d && era(P[k], d));
      const id = pick(r, ids); if (!id) return null; const p = P[id];
      const c1 = [`Γεννήθηκε το ${p.born}${p.bp ? ` (${p.bp})` : ''}.`, p.pos ? `Θέση: ${p.pos}.` : ''].join(' ').trim();
      const c2 = `${p.natName ? `Εθνικότητα: ${p.natName}. ` : ''}Έχει αγωνιστεί σε ${new Set(p.cl.map((c) => c[0])).size} ομάδες. Πρώτη ομάδα: ${tName(p.cl[0][0])}.`;
      const c3 = `Ομάδες: ${[...new Set(p.cl.map((c) => tName(c[0])))].join(', ')}.`;
      return { kind: 'footballer', key: 'gtf' + id, prompt: 'Ποιος είναι ο ποδοσφαιριστής;', clues: [c1, c2, c3], ans: { list: [pNames(id)], ak: 'person' }, reveal: pName(id) };
    } },
  };

  function generate(cat, r, diff, used) {
    const order = [diff, diff === 3 ? 2 : diff + 1, diff === 1 ? 3 : diff - 1];
    for (const d of order) for (let i = 0; i < 40; i++) {
      let q = null; try { q = CATS[cat].gen(r, d); } catch (e) { q = null; }
      if (q && !used.has(q.key)) { used.add(q.key); q.cat = cat; q.diff = diff; return q; }
    }
    return null;
  }

  // ---------- έλεγχος απαντήσεων ----------
  const okText = (q, text) => q.ans.list.some((names) => M.matches(text, names, q.ans.ak));

  // ---------- κανόνες ----------
  const CAT_IDS = Object.keys(CATS);
  function newGame(quiz, settings, names, rng, cpu) {
    return {
      quiz, format: 'qb', players: names.map((n, i) => ({ name: n, score: 0, cpu: !!(cpu && i === 1) })),
      turn: 0, phase: 'draft', drafted: [], board: null, current: null, used: [], history: [], seq: 0,
    };
  }
  function buildBoard(st, rng) {
    const total = pick(rng, [16, 18, 20]);
    // 16 ερωτήσεις = 8 κατηγορίες × 2· για 18/20, 2/4 κατηγορίες παίρνουν 3η ερώτηση
    const three = new Set(shuffle(rng, st.drafted.map((d) => d.cat)).slice(0, total - 16));
    const used = new Set(st.used);
    st.board = st.drafted.map(({ cat, by }) => {
      const diffs = three.has(cat) ? [1, 2, 3] : shuffle(rng, [1, 2, 3]).slice(0, 2).sort();
      const cells = diffs.map((diff) => ({ diff, q: generate(cat, rng, diff, used), by: null, got: 0 }));
      return { cat, label: CATS[cat].label, icon: CATS[cat].icon, by, cells: cells.filter((c) => c.q) };
    });
    // ίσος αριθμός ερωτήσεων για τους δύο παίκτες
    const n = st.board.reduce((s, c) => s + c.cells.length, 0);
    if (n % 2) { const col = st.board.slice().sort((a, b) => b.cells.length - a.cells.length)[0]; col.cells.pop(); }
    st.used = [...used];
  }
  const maxPts = (q, diff) => (q.kind === 'top5' || q.kind === 'footballer' ? 3 : q.kind === 'score' ? 2 : diff);
  function award(st, pts) { st.current.got += pts; st.players[st.turn].score += pts; }
  function endQuestion(st) {
    const c = st.current; const cell = st.board[c.cell[0]].cells[c.cell[1]];
    cell.by = st.turn; cell.got = c.got; c.done = true;
    st.history.push({ p: st.turn, pts: c.got, max: c.max, ok: c.got > 0 });
    st.phase = 'reveal';
  }
  function apply(prev, a, by, now, rng) {
    const st = JSON.parse(JSON.stringify(prev));
    st.seq = (st.seq || 0) + 1;
    if (st.phase === 'over') return null;
    if (a.type === 'draft') {
      if (st.phase !== 'draft' || by !== st.turn || !CATS[a.cat] || st.drafted.some((d) => d.cat === a.cat)) return null;
      st.drafted.push({ cat: a.cat, by });
      if (st.drafted.length >= 8) { buildBoard(st, rng); st.phase = 'choose'; st.turn = 0; }
      else st.turn = 1 - st.turn;
      return st;
    }
    if (a.type === 'choose') {
      if (st.phase !== 'choose' || by !== st.turn) return null;
      const [ci, ri] = a.cell || []; const cell = st.board[ci] && st.board[ci].cells[ri];
      if (!cell || cell.by !== null) return null;
      const q = cell.q;
      st.current = { q, cell: [ci, ri], diff: cell.diff, max: maxPts(q, cell.diff), got: 0, step: 0, entries: [], found: [], misses: 0, clues: 1, scoreOk: null, scorersOk: null, ok: null };
      st.phase = 'question';
      return st;
    }
    const c = st.current;
    if (a.type === 'next') {
      if (st.phase !== 'reveal') return null;
      st.current = null;
      if (!st.board.some((col) => col.cells.some((x) => x.by === null))) {
        st.phase = 'over'; const [x, y] = st.players.map((p) => p.score); st.winner = x === y ? -1 : x > y ? 0 : 1; return st;
      }
      st.turn = 1 - st.turn; st.phase = 'choose';
      return st;
    }
    if (a.type === 'approve') { // ο αντίπαλος δέχεται απάντηση που απέρριψε το σύστημα
      if (by === st.turn || st.players.some((p) => p.cpu) || !c) return null;
      if (c.q.kind === 'top5') {
        if (st.phase !== 'question' || !c.lastWrong) return null;
        c.misses--; c.found.push(-1); c.entries.push({ t: c.lastWrong, ok: true, approved: true }); c.lastWrong = null; c.step++;
        if (c.found.length === 5) { award(st, 3); endQuestion(st); }
        return st;
      }
      if (st.phase !== 'reveal' || c.got >= c.max || c.approved) return null;
      c.approved = true;
      const add = c.q.kind === 'footballer' ? Math.max(1, 4 - c.clues) : c.max - c.got;
      award(st, add); c.ok = true; st.history[st.history.length - 1].pts = c.got; st.history[st.history.length - 1].ok = true;
      st.board[c.cell[0]].cells[c.cell[1]].got = c.got;
      return st;
    }
    if (st.phase !== 'question' || by !== st.turn) return null;
    const q = c.q; c.step++;
    if (q.kind === 'text' && a.type === 'answer') {
      c.entries.push({ t: a.text }); c.ok = okText(q, a.text || '');
      if (c.ok) award(st, c.diff);
      endQuestion(st); return st;
    }
    if (q.kind === 'footballer') {
      if (a.type === 'clue') { if (c.clues >= 3) return null; c.clues++; return st; }
      if (a.type === 'answer') { c.entries.push({ t: a.text }); c.ok = okText(q, a.text || ''); if (c.ok) award(st, 4 - c.clues); endQuestion(st); return st; }
    }
    if (q.kind === 'top5') {
      if (a.type === 'stop') {
        if (c.found.length !== 4) return null;
        award(st, c.misses === 0 ? 2 : 1); c.ok = true; endQuestion(st); return st;
      }
      if (a.type === 'answer') {
        const text = (a.text || '').trim(); if (!text) return null;
        const idx = q.items.findIndex((it, i) => !c.found.includes(i) && M.matches(text, it.names, q.ak));
        c.lastWrong = null;
        if (idx >= 0) { c.found.push(idx); c.entries.push({ t: text, ok: true, i: idx }); }
        else { c.misses++; c.entries.push({ t: text, ok: false }); c.lastWrong = text; }
        if (c.found.length === 5) { award(st, 3); c.ok = true; endQuestion(st); }
        else if (c.misses >= 2) { c.ok = false; endQuestion(st); }
        return st;
      }
    }
    if (q.kind === 'score' && a.type === 'score') {
      const ent = (a.scorers || []).map((x) => String(x).trim()).filter(Boolean);
      c.entries = ent.map((t) => ({ t }));
      c.scoreOk = +a.a === q.sc[0] && +a.b === q.sc[1];
      const hit = new Set(); let wrong = 0;
      ent.forEach((t) => { const i = q.scorers.findIndex((s) => M.matches(t, s.names, 'person')); if (i >= 0) hit.add(i); else wrong++; });
      c.scorersOk = hit.size === q.scorers.length && wrong === 0;
      award(st, (c.scoreOk ? 1 : 0) + (c.scorersOk ? 1 : 0)); c.ok = c.got > 0;
      endQuestion(st); return st;
    }
    return null;
  }

  // ---------- Αντίπαλος Η/Υ ----------
  const ACC = { easy: [0.55, 0.35, 0.2], medium: [0.78, 0.58, 0.4], hard: [0.92, 0.78, 0.6] };
  function aiAction(st, level, r) {
    const acc = ACC[level] || ACC.medium;
    if (st.phase === 'draft') return { type: 'draft', cat: pick(r, CAT_IDS.filter((k) => !st.drafted.some((d) => d.cat === k))) };
    if (st.phase === 'choose') {
      const free = []; st.board.forEach((col, ci) => col.cells.forEach((x, ri) => { if (x.by === null) free.push([ci, ri]); }));
      return { type: 'choose', cell: pick(r, free) };
    }
    if (st.phase !== 'question') return null;
    const c = st.current, q = c.q, p = acc[c.diff - 1];
    if (q.kind === 'text') return { type: 'answer', text: r() < p ? q.ans.list[0][0] : '—' };
    if (q.kind === 'footballer') {
      const need = level === 'hard' ? 1 : level === 'easy' ? 3 : 2;
      if (c.clues < need) return { type: 'clue' };
      return { type: 'answer', text: r() < p + 0.1 * (c.clues - 1) ? q.ans.list[0][0] : '—' };
    }
    if (q.kind === 'top5') {
      if (c.found.length === 4 && c.misses === 1 && r() < 0.7) return { type: 'stop' };
      const next = q.items.findIndex((it, i) => !c.found.includes(i));
      return { type: 'answer', text: r() < p + 0.15 ? q.items[next].label : '—' };
    }
    if (q.kind === 'score') {
      const s = r() < p * 0.6 ? q.sc : [q.sc[0] + 1, q.sc[1]];
      return { type: 'score', a: s[0], b: s[1], scorers: r() < p * 0.5 ? q.scorers.map((x) => x.label) : [] };
    }
    return null;
  }

  window.QB_CATS = CATS;
  window.QBFormat = { newGame, apply, aiAction, generate, CATS };
})();
