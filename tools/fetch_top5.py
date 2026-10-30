import json, urllib.request, urllib.parse, re, time
from bs4 import BeautifulSoup
UA = {'User-Agent': 'quiz-site-builder/1.0 (ggshackers@gmail.com)'}
import urllib.error
def parse_html(title):
    url = 'https://en.wikipedia.org/w/api.php?' + urllib.parse.urlencode({'action': 'parse', 'page': title, 'prop': 'text', 'format': 'json', 'formatversion': 2, 'redirects': 1})
    for i in range(10):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r: return json.load(r)['parse']['text']
        except urllib.error.HTTPError as e:
            ra = e.headers.get('Retry-After'); time.sleep(int(ra) + 3 if ra and ra.isdigit() else 15 + 10 * i); err = e
    raise err

# (σελίδα, κλειδί λέξεων στη κεφαλίδα του πίνακα, στήλη τιμής, τίτλος ερώτησης)
JOBS = [
    ('List of UEFA Champions League top scorers', 'Goals', 'Οι 5 πρώτοι σκόρερ όλων των εποχών στο Champions League'),
    ('FIFA World Cup top goalscorers', 'Goals', 'Οι 5 πρώτοι σκόρερ όλων των εποχών στα Μουντιάλ'),
    ('List of Premier League players with 100 or more goals', 'Goals', 'Οι 5 πρώτοι σκόρερ όλων των εποχών στην Premier League'),
        ('List of Serie A players with 100 or more goals', 'Goals', 'Οι 5 πρώτοι σκόρερ όλων των εποχών στη Serie A'),
    ('UEFA European Championship top goalscorers', 'Goals', 'Οι 5 πρώτοι σκόρερ όλων των εποχών στα Euro'),
    ('List of men\'s footballers with the most official appearances', 'Apps', None),
    ('List of Greece international footballers', 'Goals', 'Οι 5 πρώτοι σκόρερ όλων των εποχών της Εθνικής Ελλάδας'),
    ('List of Greece international footballers', 'Caps', 'Οι 5 παίκτες με τις περισσότερες συμμετοχές στην Εθνική Ελλάδας'),
    ('UEFA Champions League records and statistics', 'Apps', 'Οι 5 παίκτες με τις περισσότερες συμμετοχές στο Champions League'),
]
def num(s):
    m = re.search(r'\d[\d,]*', s or ''); return int(m.group().replace(',', '')) if m else None
out = []
cache = {}
for page, col, label in JOBS:
    if not label: continue
    try:
        html = cache.get(page) or parse_html(page); cache[page] = html
    except Exception as e:
        print('fail', page, e); time.sleep(5); continue
    if False:
        print('fail', page, e); continue
    soup = BeautifulSoup(html, 'html.parser')
    found = False
    for tab in soup.select('table.wikitable'):
        hdr = [th.get_text(' ', strip=True) for th in tab.select('tr')[0].find_all(['th', 'td'])]
        hl = [h.lower() for h in hdr]
        ci = next((i for i, h in enumerate(hl) if h.startswith(col.lower()) or h == col.lower()), None)
        pi = next((i for i, h in enumerate(hl) if 'player' in h or 'name' in h), None)
        if ci is None or pi is None: continue
        rows = []
        for tr in tab.select('tr')[1:]:
            cells = tr.find_all(['th', 'td'])
            if len(cells) != len(hdr): continue
            a = next((x for x in cells[pi].find_all('a', href=re.compile('^/wiki/')) if x.get_text(strip=True) and not x['href'].startswith('/wiki/File:')), None)
            v = num(cells[ci].get_text(' ', strip=True))
            if not a or v is None: continue
            t = urllib.parse.unquote(a['href'][6:]).replace('_', ' ')
            rows.append({'t': t, 'd': a.get_text(strip=True), 'v': v})
        if len(rows) < 6: continue
        rows.sort(key=lambda r: -r['v'])
        tie = rows[4]['v'] == rows[5]['v']
        print(label, '| tie' if tie else '', [(r['d'], r['v']) for r in rows[:6]])
        if not tie: out.append({'label': label, 'items': rows[:5], 'src': page})
        found = True
        break
    if not found: print('no table', page, col)
    time.sleep(4)
json.dump(out, open('/tmp/qb/top5_scraped.json', 'w'), ensure_ascii=False, indent=1)
