# Χτίζει το js/data/quizball.js από: finals.json, people.json (parse_people), people_wd.json, top5_scraped.json
import json, re, os, time, urllib.request, urllib.parse, urllib.error, random
QB = '/tmp/qb/'
UA = {'User-Agent': 'quiz-site-builder/1.0 (ggshackers@gmail.com)'}
def get(url):
    for i in range(10):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r: return json.load(r)
        except urllib.error.HTTPError as e:
            ra = e.headers.get('Retry-After'); time.sleep(int(ra) + 2 if ra and ra.isdigit() else 10 + 10 * i); err = e
        except Exception as e: err = e; time.sleep(5 + 5 * i)
    raise err
def wp(params): return get('https://en.wikipedia.org/w/api.php?' + urllib.parse.urlencode(dict(params, format='json', formatversion=2)))
def wd(params): return get('https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode(dict(params, format='json', formatversion=2)))

CACHE = QB + 'resolve_cache.json'
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {'t2q': {}, 'ent': {}}
def titles_to_qids(titles):
    todo = [t for t in set(titles) if t and t not in cache['t2q']]
    for i in range(0, len(todo), 50):
        b = todo[i:i + 50]
        d = wp({'action': 'query', 'prop': 'pageprops', 'ppprop': 'wikibase_item', 'redirects': 1, 'titles': '|'.join(b)})['query']
        norm = {n['from']: n['to'] for n in d.get('normalized', [])}; red = {r['from']: r['to'] for r in d.get('redirects', [])}
        byt = {p['title']: p for p in d['pages']}
        for t in b:
            t1 = norm.get(t, t); t2 = red.get(t1, t1); p = byt.get(t2)
            cache['t2q'][t] = (p or {}).get('pageprops', {}).get('wikibase_item')
        time.sleep(1.5)
    json.dump(cache, open(CACHE, 'w'))
    return {t: cache['t2q'].get(t) for t in titles}
def entities(qids):
    todo = [q for q in set(qids) if q and q not in cache['ent']]
    for i in range(0, len(todo), 50):
        d = wd({'action': 'wbgetentities', 'ids': '|'.join(todo[i:i + 50]), 'props': 'labels|aliases|claims|sitelinks', 'languages': 'el|en', 'sitefilter': 'enwiki|elwiki|dewiki|frwiki|itwiki|eswiki|ptwiki|nlwiki|ruwiki|trwiki|arwiki|jawiki'})
        for k, e in d.get('entities', {}).items():
            cl = e.get('claims', {})
            def first(pid):
                for st in cl.get(pid, []):
                    dv = st['mainsnak'].get('datavalue')
                    if dv and isinstance(dv['value'], dict) and 'id' in dv['value']: return dv['value']['id']
                return None
            cache['ent'][k] = {'el': e.get('labels', {}).get('el', {}).get('value'), 'en': e.get('labels', {}).get('en', {}).get('value'),
                               'alias': [a['value'] for l in ('el', 'en') for a in e.get('aliases', {}).get(l, [])][:8],
                               'links': len(e.get('sitelinks', {})), 'P17': first('P17'), 'P159': first('P159'), 'P131': first('P131')}
        if (i // 50) % 10 == 0: json.dump(cache, open(CACHE, 'w')); print('ent', i, '/', len(todo), flush=True)
        time.sleep(1)
    json.dump(cache, open(CACHE, 'w'))
    return {q: cache['ent'].get(q) for q in qids}

strip = lambda s: re.sub(r'\s*\(.*?\)\s*$', '', s or '').strip()
CLUB_TOK = re.compile(r'^(?:ΣΦ|ΜΚ|ΟΚ|ΣΣΚ|ΡΚΝ|ΦφΜ|ΣΚΝ|Φουτεμπόλ|Κλούμπε|Σπορ|Κουλουμπού|ΑΣ|ΓΣ|ΑΕ|ΦφΛ|ΒφΛ|ΒφΒ|ΤΣΦ|ΚΡ|ΣΚ|ΚΑ|ΣΕ|Π\.?Α\.?Ε\.?|ΠΑΕ|Φ\.?Κ\.?|ΦΚ|ΑΚ|ΑΣ|ΑΦΚ|ΚΦ|ΣΦΠ|Σ\.Φ\.Π\.|ΓΣ|ΑΠΣ|ΑΟ|ΣΣ|ΣΚ|ΟΦ|ΑΦ|ΑΦΣ|FC|F\.C\.|CF|AC|AFC|SC|SSC|AS|SL|S\.L\.|RC|RCD|CD|SV|VfB|VfL|BV|FK|SK|PFC|KV|OGC|OSC|AJ|US|SS|SD|UD|CA|CR|SE)$')
CLUB_FIX = {'Κλούμπε ντε Ρεγκάτας ντο Φλαμένγκο': 'Φλαμένγκο', 'ντε Ρεγκάτας ντο Φλαμένγκο': 'Φλαμένγκο', 'Κορίνθιανς Παουλίστα': 'Κορίνθιανς', 'ΦΚ Ιντερνατσιονάλε Μιλάνο': 'Ίντερ', 'Ιντερνατσιονάλε Μιλάνο': 'Ίντερ', 'Ολεμπίκ ντε Μαρσέιγ': 'Μαρσέιγ', 'Ολυμπιακός Σ.Φ.Π.': 'Ολυμπιακός', 'Ολεμπίκ Λιόν': 'Λιόν', 'Μπορούσια Μενχενγκλάντμπαχ': 'Μπορούσια Μένχενγκλαντμπαχ'}
def clean_club(n):
    n = re.sub(r'\s*\(.*?\)', '', n or '').strip()
    n = re.sub(r'\b((?:[Α-ΩA-Z]\.){2,})', lambda m: m.group(1).replace('.', ''), n)  # Π.Α.Ο.Κ. -> ΠΑΟΚ
    words = [w for w in n.split() if not CLUB_TOK.match(w)]
    n2 = ' '.join(words) or n
    return CLUB_FIX.get(n, CLUB_FIX.get(n2, n2))
FORMAL = {'Βασίλειο των Κάτω Χωρών': 'Ολλανδία', 'Κάτω Χώρες': 'Ολλανδία', 'Ηνωμένες Πολιτείες Αμερικής': 'ΗΠΑ', 'Ρωσική Ομοσπονδία': 'Ρωσία',
          'Λαϊκή Δημοκρατία της Κίνας': 'Κίνα', 'Δημοκρατία της Ιρλανδίας': 'Ιρλανδία', 'Δημοκρατία της Κορέας': 'Νότια Κορέα',
          'Ομόσπονδη Δημοκρατία της Γερμανίας': 'Γερμανία', 'Τσεχική Δημοκρατία': 'Τσεχία', 'Δημοκρατία της Βόρειας Μακεδονίας': 'Βόρεια Μακεδονία'}
def label(e, fallback=''):
    if not e: return strip(fallback)
    v = strip(e['el']) or strip(e['en']) or strip(fallback)
    return FORMAL.get(v, v)

finals = json.load(open(QB + 'finals.json'))
people = json.load(open(QB + 'people.json'))
top5raw = json.load(open(QB + 'top5_scraped.json')) if os.path.exists(QB + 'top5_scraped.json') else []
title2pid = {}
for qid, p in people.items(): title2pid[p['t']] = qid; title2pid[p['req']] = qid

# ---------- εθνικές ομάδες / σημαίες ----------
wc = json.load(open('/tmp/geo/node_modules/world-countries/countries.json'))
import subprocess
el_names = json.loads(subprocess.check_output(['node', '-e', "const n=require('/tmp/geo/node_modules/i18n-iso-countries');n.registerLocale(require('/tmp/geo/node_modules/i18n-iso-countries/langs/el.json'));console.log(JSON.stringify(n.getNames('el')))"]))
geo_short = {}
exec_js = subprocess.check_output(['node', '-e', "global.window={};require('/home/claude/quiz-site/js/data/geo-countries.js');console.log(JSON.stringify(Object.fromEntries(window.GEO_COUNTRIES.map(c=>[c.code,c.name]))))"])
geo_short = json.loads(exec_js)
TRI = {}
for c in wc:
    for code in {c.get('cioc'), c.get('cca3')}:
        if code: TRI.setdefault(code, c['cca2'])
SPECIAL = {'ENG': ('gb-eng', 'Αγγλία'), 'SCO': ('gb-sct', 'Σκωτία'), 'WAL': ('gb-wls', 'Ουαλία'), 'NIR': ('gb-nir', 'Βόρεια Ιρλανδία'),
           'FRG': ('de', 'Δυτική Γερμανία'), 'GER': ('de', 'Γερμανία'), 'NED': ('nl', 'Ολλανδία'), 'IRL': ('ie', 'Ιρλανδία')}
NOFLAG = {'URS': 'ΕΣΣΔ', 'YUG': 'Γιουγκοσλαβία', 'TCH': 'Τσεχοσλοβακία', 'GDR': 'Ανατολική Γερμανία', 'SCG': 'Σερβία-Μαυροβούνιο', 'CIS': 'ΚΑΚ'}
def nation(tri):
    tri = (tri or '').upper()
    if tri in SPECIAL: return SPECIAL[tri]
    if tri in NOFLAG: return (None, NOFLAG[tri])
    iso = TRI.get(tri)
    if not iso: return (None, None)
    return (iso.lower(), geo_short.get(iso) or el_names.get(iso))

# ---------- ομάδες (σύλλογοι) ----------
club_titles = set()
for p in people.values():
    for c in p['clubs'] + p['mclubs']: club_titles.add(c['t'])
for f in finals:
    for t in (f['team1'], f['team2']):
        if t and not t.startswith('NAT:'): club_titles.add(t)
city_titles = {f['city'] for f in finals if f.get('city')}
t5titles = {it['t'] for l in top5raw for it in l['items']}
print('resolving', len(club_titles), 'clubs', len(city_titles), 'cities', len(t5titles), 'top5 people', flush=True)
t2q = titles_to_qids(list(club_titles | city_titles | t5titles))
ents = entities([q for q in t2q.values() if q])
# δεύτερο επίπεδο: χώρες και πόλεις των συλλόγων
lvl2 = set()
for t in club_titles:
    e = ents.get(t2q.get(t))
    if e: lvl2.update([x for x in (e['P17'], e['P159']) if x])
ents2 = entities(list(lvl2))

teams = {}
club_key = {}
for t in club_titles:
    q = t2q.get(t); e = ents.get(q)
    key = q or ('T:' + t)
    club_key[t] = key
    if key in teams: continue
    raw = label(e, t)
    names = [clean_club(raw), raw, strip(t)] + ([strip(e['en'])] if e and e['en'] else []) + (e['alias'] if e else [])
    city = label(ents2.get(e['P159'])) if e and e['P159'] and ents2.get(e['P159']) else None

    cn = label(ents2.get(e['P17'])) if e and e['P17'] and ents2.get(e['P17']) else None
    teams[key] = {'n': names[0], 'a': sorted(set(x for x in names[1:] if x and x != names[0] and len(x) > 2)), 'city': city, 'cn': cn, 'links': e['links'] if e else 0}
# πόλεις έδρας: κράτα μόνο πόλεις που είναι έδρα ≥2 ομάδων ή πρωτεύουσες/πόλεις τελικών (όχι προάστια/γήπεδα)
capitals = set(json.loads(subprocess.check_output(['node', '-e', "global.window={};require('/home/claude/quiz-site/js/data/geo-countries.js');console.log(JSON.stringify(window.GEO_COUNTRIES.map(c=>c.capital).filter(Boolean)))"])))
fcities = {label(ents.get(t2q.get(c)), c) for c in city_titles}
from collections import Counter
cc = Counter(v['city'] for v in teams.values() if v.get('city'))
for v in teams.values():
    if v.get('city') and not (cc[v['city']] >= 2 or v['city'] in capitals or v['city'] in fcities): v['city'] = None
# εθνικές ομάδες ως «ομάδες»
for f in finals:
    for t in (f['team1'], f['team2']):
        if t and t.startswith('NAT:'):
            iso, nm = nation(t[4:]); teams.setdefault(t.replace('NAT:', 'N:'), {'n': nm or t[4:], 'a': [], 'flag': iso})
# φήμη συλλόγου = πόσοι γνωστοί παίκτες του υπάρχουν στα δεδομένα
famecount = {}
for p in people.values():
    for k in {club_key[c['t']] for c in p['clubs']}: famecount[k] = famecount.get(k, 0) + 1
for k, v in teams.items():
    if not k.startswith('N:'): v['f'] = famecount.get(k, 0)

# ---------- πρόσωπα ----------
aux = set()
for p in people.values():
    if p.get('birthplace'): aux.add(p['birthplace'])
    aux.update(p.get('pos', [])[:1]); aux.update(p.get('sport_nat', [])[:1] or p.get('cit', [])[:1])
auxe = entities(list(aux))
bpc = entities([e['P17'] for e in auxe.values() if e and e['P17']])

def pname(p):
    el, en = p['el'], strip(p['en']) or strip(p['t'])
    if el and en and len(en.split()) == 1 and len(el.split()) >= 3: return en  # π.χ. Deco
    if el and len(el.split()) >= 4 and en: return en
    return el or en
REJECT_CLUB = re.compile(r'\b(B|Β|Β΄|II|III|U-?\d\d|Sub-?\d\d|Reserves?|Youth|Juvenil|Academy|Primavera|Jong|Castilla|Atlètic|Καστίγια)\b', re.I)
P = {}
for qid, p in people.items():
    clubs = [[club_key[c['t']], c['y'][0], c['y'][1], 1 if c['loan'] else 0] for c in p['clubs'] if not REJECT_CLUB.search(c['t'] + ' ' + c['d'])]
    mclubs = [[club_key[c['t']], c['y'][0], c['y'][1]] for c in p['mclubs']]
    names = [pname(p)] + [x for x in [strip(p['en']), strip(p['t'])] + p['alias'] if x]
    nat = (p.get('sport_nat') or [])[:1] or (p.get('cit') or [])[:1]
    bp = auxe.get(p.get('birthplace')) if p.get('birthplace') else None
    pos = auxe.get(p['pos'][0]) if p.get('pos') else None
    born = p['born'][1:5] if p.get('born') else None
    natn = label(auxe.get(nat[0])) if nat and auxe.get(nat[0]) else None
    P[qid] = {'n': names[0], 'a': sorted(set(x for x in names[1:] if x != names[0] and len(x) > 2))[:8], 'f': p['links'] + (40 if natn == 'Ελλάδα' else 0),
              'born': born, 'bp': label(bp) if bp else None, 'pos': (pos['el'] if pos and pos['el'] else None),
              'natName': label(auxe.get(nat[0])) if nat and auxe.get(nat[0]) else None,
              'cl': clubs, 'mc': mclubs, 'p54': p.get('p54', []), 'bpc': label(bpc.get(bp['P17'])) if bp and bp.get('P17') and bpc.get(bp['P17']) else None}
    if not clubs: P[qid]['cl'] = None
    if not mclubs: P[qid]['mc'] = None

# ---------- αγώνες ----------
def pid_of(title, disp):
    q = title2pid.get(title)
    return q if q else '?' + strip(disp or title)
matches = []
for i, f in enumerate(finals):
    if not f.get('score'): continue
    t = []
    for x in (f['team1'], f['team2']):
        t.append(x.replace('NAT:', 'N:') if x.startswith('NAT:') else club_key.get(x))
    if not all(t): continue
    m = {'id': i, 'comp': f['comp'], 'year': f['year'], 't': t, 'sc': f['score'], 'aet': f['aet'], 'pens': f['pens'],
         'city': label(ents.get(t2q.get(f['city'])), f['city']) if f.get('city') else None}
    if f.get('goalsOk'): m['g'] = [[[pid_of(g['p'], g['p']), g['n'], 1 if g['og'] else 0] for g in f[k]] for k in ('goals1', 'goals2')]
    if f.get('lineups'):
        lu = []
        for side in f['lineups']:
            xi = []
            for pl in side['xi']:
                iso, _ = nation(pl['nat']) if pl['nat'] else (None, None)
                q = title2pid.get(pl['p'])
                xi.append([pl['pos'], iso, q, P[q]['n'] if q in P else strip(pl['p'])])
            mg = side['mgr'] and title2pid.get(side['mgr']['p'])
            lu.append({'xi': xi, 'mgr': mg if mg in P else None})
        # έλεγχος ότι κάθε 11άδα αντιστοιχεί στη σωστή ομάδα (με βάση καριέρες/εθνικότητες παικτών)
        def fit(side, team):
            n = 0
            for x in side['xi']:
                q = x[2]
                if not q or q not in P: continue
                if team.startswith('N:'): n += 1 if P[q].get('natName') == teams[team]['n'] else 0
                else: n += 1 if any(c[0] == team for c in (P[q].get('cl') or [])) else 0
            return n
        if fit(lu[1], t[0]) + fit(lu[0], t[1]) > fit(lu[0], t[0]) + fit(lu[1], t[1]): lu = [lu[1], lu[0]]
        m['lu'] = lu
    matches.append(m)
# πρόσωπα που εμφανίζονται μόνο ως «?όνομα» στα γκολ: πρόσθεσέ τα ως απλά ονόματα
for m in matches:
    for side in m.get('g', []):
        for g in side:
            if g[0].startswith('?'):
                k = g[0]; P.setdefault(k, {'n': k[1:], 'a': [], 'f': 0, 'cl': None, 'mc': None})

# ---------- μεταγραφές ----------
qid_of_club = {k: k for k in teams if k.startswith('Q')}
transfers = []
seen = {}
MON = {1: 'Ιανουάριος', 2: 'Φεβρουάριος'}
for qid, p in P.items():
    cl = p.get('cl') or []
    for a, b in zip(cl, cl[1:]):
        if a[0] == b[0] or b[3] or a[3]: continue
        ta, tb = teams.get(a[0], {}), teams.get(b[0], {})
        if any(REJECT_CLUB.search(x.get('n', '') + ' ' + ' '.join(x.get('a', []))) for x in (ta, tb)): continue
        w = str(b[1])
        for st in p.get('p54') or []:
            if st['club'] == b[0] and st['start'] and st['start'][1] >= 10:
                y, mth = int(st['start'][0][1:5]), int(st['start'][0][6:8])
                if abs(y - b[1]) <= 1:
                    w = f'Καλοκαίρι {y}' if 6 <= mth <= 9 else f'{MON[mth]} {y}' if mth in MON else str(b[1])
                break
        key = (a[0], b[0], w)
        seen.setdefault(key, []).append(qid)
for (fa, tb, w), ps in seen.items():
    if len(ps) == 1 and P[ps[0]]['f'] >= 35 and teams[fa].get('f', 0) >= 8 and teams[tb].get('f', 0) >= 8:
        transfers.append({'p': ps[0], 'from': fa, 'to': tb, 'w': w})
random.seed(3); transfers = random.sample(transfers, min(3000, len(transfers)))
for p in P.values(): p.pop('p54', None)

# ---------- Club Combo ----------
clubsets = {qid: {c[0] for c in (p.get('cl') or [])} for qid, p in P.items()}
major = [k for k, v in teams.items() if v.get('f', 0) >= 20 and not REJECT_CLUB.search(v['n'])]
combos = []
for i, a in enumerate(major):
    for b in major[i + 1:]:
        ps = [q for q, s in clubsets.items() if a in s and b in s]
        if not ps: continue
        n = len(ps); d = 1 if n >= 8 else 2 if n >= 3 else 3
        combos.append({'a': a, 'b': b, 'p': sorted(ps, key=lambda q: -P[q]['f']), 'd': d})
random.seed(7)
by_d = {1: [], 2: [], 3: []}
for c in combos: by_d[c['d']].append(c)
combos = [c for d in by_d for c in random.sample(by_d[d], min(200, len(by_d[d])))]

# ---------- Top 5 ----------
F_UCL = json.loads(subprocess.check_output(['node', '-e', "global.window={};require('/home/claude/quiz-site/js/data/football.js');console.log(JSON.stringify({ucl:window.FOOTBALL.championsLeague,bd:window.FOOTBALL.ballonDor}))"]))
def tnames(k): return {'n': teams[k]['n'], 'a': teams[k]['a']}
top5 = []
def add_top(label, items, d, ak, note=''):
    top5.append({'label': label, 'items': items, 'd': d, 'ak': ak, 'note': note})
# Champions League τίτλοι (λίστα 1956–2025 + τελικός 2026 από τα δεδομένα)
cnt = {}
for v in F_UCL['ucl'].values(): cnt[v] = cnt.get(v, 0) + 1
f26 = next((m for m in matches if m['comp'] == 'UCL' and m['year'] == 2026), None)
if f26:
    w = 0 if f26['sc'][0] > f26['sc'][1] else 1 if f26['sc'][1] > f26['sc'][0] else (0 if f26['pens'][0] > f26['pens'][1] else 1)
    wn = teams[f26['t'][w]]['n']; cnt[wn] = cnt.get(wn, 0) + 1; print('2026 UCL winner', wn)
order = sorted(cnt.items(), key=lambda x: -x[1])
if order[4][1] != order[5][1]:
    add_top('Οι 5 ομάδες με τους περισσότερους τίτλους Champions League / Κυπέλλου Πρωταθλητριών', [{'n': n, 'a': [], 'v': f'{v} τίτλοι'} for n, v in order[:5]], 1, 'club')
# Χρυσή Μπάλα (πριν το 1990: Κρόιφ 3, Πλατινί 3, Φαν Μπάστεν 2 πριν το 1990 + 1 το 1992)
bd = {}
for v in F_UCL['bd'].values(): bd[v] = bd.get(v, 0) + 1
bd['Γιόχαν Κρόιφ'] = 3; bd['Μισέλ Πλατινί'] = 3; bd['Μάρκο Φαν Μπάστεν'] = bd.get('Μάρκο Φαν Μπάστεν', 0) + 2
o = sorted(bd.items(), key=lambda x: -x[1])
if o[4][1] != o[5][1]:
    add_top('Οι 5 παίκτες με τις περισσότερες Χρυσές Μπάλες', [{'n': n, 'a': [], 'v': f'{v}'} for n, v in o[:5]], 1, 'person')
add_top('Οι 5 ελληνικές ομάδες με τα περισσότερα πρωταθλήματα Ελλάδας', [{'n': x, 'a': []} for x in ['Ολυμπιακός', 'Παναθηναϊκός', 'ΑΕΚ', 'ΠΑΟΚ', 'Άρης']], 1, 'club')
DIFF5 = {'Champions League': 1, 'Μουντιάλ': 2, 'Euro': 2, 'Premier League': 2, 'La Liga': 3, 'Serie A': 3, 'Εθνικής': 3, 'Εθνική': 3, 'συμμετοχές στο Champions': 2}
t2q5 = titles_to_qids([it['t'] for l in top5raw for it in l['items']])
ent5 = entities([q for q in t2q5.values() if q])
for l in top5raw:
    items = []
    for it in l['items']:
        q = t2q5.get(it['t']); e = ent5.get(q) if q else None
        nm = (P[q]['n'] if q in P else label(e, it['d']))
        al = (P[q]['a'] if q in P else []) + [it['d'], strip(it['t'])] + ([strip(e['en'])] if e and e['en'] else [])
        items.append({'n': nm, 'a': sorted(set(x for x in al if x and x != nm)), 'v': str(it['v'])})
    d = next((v for k, v in DIFF5.items() if k in l['label']), 2)
    add_top(l['label'], items, d, 'person')

# ---------- λίστες αυτόματης συμπλήρωσης ----------
countries = sorted(set(list(geo_short.values()) + [v['cn'] for v in teams.values() if v.get('cn')] + [v['n'] for k, v in teams.items() if k.startswith('N:')]))
cities = sorted(set([m['city'] for m in matches if m.get('city')] + [v['city'] for v in teams.values() if v.get('city')]))

# κράτα μόνο ό,τι χρειάζεται
for v in teams.values(): v.pop('links', None)
fame = [75, 55]  # εύκολη: ≥75 «σημεία φήμης» (γλώσσες Wikipedia), μέτρια: 55–74, δύσκολη: <55 (+40 για Έλληνες)
# αφαίρεσε πολύ άγνωστους παίκτες (εκτός αν χρειάζονται σε αγώνες)
needed = {x[2] for m in matches for l in m.get('lu', []) for x in l['xi']} | {l['mgr'] for m in matches for l in m.get('lu', [])} | {g[0] for m in matches for side in m.get('g', []) for g in side}
needed |= {t['p'] for t in transfers} | {q for c in combos for q in c['p']}
P = {k: v for k, v in P.items() if v.get('f', 0) >= 30 or k in needed}
out = {'people': P, 'teams': teams, 'matches': matches, 'transfers': transfers, 'combos': combos, 'top5': top5, 'countries': countries, 'cities': cities, 'fame': fame}
js = '// Παράγεται αυτόματα από tools/build_qb.py (Wikipedia + Wikidata). Μην το επεξεργάζεσαι με το χέρι.\nwindow.QBD = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
open('/home/claude/quiz-site/js/data/quizball.js', 'w').write(js)
print('people', len(P), 'teams', len(teams), 'matches', len(matches), 'transfers', len(transfers), 'combos', len(combos), 'top5', len(top5), 'fame', fame, 'size', len(js))
