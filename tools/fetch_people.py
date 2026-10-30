import json, urllib.request, urllib.parse, time
UA = {'User-Agent': 'quiz-site-builder/1.0 (ggshackers@gmail.com)'}
import urllib.error, os
def get(url):
    for i in range(8):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r: return json.load(r)
        except urllib.error.HTTPError as e:
            err = e; ra = e.headers.get('Retry-After'); time.sleep(int(ra) + 2 if ra and ra.isdigit() else 10 + 10 * i)
        except Exception as e: err = e; time.sleep(5 + 5 * i)
    raise err
def wp(params):
    return get('https://en.wikipedia.org/w/api.php?' + urllib.parse.urlencode(dict(params, format='json', formatversion=2)))
def wd(params):
    return get('https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode(dict(params, format='json', formatversion=2)))

finals = json.load(open('/tmp/qb/finals.json'))
titles = set()
for f in finals:
    for t in f.get('lineups', []):
        for p in t['xi'] + t['subs']: titles.add(p['p'])
        if t['mgr']: titles.add(t['mgr']['p'])
    for g in f['goals1'] + f['goals2']: titles.add(g['p'])
for q in ['top', 'greek', 'mgr']:
    for b in json.load(open(f'/tmp/qb/{q}.json'))['results']['bindings']: titles.add(b['title']['value'])
titles = sorted(titles)
print('titles', len(titles))

pages = json.load(open('/tmp/qb/people_pages.json')) if os.path.exists('/tmp/qb/people_pages.json') else {}
tl = [t for t in titles if t not in pages]
for i in range(0, len(tl), 50):
    batch = tl[i:i + 50]
    d = wp({'action': 'query', 'prop': 'revisions|pageprops', 'ppprop': 'wikibase_item', 'rvprop': 'content', 'rvslots': 'main', 'redirects': 1, 'titles': '|'.join(batch)})
    q = d['query']
    norm = {n['from']: n['to'] for n in q.get('normalized', [])}
    redir = {r['from']: r['to'] for r in q.get('redirects', [])}
    byt = {p['title']: p for p in q['pages']}
    for t in batch:
        t1 = norm.get(t, t); t2 = redir.get(t1, t1)
        p = byt.get(t2)
        if not p or 'revisions' not in p: continue
        txt = p['revisions'][0]['slots']['main']['content']
        cut = txt.find('\n==')
        pages[t] = {'title': t2, 'qid': p.get('pageprops', {}).get('wikibase_item'), 'text': txt[:cut] if cut > 0 else txt[:20000]}
    if (i // 50) % 10 == 0: json.dump(pages, open('/tmp/qb/people_pages.json', 'w')); print('progress', i, flush=True)
    time.sleep(2)
print('pages', len(pages))
json.dump(pages, open('/tmp/qb/people_pages.json', 'w'))

qids = sorted({p['qid'] for p in pages.values() if p['qid']})
ents = {}
for i in range(0, len(qids), 50):
    d = wd({'action': 'wbgetentities', 'ids': '|'.join(qids[i:i + 50]), 'props': 'labels|aliases|claims|sitelinks', 'languages': 'el|en'})
    for k, e in d['entities'].items():
        c = e.get('claims', {})
        def vals(pid):
            out = []
            for st in c.get(pid, []):
                dv = st['mainsnak'].get('datavalue')
                if not dv: continue
                v = dv['value']
                out.append(v.get('id') if isinstance(v, dict) and 'id' in v else v.get('time') if isinstance(v, dict) and 'time' in v else v)
            return out
        p54 = []
        for st in c.get('P54', []):
            dv = st['mainsnak'].get('datavalue')
            if not dv: continue
            qual = st.get('qualifiers', {})
            def qt(pid):
                for s in qual.get(pid, []):
                    if s.get('datavalue'): return [s['datavalue']['value']['time'], s['datavalue']['value']['precision']]
                return None
            p54.append({'club': dv['value']['id'], 'start': qt('P580'), 'end': qt('P582'), 'loan': any(s.get('datavalue', {}).get('value', {}).get('id') == 'Q2914547' for s in qual.get('P1642', []))})
        ents[k] = {
            'el': e.get('labels', {}).get('el', {}).get('value'), 'en': e.get('labels', {}).get('en', {}).get('value'),
            'alias': [a['value'] for l in ('el', 'en') for a in e.get('aliases', {}).get(l, [])],
            'links': len(e.get('sitelinks', {})),
            'born': (vals('P569') or [None])[0], 'birthplace': (vals('P19') or [None])[0],
            'pos': vals('P413'), 'sport_nat': vals('P1532'), 'cit': vals('P27'), 'p54': p54,
        }
    time.sleep(1)
print('entities', len(ents))
json.dump(ents, open('/tmp/qb/people_wd.json', 'w'), ensure_ascii=False)
