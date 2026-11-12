// Οθόνες: ρυθμίσεις -> (lobby online) -> παιχνίδι -> τελικό.
(function () {
  const params = new URLSearchParams(location.search);
  const quizId = window.QUIZZES[params.get('quiz')] ? params.get('quiz') : 'football';
  const Q = window.QUIZZES[quizId];
  const TOPIC = window.QUIZ_TOPICS[Q.topic] || {};
  const app = document.getElementById('app');
  const roomTag = document.getElementById('roomTag');
  document.body.dataset.quiz = quizId;
  document.title = Q.title + ' | Quiz Night';
  const navOn = document.querySelector(`[data-nav="${quizId}"]`); if (navOn) navOn.classList.add('on');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = { get(k, d) { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  let session = null;
  let mode = params.get('room') ? 'join' : 'cpu';

  // ---------- Ρυθμίσεις ----------
  function setupScreen(err) {
    const online = window.Online.enabled;
    const catOpts = quizId === 'geo' ? Object.entries(TOPIC).map(([k, v]) => `<label class="cat"><input type="checkbox" name="cat" value="${k}" checked> ${v.icon} ${esc(v.label)}</label>`).join('') : '';
    let extra = '';
    if (Q.format === 'qb' && window.QBFormat) extra = `<ul class="catlist">${Object.values(window.QBFormat.CATS).map((c) => `<li><span class="ic">${c.icon}</span><span><strong>${esc(c.label)}</strong><small>${esc(c.desc)}</small></span></li>`).join('')}</ul>`;
    if (Q.choices && quizId === 'basketball') extra = `<ul class="catlist">${Q.choices.map((c) => `<li><span class="ic num">${c.pts}</span><span><strong>${esc(c.label)}</strong><small>Ερώτηση ${esc(c.hint)}ς δυσκολίας</small></span></li>`).join('')}</ul>`;
    app.innerHTML = `
      <section class="page-head">
        <h1>${esc(Q.title)}</h1>
        <p class="lede">${esc(Q.subtitle)}</p>
      </section>
      <section class="setup">
        <aside class="card rules-card">
          <h3>Πώς παίζεται</h3>
          <p>${esc(Q.rules)}</p>
          ${extra}
        </aside>
        <form class="card" id="setupForm">
          <h3>Νέο παιχνίδι</h3>
          <div class="modes" role="group" aria-label="Τρόπος παιχνιδιού">
            ${modeBtn('cpu', 'Με τον υπολογιστή', 'Ένας παίκτης')}
            ${modeBtn('local', '2 παίκτες', 'Στην ίδια συσκευή')}
            ${modeBtn('host', 'Online: νέο δωμάτιο', 'Παίρνεις κωδικό', !online)}
            ${modeBtn('join', 'Online: μπες με κωδικό', 'Σου τον δίνει ο φίλος σου', !online)}
          </div>
          ${online ? '' : '<p class="note">Το online δεν έχει ρυθμιστεί ακόμα (λείπουν τα στοιχεία Firebase).</p>'}
          <div class="fields">
            <label class="field"><span id="n1label">Το όνομά σου</span><input name="n1" maxlength="20" required value="${esc(store.get('qn-name', ''))}"></label>
            <label class="field" data-show="local"><span>Όνομα 2ου παίκτη</span><input name="n2" maxlength="20" value="Παίκτης 2"></label>
            <label class="field" data-show="cpu"><span>Δυσκολία υπολογιστή</span>
              <select name="level"><option value="easy">Εύκολος</option><option value="medium" selected>Μέτριος</option><option value="hard">Δύσκολος</option></select></label>
            <label class="field" data-show="join"><span>Κωδικός δωματίου</span><input name="code" maxlength="5" autocapitalize="characters" value="${esc(params.get('room') || '')}"></label>
          </div>
          ${quizId === 'geo' ? `<div data-hide="join"><span class="field-label">Κατηγορίες</span><div class="cats">${catOpts}</div>
            <label class="field"><span>Γύροι</span><select name="rounds"><option>5</option><option selected>10</option><option>15</option></select></label></div>` : ''}
          ${err ? `<p class="error">${esc(err)}</p>` : ''}
          <button class="btn btn-lg" type="submit" id="startBtn">Ξεκίνα</button>
        </form>
      </section>`;
    const form = document.getElementById('setupForm');
    const sync = () => {
      form.querySelectorAll('.mode').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
      form.querySelectorAll('[data-show]').forEach((el) => { el.hidden = el.dataset.show !== mode; });
      form.querySelectorAll('[data-hide]').forEach((el) => { el.hidden = el.dataset.hide === mode; });
      document.getElementById('n1label').textContent = mode === 'local' ? 'Όνομα 1ου παίκτη' : 'Το όνομά σου';
      document.getElementById('startBtn').textContent = mode === 'host' ? 'Δημιούργησε δωμάτιο' : mode === 'join' ? 'Μπες στο δωμάτιο' : 'Ξεκίνα';
    };
    form.querySelectorAll('.mode').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; sync(); }));
    if (!online && (mode === 'host' || mode === 'join')) mode = 'cpu';
    sync();
    form.addEventListener('submit', (e) => { e.preventDefault(); start(new FormData(form)); });
  }
  function modeBtn(m, title, sub, disabled) {
    return `<button type="button" class="mode" data-mode="${m}" ${disabled ? 'disabled' : ''}><strong>${title}</strong><small>${sub}</small></button>`;
  }

  async function start(fd) {
    const n1 = (fd.get('n1') || '').trim() || 'Παίκτης 1';
    store.set('qn-name', n1);
    const settings = {};
    if (quizId === 'geo') {
      settings.cats = fd.getAll('cat');
      if (!settings.cats.length) return setupScreen('Διάλεξε τουλάχιστον μία κατηγορία.');
      settings.rounds = +fd.get('rounds') || 10;
    }
    if (mode === 'cpu') return play({ mode: 'cpu', settings, names: [n1, 'Υπολογιστής'], cpuLevel: fd.get('level') });
    if (mode === 'local') return play({ mode: 'local', settings, names: [n1, (fd.get('n2') || '').trim() || 'Παίκτης 2'] });
    try {
      if (mode === 'host') {
        const room = await window.Online.createRoom(quizId, settings, n1);
        lobby(room, settings, n1);
      } else {
        const code = (fd.get('code') || '').trim();
        if (code.length !== 5) return setupScreen('Ο κωδικός έχει 5 χαρακτήρες.');
        const room = await window.Online.joinRoom(code, n1);
        if (room.info.quiz !== quizId) { location.href = `play.html?quiz=${room.info.quiz}&room=${room.code}`; return; }
        roomTag.textContent = 'Δωμάτιο ' + room.code;
        watchRoom(room);
        play({ mode: 'guest', online: room, names: [room.info.host, n1] });
        if (!session.state) app.innerHTML = '<div class="waiting">Ο αντίπαλος ξεκινά το παιχνίδι…</div>';
      }
    } catch (e) { setupScreen(e.message || 'Κάτι πήγε στραβά με τη σύνδεση. Δοκίμασε ξανά.'); }
  }

  function lobby(room, settings, n1) {
    roomTag.textContent = 'Δωμάτιο ' + room.code;
    const link = `${location.origin}${location.pathname}?quiz=${quizId}&room=${room.code}`;
    app.innerHTML = `<section class="card lobby">
      <h3>Δώσε τον κωδικό στον αντίπαλό σου</h3>
      <div class="room-code">${room.code}</div>
      <p class="note">ή στείλε του τον σύνδεσμο:</p>
      <div class="copyrow"><input readonly value="${esc(link)}" id="lnk" aria-label="Σύνδεσμος δωματίου"><button class="btn ghost" id="copy">Αντιγραφή</button></div>
      <p class="waiting">Περιμένουμε αντίπαλο…</p></section>`;
    document.getElementById('copy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(link); document.getElementById('copy').textContent = 'Αντιγράφηκε'; };
    let started = false;
    room.onRoom((r) => {
      if (!r) return;
      if (r.status === 'ready' && !started) { started = true; play({ mode: 'host', online: room, settings, names: [n1, r.guest] }); }
      if (r.guestLeft && started) showLeft('Ο αντίπαλος αποσυνδέθηκε.');
    });
  }
  function watchRoom(room) { room.onRoom((r) => { if (!r) showLeft('Ο οικοδεσπότης έκλεισε το δωμάτιο.'); }); }
  function showLeft(msg) {
    if (session) { session.destroy(); session = null; }
    app.innerHTML = `<div class="final"><h2>Τέλος σύνδεσης</h2><p>${esc(msg)}</p><a class="btn" href="play.html?quiz=${quizId}">Νέο παιχνίδι</a></div>`;
  }

  // ---------- Παιχνίδι ----------
  function play(opts) {
    if (session) session.destroy(true);
    session = new window.QuizEngine.Session(Object.assign({ quiz: quizId, onChange: (s) => session && render(s) }, opts));
    session.onTick = tick;
    if (quizId === 'geo') window.QuizMap.preload().catch(() => {});
    lastKey = ''; if (session.state) render(session.state);
  }

  let lastKey = '';
  function render(s) {
    const key = s.format === 'qb' ? s.phase + ':' + s.seq : JSON.stringify([s.phase, s.turn, s.players, s.current && s.current.chosen, s.current && s.current.q && s.current.q.key]);
    if (key === lastKey) return; lastKey = key;
    if (s.phase === 'over') return renderOver(s);
    if (s.format === 'qb') return renderQB(s);
    const mine = session.canAct();
    const who = esc(s.players[s.turn].name);
    let body = '';
    if (s.phase === 'choose') {
      body = `<div class="turnbar"><p class="turn">Σειρά: <strong>${who}</strong>${mine ? ' — διάλεξε δυσκολία' : ' — περιμένουμε…'}</p></div>`;
      body += s.format === 'board' ? boardHtml(s, mine) : shotsHtml(mine);
    } else {
      body = questionHtml(s, mine);
    }
    app.innerHTML = scoreboardHtml(s) + `<section class="stage">${body}</section>`;
    bind(s);
    tick();
  }
  function renderQB(s) {
    const me = session.me();
    const cpuGame = s.players.some((p) => p.cpu);
    const ctx = { mine: session.canAct(), canApprove: !cpuGame && (me === null || me !== s.turn) };
    app.innerHTML = scoreboardHtml(s) + `<section class="stage">${window.QBView.render(s, ctx)}</section>`;
    window.QBView.bind(app, s, (a) => {
      if (a.type === 'approve' && session.mode === 'local') session.act(a, 1 - s.turn);
      else session.act(a);
    });
  }
  function scoreboardHtml(s) {
    let sub = '';
    if (s.format === 'qb') sub = s.phase === 'draft' ? 'Επιλογή κατηγοριών' : s.phase === 'over' ? 'Τέλος' : 'Quizball';
    else if (s.format === 'board') { const left = s.board.reduce((n, c) => n + c.cells.filter((x) => x.by === null).length, 0); sub = `${left} ερωτήσεις ακόμα`; }
    else if (quizId === 'basketball') sub = s.period > s.periods ? `Παράταση ${s.ot}` : `${s.period}η περίοδος`;
    else sub = `Γύρος ${Math.min(Math.floor(s.count / 2) + 1, s.perPeriod)} από ${s.perPeriod}`;
    const plate = (i) => `<div class="plate ${i ? 'right' : ''} ${s.turn === i && s.phase !== 'over' ? 'active' : ''}"><span class="name">${esc(s.players[i].name)}</span><span class="score">${s.players[i].score}</span></div>`;
    return `<div class="scoreboard">${plate(0)}<div class="clock"><span class="digits" id="clk">${s.timer ? s.timer : 'VS'}</span><span class="sub">${sub}</span></div>${plate(1)}</div>`;
  }
  function boardHtml(s, mine) {
    return `<div class="board">${s.board.map((c, ci) => `<div class="col"><div class="head"><span class="ic">${c.icon}</span>${esc(c.label)}</div>
      ${c.cells.map((x, ri) => x.by === null
        ? `<button class="cell" data-cell="${ci},${ri}" ${mine ? '' : 'disabled'} aria-label="${esc(c.label)}, ${x.pts} πόντοι">${x.pts}</button>`
        : `<button class="cell done ${x.by >= 0 ? 'p' + x.by : ''}" disabled>${x.by < 0 ? '—' : (x.ok ? '✓ ' : '✗ ') + esc(s.players[x.by].name.slice(0, 8))}</button>`).join('')}
    </div>`).join('')}</div>`;
  }
  function shotsHtml(mine) {
    return `<div class="shots">${Q.choices.map((c) => `<button class="shot" data-diff="${c.diff}" ${mine ? '' : 'disabled'}><b>${c.pts}</b><span>${c.label}</span><small>${c.hint}</small></button>`).join('')}</div>`;
  }
  function questionHtml(s, mine) {
    const c = s.current, q = c.q, rev = s.phase === 'reveal';
    const cat = TOPIC[q.cat] || { label: '', icon: '' };
    let media = '';
    if (q.media && q.media.type === 'flag') media = `<div class="media"><img class="flag" alt="Σημαία" src="https://cdn.jsdelivr.net/npm/flag-icons@7/flags/4x3/${q.media.code.toLowerCase()}.svg"></div>`;
    if (q.media && q.media.type === 'map') media = '<div class="media" id="mapBox"></div>';
    if (q.media && q.media.type === 'career') media = `<div class="media career">${q.media.clubs.map((x) => `<span class="club">${esc(x)}</span>`).join('<span class="arr">→</span>')}</div>`;
    const opts = q.options.map((o, i) => {
      let cls = '';
      if (rev && i === q.answer) cls = 'right';
      else if (rev && i === c.chosen) cls = 'wrong';
      return `<button class="opt ${cls}" data-idx="${i}" ${!rev && mine ? '' : 'disabled'}>${esc(o)}</button>`;
    }).join('');
    let verdict = '';
    if (rev) {
      const name = esc(s.players[s.turn].name);
      verdict = c.ok ? `<div class="verdict ok">Σωστό! +${c.pts} για ${name}</div>`
        : `<div class="verdict no">${c.chosen < 0 ? 'Τέλος χρόνου.' : 'Λάθος.'} Σωστή απάντηση: ${esc(q.options[q.answer])}</div>`;
      if (q.explain) verdict += `<div class="explain">${esc(q.explain)}</div>`;
    }
    return `<div class="qcard"><div class="timebar"><i id="tbar"></i></div>
      <div class="qmeta"><span class="tag">${cat.icon} ${esc(cat.label)}</span><span class="qmeta-r"><b>${c.pts} ${c.pts === 1 ? 'πόντος' : 'πόντοι'}</b> για ${esc(s.players[s.turn].name)}</span></div>
      <p class="qtext">${esc(q.text)}</p>${media}<div class="options">${opts}</div>${verdict}
      ${!mine && !rev ? '<p class="note">Απαντά ο αντίπαλος…</p>' : ''}</div>`;
  }
  function bind(s) {
    app.querySelectorAll('[data-cell]').forEach((b) => b.onclick = () => session.act({ type: 'choose', cell: b.dataset.cell.split(',').map(Number) }));
    app.querySelectorAll('[data-diff]').forEach((b) => b.onclick = () => session.act({ type: 'choose', diff: +b.dataset.diff }));
    app.querySelectorAll('.opt').forEach((b) => b.onclick = () => session.act({ type: 'answer', idx: +b.dataset.idx }));
    const mb = document.getElementById('mapBox');
    if (mb && s.current) window.QuizMap.draw(mb, s.current.q.media);
  }
  function tick() {
    const s = session && session.state; if (!s || s.phase !== 'question' || !s.current.deadline) return;
    const left = Math.max(0, (s.current.deadline - session.now()) / 1000);
    const clk = document.getElementById('clk'); const bar = document.getElementById('tbar');
    if (clk) { clk.textContent = Math.ceil(left); clk.classList.toggle('low', left <= 5); }
    if (bar) bar.style.width = (100 * left / s.timer) + '%';
  }
  function renderOver(s) {
    const w = s.winner;
    const me = session.me();
    let title = w < 0 ? 'Ισοπαλία' : `Νικητής: ${esc(s.players[w].name)}`;
    if (me !== null && w >= 0) title = w === me ? 'Κέρδισες!' : `Κέρδισε ${esc(s.players[w].name)}`;
    const acc = [0, 1].map((p) => { const h = s.history.filter((x) => x.p === p); return h.length ? `${esc(s.players[p].name)}: ${h.filter((x) => x.ok).length}/${h.length} σωστές` : ''; }).filter(Boolean).join(' · ');
    const again = session.mode === 'guest' ? '' : '<button class="btn" id="again">Ρεβάνς</button>';
    app.innerHTML = scoreboardHtml(s) + `<section class="final"><h2>${title}</h2>
      <div class="big">${s.players[0].score} – ${s.players[1].score}</div><p class="muted">${acc}</p>
      <div class="row center">${again}<a class="btn ghost" href="play.html?quiz=${quizId}">Νέο παιχνίδι</a></div></section>`;
    const b = document.getElementById('again');
    if (b) b.onclick = () => {
      const opts = { mode: session.mode, settings: session.settings, names: s.players.map((p) => p.name), cpuLevel: session.cpuLevel, online: session.online };
      session.destroy(true); session = null; lastKey = '';
      play(opts);
    };
  }

  setupScreen();
})();
