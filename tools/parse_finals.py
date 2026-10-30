import json, re
raw = json.load(open('/tmp/qb/finals_raw.json'))

def link_target(s):
    m = re.search(r'\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]', s)
    return (m.group(1).strip(), (m.group(2) or m.group(1)).strip()) if m else (None, None)

def field(box, name):
    m = re.search(r'^\s*\|\s*' + name + r'\s*=(.*?)(?=^\s*\|\s*\w+\s*=|^\}\})', box, re.S | re.M)
    return m.group(1).strip() if m else ''

def parse_goals(txt):
    goals = []
    for line in [x for x in re.split(r'\n\*|^\*|<br\s*/?>', txt) if x.strip()]:
        t, disp = link_target(line)
        if not t: continue
        og = bool(re.search(r'o\.g\.|\bog\b|own goal', line, re.I))
        n = 0
        for g in re.findall(r'\{\{(?:golden |silver )?goal\|([^}]*)\}\}', line, re.I):
            parts = [p.strip() for p in g.split('|')]
            n += sum(1 for p in parts if re.fullmatch(r"\d+(\+\d+)?'?", p))
            if any('o.g' in p.lower() or p.lower() == 'og' for p in parts): og = True
        if n == 0: n = max(1, len(re.findall(r"\d+'", line)))
        goals.append({'p': t, 'n': n, 'og': og})
    return goals

def parse_score(s):
    s = re.sub(r'<ref.*?(</ref>|/>)', '', s, flags=re.S)
    m = re.search(r'(\d+)\s*[–-]\s*(\d+)', s)
    return [int(m.group(1)), int(m.group(2))] if m else None

ROW = re.compile(r"^\|\s*([A-Z]{2,3})\s*\|\|\s*'*\d*'*\s*\|\|\s*(?:\{\{(?:flagicon|#invoke:flag\|icon)\|([A-Za-z]{3})[^}]*\}\})?\s*\[\[([^\]|]+)(?:\|[^\]]*)?\]\]", re.M)

def parse_lineups(text):
    teams = []
    # split on tables that contain position rows; collect blocks starting with a GK row
    lines = text.split('\n')
    cur = None; mode = None; table_break = False
    for ln in lines:
        if ln.startswith('{|') and cur is not None and len(cur['xi']) >= 11: table_break = True
        if re.match(r"^\|\s*GK\s*\|\|", ln):
            new = cur is None or mode == 'mgr' or table_break
            table_break = False
            if new:
                cur = {'xi': [], 'subs': [], 'mgr': None}; teams.append(cur); mode = 'xi'
        if cur is None: continue
        if re.search(r"Substitut", ln): mode = 'subs'; continue
        if re.search(r"Manager|Coach|Head coach", ln) and 'colspan' in ln: mode = 'mgr'; continue
        m = ROW.match(ln)
        if m and mode in ('xi', 'subs'):
            (cur['xi'] if mode == 'xi' else cur['subs']).append({'pos': m.group(1), 'nat': (m.group(2) or '').upper(), 'p': m.group(3).strip()})
        elif mode == 'mgr' and cur['mgr'] is None and '[[' in ln:
            fm = re.search(r'flagicon\|([A-Za-z]{3})', ln)
            t, _ = link_target(ln)
            if t: cur['mgr'] = {'p': t, 'nat': fm.group(1).upper() if fm else ''}
    return [t for t in teams if len(t['xi']) == 11][:2]

out = []
for title, text in raw.items():
    m = re.search(r'\{\{\s*(?:#invoke:)?football box(?:\|main)?(.*?)\n\}\}', text, re.S | re.I)
    if not m: print('nobox', title); continue
    box = m.group(1) + '\n}}'
    def team(f):
        v = field(box, f); t, _ = link_target(v)
        if t: return t
        c = re.findall(r'\b([A-Z]{3})\b', v)
        return 'NAT:' + c[-1] if c else None
    t1, t2 = team('team1'), team('team2')
    sc = parse_score(field(box, 'score'))
    rec = {
        'title': title, 'year': int(re.search(r'\d{4}', title).group()),
        'comp': 'WC' if 'World Cup' in title else 'EURO' if 'Euro ' in title else 'UCL' if ('Champions' in title or 'European Cup' in title) else 'UEL' if ('Europa League' in title or 'UEFA Cup' in title) else 'UECL',
        'team1': t1, 'team2': t2, 'score': sc, 'aet': bool(re.search(r'yes', field(box, 'aet'))),
        'pens': parse_score(field(box, 'penaltyscore')) if field(box, 'penaltyscore') else None,
        'goals1': parse_goals(field(box, 'goals1')), 'goals2': parse_goals(field(box, 'goals2')),
        'stadium': link_target(field(box, 'stadium'))[0],
        'city': None,
        'replay': 'replay' in text.lower()[:3000] and 'Replay' in text,
    }
    st = field(box, 'stadium')
    links = re.findall(r'\[\[([^\]|]+)(?:\|[^\]]*)?\]\]', st)
    if len(links) >= 2: rec['city'] = links[-1]
    lu = parse_lineups(text)
    if len(lu) == 2: rec['lineups'] = lu
    # sanity: goals vs score
    if sc:
        g1 = sum(g['n'] for g in rec['goals1']); g2 = sum(g['n'] for g in rec['goals2'])
        rec['goalsOk'] = (g1 == sc[0] and g2 == sc[1])
    out.append(rec)
json.dump(out, open('/tmp/qb/finals.json', 'w'), ensure_ascii=False, indent=0)
ok = [r for r in out if r.get('lineups')]
print('finals', len(out), 'with lineups', len(ok), 'with flags', sum(1 for r in ok if all(p['nat'] for t in r['lineups'] for p in t['xi'])), 'goalsOk', sum(1 for r in out if r.get('goalsOk')))
print('bad goals:', [r['title'] for r in out if not r.get('goalsOk')])
print('no lineups:', [r['title'] for r in out if not r.get('lineups')])
