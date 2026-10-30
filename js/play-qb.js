// Οθόνες Quizball: draft κατηγοριών, ταμπλό, ερωτήσεις με γραπτή/φωνητική απάντηση.
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CATS = () => window.QBFormat.CATS;
  const DIFF = ['', 'εύκολη', 'μέτρια', 'δύσκολη'];
  const ptsWord = (n) => `${n} ${n === 1 ? 'πόντος' : 'πόντοι'}`;
  let scorerDraft = [];
  let lastQKey = null;

  // ---------- λίστες αυτόματης συμπλήρωσης ----------
  function ensureLists() {
    if (document.getElementById('dl-person')) return;
    const D = window.QBD;
    const uniq = (a) => [...new Set(a.filter(Boolean))].sort((x, y) => x.localeCompare(y, 'el'));
    const lists = {
      person: uniq(Object.values(D.people).map((p) => p.n)),
      club: uniq(Object.entries(D.teams).map(([k, t]) => t.n)),
      country: uniq(D.countries),
      city: uniq(D.cities),
    };
    const box = document.createElement('div'); box.hidden = true;
    box.innerHTML = Object.entries(lists).map(([k, arr]) => `<datalist id="dl-${k}">${arr.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>`).join('');
    document.body.appendChild(box);
  }

  // ---------- φωνή ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function voiceBtn(target) { return SR ? `<button type="button" class="mic" data-mic="${target}" aria-label="Απάντηση με φωνή">🎤</button>` : ''; }
  function listen(input, btn) {
    const rec = new SR(); rec.lang = 'el-GR'; rec.interimResults = false; rec.maxAlternatives = 1;
    btn.classList.add('on'); btn.textContent = '…';
    rec.onresult = (e) => { input.value = e.results[0][0].transcript; input.focus(); };
    rec.onend = () => { btn.classList.remove('on'); btn.textContent = '🎤'; };
    rec.onerror = () => { btn.classList.remove('on'); btn.textContent = '🎤'; };
    rec.start();
  }

  // ---------- draft ----------
  function draftHtml(s, mine) {
    const cats = CATS();
    const n = s.drafted.length;
    return `<p class="turn">Επιλογή κατηγοριών (${n}/8). Σειρά: <strong>${esc(s.players[s.turn].name)}</strong>${mine ? '' : ' · περιμένουμε…'}</p>
      <div class="draft">${Object.entries(cats).map(([k, c]) => {
        const d = s.drafted.find((x) => x.cat === k);
        return `<button class="dcard ${d ? 'taken p' + d.by : ''}" data-draft="${k}" ${!d && mine ? '' : 'disabled'}>
          <span class="ic">${c.icon}</span><strong>${esc(c.label)}</strong><small>${esc(c.desc)}</small>
          ${d ? `<em>${esc(s.players[d.by].name)}</em>` : ''}</button>`;
      }).join('')}</div>`;
  }

  // ---------- ταμπλό ----------
  function cellLabel(cell) {
    const k = cell.q && cell.q.kind;
    if (k === 'top5' || k === 'footballer') return `<b>έως 3</b><small>${DIFF[cell.diff]}</small>`;
    if (k === 'score') return `<b>έως 2</b><small>${DIFF[cell.diff]}</small>`;
    return `<b>${cell.diff}</b><small>${DIFF[cell.diff]}</small>`;
  }
  function boardHtml(s, mine) {
    const left = s.board.reduce((n, c) => n + c.cells.filter((x) => x.by === null).length, 0);
    return `<p class="turn">Σειρά έχει: <strong>${esc(s.players[s.turn].name)}</strong>${mine ? ' — διάλεξε ερώτηση' : ' · περιμένουμε…'} <span class="muted">(${left} ερωτήσεις ακόμα)</span></p>
      <div class="qbboard">${s.board.map((c, ci) => `<div class="qbcol">
        <div class="head"><span class="ic">${c.icon}</span>${esc(c.label)}</div>
        ${c.cells.map((x, ri) => x.by === null
          ? `<button class="qcell d${x.diff}" data-cell="${ci},${ri}" ${mine ? '' : 'disabled'}>${cellLabel(x)}</button>`
          : `<button class="qcell done ${x.by >= 0 ? 'p' + x.by : ''}" disabled>${x.by < 0 ? '—' : `<b>+${x.got}</b><small>${esc(s.players[x.by].name.slice(0, 10))}</small>`}</button>`).join('')}
      </div>`).join('')}</div>`;
  }

  // ---------- μέσα ερώτησης ----------
  function mediaHtml(m) {
    if (!m) return '';
    if (m.type === 'career') return `<table class="ctable"><tbody>${m.rows.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table>`;
    if (m.type === 'pair') return `<div class="pair"><span>${esc(m.a)}</span><i>+</i><span>${esc(m.b)}</span></div>`;
    if (m.type === 'transfer') return `<div class="transfer"><span>${esc(m.from)}</span><i>→</i><span>${esc(m.to)}</span><small>${esc(m.when)}</small></div>`;
    if (m.type === 'lineup' || m.type === 'flags') {
      return `<div class="pitch">${m.rows.slice().reverse().map((row) => `<div class="prow">${row.map((p) => {
        if (m.type === 'flags') return `<span class="pl"><img alt="" src="https://cdn.jsdelivr.net/npm/flag-icons@7/flags/4x3/${esc(p[1])}.svg"><small>${esc(p[0])}</small></span>`;
        return `<span class="pl ${p[2] ? '' : 'gap'}"><b>${p[2] ? esc(p[2]) : '?'}</b><small>${esc(p[0])}</small></span>`;
      }).join('')}</div>`).join('')}</div>`;
    }
    return '';
  }
  function inputRow(q, mine, label) {
    if (!mine) return '<p class="note">Απαντά ο αντίπαλος…</p>';
    const ak = q.ak || (q.ans && q.ans.ak) || 'person';
    return `<form class="ansrow" id="ansForm"><input id="ansInput" list="dl-${ak}" autocomplete="off" placeholder="Γράψε την απάντηση" aria-label="Απάντηση">
      ${voiceBtn('ansInput')}<button class="btn" type="submit">${label || 'Απάντηση'}</button></form>`;
  }

  function questionHtml(s, ctx) {
    const c = s.current, q = c.q, rev = s.phase === 'reveal';
    const mine = ctx.mine;
    const cat = CATS()[q.cat];
    let body = `<p class="qtext">${esc(q.prompt)}</p>${mediaHtml(q.media)}`;
    if (q.kind === 'footballer') {
      body += `<ol class="clues">${q.clues.slice(0, rev ? 3 : c.clues).map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
      if (!rev) {
        const now = 4 - c.clues;
        body += inputRow({ ak: 'person' }, mine, `Απάντηση για ${ptsWord(now)}`);
        if (mine && c.clues < 3) body += `<button class="btn ghost small" data-act="clue">Πάρε κι άλλο στοιχείο (πέφτεις στους ${now - 1})</button>`;
      }
    }
    if (q.kind === 'top5') {
      if (q.note) body += `<p class="note">${esc(q.note)}</p>`;
      const approved = c.entries.filter((e) => e.approved);
      let ai = 0;
      body += `<ol class="top5">${q.items.map((it, i) => {
        const f = c.found.includes(i);
        if (f || rev) return `<li class="${f ? 'hit' : 'miss'}">${esc(it.label)}${it.v ? ` <small>${esc(it.v)}</small>` : ''}</li>`;
        return '<li class="empty">?</li>';
      }).join('')}</ol>`;
      if (approved.length) body += `<p class="note">Δεκτές από αντίπαλο: ${approved.map((e) => esc(e.t)).join(', ')}</p>`; void ai;
      const wrong = c.entries.filter((e) => !e.ok).map((e) => esc(e.t));
      body += `<p class="cushion">Μαξιλαράκι: ${c.misses === 0 ? '✓ ακέραιο' : '✗ χάθηκε'}${wrong.length ? ` · Λάθος: ${wrong.join(', ')}` : ''}</p>`;
      if (!rev) {
        body += inputRow(q, mine, 'Πρόσθεσε');
        if (mine && c.found.length === 4) body += `<button class="btn ghost small" data-act="stop">Σταματάω εδώ (${ptsWord(c.misses === 0 ? 2 : 1)})</button>`;
        if (ctx.canApprove && c.lastWrong) body += `<button class="btn ghost small" data-act="approve">Δεκτή η απάντηση «${esc(c.lastWrong)}»</button>`;
      }
    }
    if (q.kind === 'score') {
      body += `<div class="match"><span>${esc(q.teams[0])}</span><span>–</span><span>${esc(q.teams[1])}</span></div><p class="note">${esc(q.note)}</p>`;
      if (!rev && mine) {
        body += `<form id="scoreForm" class="scoreform">
          <div class="scorebox"><input id="sa" type="number" min="0" max="20" inputmode="numeric" aria-label="Γκολ ${esc(q.teams[0])}" required><span>–</span><input id="sb" type="number" min="0" max="20" inputmode="numeric" aria-label="Γκολ ${esc(q.teams[1])}" required></div>
          <div class="ansrow"><input id="scInput" list="dl-person" autocomplete="off" placeholder="Σκόρερ (Enter για προσθήκη)">${voiceBtn('scInput')}<button type="button" class="btn ghost" id="scAdd">Πρόσθεσε</button></div>
          <div class="chips" id="chips">${scorerDraft.map((x, i) => `<span class="chip">${esc(x)}<button type="button" data-rm="${i}" aria-label="Αφαίρεση">×</button></span>`).join('')}</div>
          <button class="btn" type="submit">Υποβολή</button></form>`;
      } else if (!rev) body += '<p class="note">Απαντά ο αντίπαλος…</p>';
    }
    if (q.kind === 'text' && !rev) body += inputRow(q, mine);

    let verdict = '';
    if (rev) {
      const name = esc(s.players[s.turn].name);
      const given = c.entries.length ? `Απάντηση: ${c.entries.map((e) => esc(e.t)).join(', ')}` : '';
      if (q.kind === 'score') {
        verdict = `<div class="verdict ${c.got ? 'ok' : 'no'}">Σκορ ${c.scoreOk ? '✓' : '✗'} · Σκόρερ ${c.scorersOk ? '✓' : '✗'} → +${c.got} για ${name}</div><div class="explain">Σωστό: ${esc(q.reveal)}</div>`;
      } else if (q.kind === 'top5') {
        verdict = `<div class="verdict ${c.got ? 'ok' : 'no'}">${c.got ? `+${c.got} για ${name}` : 'Χάθηκε η ερώτηση.'}</div>`;
      } else {
        verdict = `<div class="verdict ${c.got ? 'ok' : 'no'}">${c.got ? `Σωστό! +${c.got} για ${name}` : 'Λάθος.'}</div><div class="explain">${given ? given + ' · ' : ''}Σωστή απάντηση: ${esc(q.reveal)}</div>`;
      }
      if (ctx.canApprove && c.got < c.max && !c.approved && q.kind !== 'top5') verdict += `<button class="btn ghost small" data-act="approve">Δεκτή η απάντηση (απόφαση αντιπάλου)</button>`;
      verdict += `<div class="row" style="margin-top:14px"><button class="btn" data-act="next">Συνέχεια</button></div>`;
    }
    const ptsInfo = q.kind === 'text' ? ptsWord(c.diff) : `έως ${c.max} πόντοι`;
    return `<div class="qcard"><div class="qmeta"><span>${cat.icon} ${esc(cat.label)} · ${DIFF[c.diff]}</span><span>${ptsInfo} · ${esc(s.players[s.turn].name)}</span></div>${body}${verdict}</div>`;
  }

  function render(s, ctx) {
    ensureLists();
    if (s.current && s.current.q.key !== lastQKey) { scorerDraft = []; lastQKey = s.current.q.key; }
    if (s.phase === 'draft') return draftHtml(s, ctx.mine);
    if (s.phase === 'choose') return boardHtml(s, ctx.mine);
    return questionHtml(s, ctx);
  }

  function bind(root, s, act) {
    root.querySelectorAll('[data-draft]').forEach((b) => b.onclick = () => act({ type: 'draft', cat: b.dataset.draft }));
    root.querySelectorAll('[data-cell]').forEach((b) => b.onclick = () => act({ type: 'choose', cell: b.dataset.cell.split(',').map(Number) }));
    root.querySelectorAll('[data-act]').forEach((b) => b.onclick = () => act({ type: b.dataset.act }));
    root.querySelectorAll('[data-mic]').forEach((b) => b.onclick = () => listen(document.getElementById(b.dataset.mic), b));
    const f = root.querySelector('#ansForm');
    if (f) {
      const inp = f.querySelector('input'); setTimeout(() => inp.focus(), 30);
      f.onsubmit = (e) => { e.preventDefault(); const t = inp.value.trim(); if (t) act({ type: 'answer', text: t }); };
    }
    const sf = root.querySelector('#scoreForm');
    if (sf) {
      const sc = sf.querySelector('#scInput');
      const add = () => { const t = sc.value.trim(); if (t) { scorerDraft.push(t); sc.value = ''; redrawChips(sf); } sc.focus(); };
      sf.querySelector('#scAdd').onclick = add;
      sc.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
      sf.onsubmit = (e) => {
        e.preventDefault();
        if (sc.value.trim()) add();
        act({ type: 'score', a: +sf.querySelector('#sa').value, b: +sf.querySelector('#sb').value, scorers: scorerDraft.slice() });
      };
      redrawChips(sf);
    }
  }
  function redrawChips(sf) {
    const box = sf.querySelector('#chips');
    box.innerHTML = scorerDraft.map((x, i) => `<span class="chip">${esc(x)}<button type="button" data-rm="${i}" aria-label="Αφαίρεση">×</button></span>`).join('');
    box.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { scorerDraft.splice(+b.dataset.rm, 1); redrawChips(sf); });
  }

  window.QBView = { render, bind };
})();
