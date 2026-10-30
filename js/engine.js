// Κανόνες παιχνιδιών (reducer) + session που οδηγεί τοπικό / Η/Υ / online παιχνίδι.
(function () {
  const { mulberry32, shuffle, pick, generate } = window.QZ;
  const T = window.QUIZ_TOPICS;

  // ---------- Ορισμοί quiz ----------
  const QUIZZES = {
    football: {
      topic: 'football', title: 'Quizball', subtitle: 'Ποδοσφαιρικό quiz', format: 'qb',
      rules: 'Πριν ξεκινήσει το παιχνίδι, διαλέγετε εναλλάξ κατηγορίες μέχρι να γίνουν 8. Το ταμπλό έχει 16, 18 ή 20 ερωτήσεις: εύκολη = 1 πόντος, μέτρια = 2, δύσκολη = 3. Γράφεις ή λες την απάντηση, χωρίς χρονικό όριο.',
    },
    basketball: {
      topic: 'basketball', title: 'Crunch Time', subtitle: 'Μπασκετικό quiz', format: 'pick', timer: 24,
      rules: '4 περίοδοι, 4 επιθέσεις για τον κάθε παίκτη σε κάθε περίοδο. Σε κάθε επίθεση διαλέγεις: βολή (1 πόντος, εύκολη), δίποντο (2, μέτρια) ή τρίποντο (3, δύσκολη). Ισοπαλία = παράταση.',
      periods: 4, perPeriod: 4, overtime: 2,
      choices: [{ diff: 1, pts: 1, label: 'Βολή', hint: 'εύκολη' }, { diff: 2, pts: 2, label: 'Δίποντο', hint: 'μέτρια' }, { diff: 3, pts: 3, label: 'Τρίποντο', hint: 'δύσκολη' }],
    },
    geo: {
      topic: 'geo', title: 'Γεωγραφία', subtitle: 'Σημαίες, χάρτες, πρωτεύουσες και άλλα', format: 'pick', timer: 20,
      rules: 'Σε κάθε γύρο ο κάθε παίκτης διαλέγει δυσκολία: εύκολη (1 πόντος), μέτρια (2) ή δύσκολη (3). Η κατηγορία βγαίνει τυχαία από όσες επέλεξες.',
      periods: 1, perPeriod: 10, overtime: 0,
      choices: [{ diff: 1, pts: 1, label: 'Εύκολη', hint: '1 πόντος' }, { diff: 2, pts: 2, label: 'Μέτρια', hint: '2 πόντοι' }, { diff: 3, pts: 3, label: 'Δύσκολη', hint: '3 πόντοι' }],
    },
  };

  // ---------- Δημιουργία αρχικής κατάστασης ----------
  function newGame(quizId, settings, names, rng, cpu) {
    const Q = QUIZZES[quizId];
    if (Q.format === 'qb') return window.QBFormat.newGame(quizId, settings, names, rng, cpu);
    const cats = (settings.cats && settings.cats.length ? settings.cats : Object.keys(T[Q.topic]));
    const st = {
      quiz: quizId, format: Q.format, cats, timer: Q.timer,
      players: names.map((n) => ({ name: n, score: 0 })),
      turn: 0, phase: 'choose', current: null, used: [], history: [],
    };
    if (Q.format === 'board') {
      const chosen = shuffle(rng, cats).slice(0, Q.boardCats);
      const used = new Set();
      st.board = chosen.map((cat) => ({
        cat, label: T[Q.topic][cat].label, icon: T[Q.topic][cat].icon,
        cells: Q.boardPoints.map((pts, i) => ({ pts, diff: i + 1, q: generate(Q.topic, cat, rng, i + 1, used), by: null, ok: null })),
      }));
      st.board.forEach((c) => c.cells.forEach((cell) => { if (!cell.q) cell.by = -1; })); // κενό κελί αν δεν βγήκε ερώτηση
      st.used = [...used];
    } else {
      st.period = 1; st.periods = Q.periods; st.perPeriod = settings.rounds || Q.perPeriod; st.count = 0; st.ot = 0;
    }
    return st;
  }

  // ---------- Reducer ----------
  // Επιστρέφει νέα κατάσταση ή null αν η ενέργεια δεν επιτρέπεται.
  function apply(prev, a, by, now, rng) {
    if (prev.format === 'qb') return window.QBFormat.apply(prev, a, by, now, rng);
    const st = JSON.parse(JSON.stringify(prev));
    const Q = QUIZZES[st.quiz];
    if (st.phase === 'over') return null;
    if (a.type === 'choose') {
      if (st.phase !== 'choose' || by !== st.turn) return null;
      let q, pts, cell = null;
      if (st.format === 'board') {
        const [ci, ri] = a.cell || [];
        const c = st.board[ci] && st.board[ci].cells[ri];
        if (!c || c.by !== null) return null;
        q = c.q; pts = c.pts; cell = [ci, ri];
      } else {
        const ch = Q.choices.find((x) => x.diff === a.diff); if (!ch) return null;
        const used = new Set(st.used);
        const cats = shuffle(rng, st.cats);
        for (const cat of cats) { q = generate(Q.topic, cat, rng, ch.diff, used); if (q) break; }
        if (!q) return null;
        st.used = [...used]; pts = ch.pts;
      }
      st.current = { q, pts, cell, deadline: now + st.timer * 1000, chosen: null, ok: null };
      st.phase = 'question';
      return st;
    }
    if (a.type === 'answer' || a.type === 'timeout') {
      if (st.phase !== 'question') return null;
      if (a.type === 'answer' && by !== st.turn) return null;
      if (a.type === 'timeout' && now < st.current.deadline) return null;
      const idx = a.type === 'answer' ? a.idx : -1;
      const ok = idx === st.current.q.answer;
      st.current.chosen = idx; st.current.ok = ok;
      if (ok) st.players[st.turn].score += st.current.pts;
      if (st.current.cell) { const c = st.board[st.current.cell[0]].cells[st.current.cell[1]]; c.by = st.turn; c.ok = ok; }
      st.history.push({ p: st.turn, pts: st.current.pts, ok });
      st.phase = 'reveal'; st.revealUntil = now + 2600;
      return st;
    }
    if (a.type === 'next') {
      if (st.phase !== 'reveal') return null;
      st.current = null;
      if (st.format === 'board') {
        const left = st.board.some((c) => c.cells.some((x) => x.by === null));
        if (!left) return finish(st);
        st.turn = 1 - st.turn; st.phase = 'choose';
        return st;
      }
      st.count++;
      const per = st.period > st.periods ? Q.overtime : st.perPeriod;
      if (st.count >= per * 2) {
        st.count = 0; st.period++;
        const tied = st.players[0].score === st.players[1].score;
        if (st.period > st.periods && !(tied && Q.overtime && st.ot < 3)) return finish(st);
        if (st.period > st.periods) st.ot++;
        st.turn = (st.period - 1) % 2; // εναλλαγή ποιος ξεκινά την περίοδο
      } else st.turn = 1 - st.turn;
      st.phase = 'choose';
      return st;
    }
    return null;
  }
  function finish(st) {
    st.phase = 'over';
    const [a, b] = st.players.map((p) => p.score);
    st.winner = a === b ? -1 : a > b ? 0 : 1;
    return st;
  }

  // ---------- Αντίπαλος Η/Υ ----------
  const AI = {
    easy: { acc: [0.6, 0.4, 0.25], bias: [0.55, 0.3, 0.15], delay: [3500, 7000] },
    medium: { acc: [0.82, 0.62, 0.45], bias: [0.35, 0.4, 0.25], delay: [2500, 6000] },
    hard: { acc: [0.94, 0.82, 0.66], bias: [0.2, 0.35, 0.45], delay: [1800, 4500] },
  };
  function aiAction(st, level, r) {
    if (st.format === 'qb') return window.QBFormat.aiAction(st, level, r);
    const L = AI[level] || AI.medium;
    if (st.phase === 'choose') {
      const roll = r(); const diff = roll < L.bias[0] ? 1 : roll < L.bias[0] + L.bias[1] ? 2 : 3;
      if (st.format === 'board') {
        const free = [];
        st.board.forEach((c, ci) => c.cells.forEach((x, ri) => { if (x.by === null) free.push([ci, ri, x.diff]); }));
        const pref = free.filter((x) => x[2] === diff);
        const cell = pick(r, pref.length ? pref : free);
        return { type: 'choose', cell: [cell[0], cell[1]] };
      }
      return { type: 'choose', diff };
    }
    if (st.phase === 'question') {
      const ok = r() < L.acc[(st.current.q.diff || 1) - 1];
      if (ok) return { type: 'answer', idx: st.current.q.answer };
      const wrong = [0, 1, 2, 3].filter((i) => i !== st.current.q.answer);
      return { type: 'answer', idx: pick(r, wrong) };
    }
    return null;
  }

  // ---------- Session ----------
  // mode: 'cpu' | 'local' | 'host' | 'guest'
  class Session {
    constructor({ quiz, mode, settings, names, cpuLevel, online, onChange }) {
      this.quiz = quiz; this.mode = mode; this.settings = settings || {}; this.cpuLevel = cpuLevel || 'medium';
      this.online = online; this.onChange = onChange;
      this.rng = mulberry32((Math.random() * 2 ** 32) >>> 0);
      this.state = null; this.aiTimer = null;
      if (mode !== 'guest') this.setState(newGame(quiz, this.settings, names, this.rng, mode === 'cpu'));
      this.offs = [];
      if (mode === 'host') this.offs.push(online.onAction((by, a) => this.act(a, by, true)));
      if (mode === 'guest') this.offs.push(online.onState((s) => this.setState(s, true)));
      this.tick = setInterval(() => this.loop(), 250);
    }
    now() { return this.online ? this.online.now() : Date.now(); }
    // Ποιον παίκτη ελέγχει αυτή η συσκευή (null = όποιον έχει σειρά)
    me() { return this.mode === 'cpu' || this.mode === 'host' ? 0 : this.mode === 'guest' ? 1 : null; }
    canAct() { const s = this.state; return s && s.phase !== 'over' && (this.me() === null || this.me() === s.turn); }
    act(a, by, remote) {
      if (by === undefined || by === null) by = this.me() === null ? this.state.turn : this.me();
      if (this.mode === 'guest' && !remote) { this.online.sendAction(by, a); return; }
      const next = apply(this.state, a, by, this.now(), this.rng);
      if (next) this.setState(next);
    }
    setState(s, fromRemote) {
      this.state = s;
      if (this.mode === 'host' && !fromRemote) this.online.pushState(s);
      this.onChange && this.onChange(s);
      this.scheduleAI();
    }
    loop() {
      const s = this.state; if (!s || this.mode === 'guest') { this.onTick && this.onTick(); return; }
      const now = this.now();
      if (s.phase === 'question' && now >= s.current.deadline) this.act({ type: 'timeout' }, s.turn);
      else if (s.phase === 'reveal' && now >= s.revealUntil) this.act({ type: 'next' }, s.turn);
      this.onTick && this.onTick();
    }
    scheduleAI() {
      const s = this.state;
      if (this.mode !== 'cpu' || !s || s.turn !== 1 || !['draft', 'choose', 'question'].includes(s.phase)) return;
      const key = s.phase + s.history.length + ':' + (s.seq || 0);
      if (this.aiKey === key) return;
      this.aiKey = key;
      const L = AI[this.cpuLevel] || AI.medium;
      let wait = s.phase === 'choose' || s.phase === 'draft' ? 1200 : L.delay[0] + this.rng() * (L.delay[1] - L.delay[0]);
      if (s.format === 'qb' && s.phase === 'question' && s.current.step) wait = 1500;
      clearTimeout(this.aiTimer);
      this.aiTimer = setTimeout(() => {
        const a = aiAction(this.state, this.cpuLevel, this.rng);
        if (a && this.state.turn === 1) this.act(a, 1);
      }, s.timer ? Math.min(wait, (s.timer - 2) * 1000) : wait);
    }
    destroy(keepRoom) { clearInterval(this.tick); clearTimeout(this.aiTimer); this.offs.forEach((f) => f()); if (this.online && !keepRoom) this.online.leave(); }
  }

  window.QUIZZES = QUIZZES;
  window.QuizEngine = { newGame, apply, aiAction, Session };
})();
