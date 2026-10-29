// Online παιχνίδι μέσω Firebase Realtime Database.
// Δομή: rooms/{CODE} = { quiz, settings, host, guest, status, state, actions/{id}: {by, a} }
(function () {
  const cfg = window.FIREBASE_CONFIG || {};
  const enabled = !!(cfg.apiKey && cfg.databaseURL && window.firebase);
  let db = null, offset = 0;
  if (enabled) {
    firebase.initializeApp(cfg);
    db = firebase.database();
    db.ref('.info/serverTimeOffset').on('value', (s) => { offset = s.val() || 0; });
  }
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const makeCode = () => Array.from({ length: 5 }, () => ALPH[Math.floor(Math.random() * ALPH.length)]).join('');

  class Room {
    constructor(code, role) { this.code = code; this.role = role; this.ref = db.ref('rooms/' + code); this.offs = []; }
    now() { return Date.now() + offset; }
    listen(path, ev, fn) { const r = path ? this.ref.child(path) : this.ref; r.on(ev, fn); const off = () => r.off(ev, fn); this.offs.push(off); return off; }
    pushState(s) { this.ref.child('state').set(JSON.stringify(s)); }
    onState(fn) { return this.listen('state', 'value', (snap) => { const v = snap.val(); if (v) fn(JSON.parse(v)); }); }
    sendAction(by, a) { this.ref.child('actions').push({ by, a }); }
    onAction(fn) { return this.listen('actions', 'child_added', (snap) => { const v = snap.val(); fn(v.by, v.a); snap.ref.remove(); }); }
    onRoom(fn) { this.listen(null, 'value', (snap) => fn(snap.val())); }
    leave() { this.offs.forEach((f) => f()); this.offs = []; if (this.role === 'host') this.ref.remove(); else this.ref.child('guestLeft').set(true); }
  }

  async function createRoom(quiz, settings, hostName) {
    for (let i = 0; i < 5; i++) {
      const code = makeCode();
      const ref = db.ref('rooms/' + code);
      const res = await ref.transaction((cur) => (cur ? undefined : { quiz, settings: settings || {}, host: hostName, status: 'waiting', created: firebase.database.ServerValue.TIMESTAMP }));
      if (res.committed) { ref.onDisconnect().remove(); return new Room(code, 'host'); }
    }
    throw new Error('Δεν δημιουργήθηκε δωμάτιο. Δοκίμασε ξανά.');
  }
  async function joinRoom(code, guestName) {
    code = code.trim().toUpperCase();
    const ref = db.ref('rooms/' + code);
    const snap = await ref.get();
    const room = snap.val();
    if (!room) throw new Error('Δεν υπάρχει δωμάτιο με κωδικό ' + code + '.');
    if (room.status !== 'waiting') throw new Error('Το δωμάτιο ' + code + ' έχει ήδη αντίπαλο.');
    await ref.update({ guest: guestName, status: 'ready' });
    ref.child('guestLeft').onDisconnect().set(true);
    const r = new Room(code, 'guest'); r.info = room; return r;
  }

  window.Online = { enabled, createRoom, joinRoom };
})();
