import json, re
pages = json.load(open('/tmp/qb/people_pages.json'))
ents = json.load(open('/tmp/qb/people_wd.json'))

def infobox(text):
    m = re.search(r'\{\{\s*Infobox (?:football biography|football manager|association football biography)', text, re.I)
    if not m: return None
    i = m.start(); depth = 0; j = i
    while j < len(text):
        if text.startswith('{{', j): depth += 1; j += 2; continue
        if text.startswith('}}', j):
            depth -= 1; j += 2
            if depth == 0: break
            continue
        j += 1
    return text[i:j]

def fields(box):
    # σπάει το infobox σε | στο ανώτερο επίπεδο (όχι μέσα σε [[ ]] ή {{ }})
    body = box[2:-2]
    parts, depth, cur, i = [], 0, '', 0
    while i < len(body):
        two = body[i:i + 2]
        if two in ('[[', '{{'): depth += 1; cur += two; i += 2; continue
        if two in (']]', '}}'): depth -= 1; cur += two; i += 2; continue
        ch = body[i]
        if ch == '|' and depth == 0: parts.append(cur); cur = ''
        else: cur += ch
        i += 1
    parts.append(cur)
    out = {}
    for prt in parts[1:]:
        if '=' in prt:
            k, v = prt.split('=', 1)
            out[k.strip().lower()] = v.strip()
    return out

def clean_years(s):
    s = re.sub(r'<.*?>|\{\{.*?\}\}', '', s).strip()
    m = re.match(r'(\d{4})\s*(?:[–\-—]\s*(\d{4})?)?', s)
    if not m: return None
    y0 = int(m.group(1)); y1 = int(m.group(2)) if m.group(2) else (None if re.search(r'[–\-—]', s) else y0)
    return [y0, y1]

def club_of(s):
    loan = bool(re.search(r'→|\(loan\)|loan', s, re.I))
    s2 = re.sub(r'<ref.*?(</ref>|/>)', '', s)
    m = re.search(r'\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]', s2)
    if not m: return None
    return {'t': m.group(1).strip(), 'd': (m.group(2) or m.group(1)).strip(), 'loan': loan}

def career(f, yk, ck):
    out = []
    for n in range(1, 40):
        y = f.get(f'{yk}{n}'); c = f.get(f'{ck}{n}')
        if not c: continue
        if re.search(r'assistant|youth|under-\d|U-?\d\d', c, re.I) and ck.startswith('manager'): continue
        cl = club_of(c); yr = clean_years(y or '')
        if not cl or not yr: continue
        cl['care'] = bool(re.search(r'caretaker|interim', c, re.I))
        cl['y'] = yr
        out.append(cl)
    return out

people = {}
for req, p in pages.items():
    box = infobox(p['text'])
    if not box or not p['qid'] or p['qid'] not in ents: continue
    f = fields(box)
    e = ents[p['qid']]
    clubs = career(f, 'years', 'clubs')
    mclubs = career(f, 'manager_years', 'manager_clubs') or career(f, 'manageryears', 'managerclubs')
    people[p['qid']] = dict(e, t=p['title'], req=req, clubs=clubs, mclubs=mclubs, nt=club_of(f.get('nationalteam1', '')) if f.get('nationalteam1') else None)
json.dump(people, open('/tmp/qb/people.json', 'w'), ensure_ascii=False)
print('people', len(people), 'with clubs', sum(1 for x in people.values() if len(x['clubs']) >= 2), 'managers', sum(1 for x in people.values() if len(x['mclubs']) >= 3))
for k in list(people)[:3]:
    x = people[k]; print(x['t'], x['el'], x['links'], [(c['d'], c['y'], c['loan']) for c in x['clubs']][:6], [(c['d'], c['y']) for c in x['mclubs']][:4])
