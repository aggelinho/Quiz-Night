import json, urllib.request, urllib.parse, time, os
UA = {'User-Agent': 'quiz-site-builder/1.0 (ggshackers@gmail.com)'}
def api(params):
    params = dict(params, format='json', formatversion=2)
    url = 'https://en.wikipedia.org/w/api.php?' + urllib.parse.urlencode(params)
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r: return json.load(r)
        except Exception as e: time.sleep(2 + i * 3); err = e
    raise err
titles = []
titles += [f'{y} European Cup final' for y in range(1956, 1993)]
titles += [f'{y} UEFA Champions League final' for y in range(1993, 2027)]
titles += [f'{y} FIFA World Cup final' for y in [1930,1934,1938,1950,1954,1958,1962,1966,1970,1974,1978,1982,1986,1990,1994,1998,2002,2006,2010,2014,2018,2022,2026]]
titles += [f'UEFA Euro {y} final' for y in [1960,1964,1968,1972,1976,1980,1984,1988,1992,1996,2000,2004,2008,2012,2016,2020,2024]]
titles += [f'{y} UEFA Europa League final' for y in range(2010, 2027)]
titles += [f'{y} UEFA Cup final' for y in range(1998, 2009)]
titles += [f'{y} UEFA Europa Conference League final' for y in range(2022, 2026)] + ['2026 UEFA Conference League final']
out = {}
for i in range(0, len(titles), 40):
    batch = titles[i:i+40]
    d = api({'action': 'query', 'prop': 'revisions', 'rvprop': 'content', 'rvslots': 'main', 'redirects': 1, 'titles': '|'.join(batch)})
    norm = {n['from']: n['to'] for n in d['query'].get('normalized', [])}
    redir = {r['from']: r['to'] for r in d['query'].get('redirects', [])}
    pages = {p['title']: p for p in d['query']['pages']}
    for t in batch:
        t2 = redir.get(norm.get(t, t), norm.get(t, t))
        p = pages.get(t2)
        if p and 'revisions' in p: out[t] = p['revisions'][0]['slots']['main']['content']
        else: print('missing', t)
    time.sleep(1)
json.dump(out, open('/tmp/qb/finals_raw.json', 'w'))
print('got', len(out), 'of', len(titles))
