// Builds js/data/geo-countries.js from world-countries + i18n-iso-countries + Wikidata dumps.
// Usage: node build_geo.js <node_modules_dir> <raw_dir> <out_file>
const path = require('path');
const fs = require('fs');
const [,, NM, RAW, OUT] = process.argv;
const req = (p) => require(path.join(NM, p));
const wc = req('world-countries');
const iso = req('i18n-iso-countries');
iso.registerLocale(req('i18n-iso-countries/langs/el.json'));
const atlas = req('world-atlas/countries-50m.json');
const atlasIds = new Set(atlas.objects.countries.geometries.map(g => String(g.id)));
const cjPop = req('country-json/src/country-by-population.json');

const isQ = (s) => !s || /^Q\d+$/.test(s);
function groupBy(rows, key) {
  const m = {};
  for (const r of rows) { const v = {}; for (const k in r) v[k] = r[k].value; (m[v[key]] ||= []).push(v); }
  return m;
}
const wd1 = groupBy(JSON.parse(fs.readFileSync(path.join(RAW, 'wd.json'))).results.bindings, 'iso');
const wd2 = groupBy(JSON.parse(fs.readFileSync(path.join(RAW, 'wd2.json'))).results.bindings, 'iso');

const EXTRA = new Set(['VA', 'PS', 'XK', 'TW']);
const list = wc.filter(c => c.unMember || EXTRA.has(c.cca2));
const byCca3 = Object.fromEntries(wc.map(c => [c.cca3, c]));
const included = new Set(list.map(c => c.cca2));

const REGION_EL = { Europe: 'Ευρώπη', Asia: 'Ασία', Africa: 'Αφρική', Americas: 'Αμερική', Oceania: 'Ωκεανία', Antarctic: 'Ανταρκτική' };
const uniq = (a) => [...new Set(a)];

const SHORT = {
  BN: 'Μπρουνέι', CD: 'ΛΔ Κονγκό', CG: 'Κονγκό', KM: 'Κομόρες', CV: 'Πράσινο Ακρωτήριο', CZ: 'Τσεχία',
  DM: 'Δομινίκα', ER: 'Ερυθραία', FJ: 'Φίτζι', FM: 'Μικρονησία', GQ: 'Ισημερινή Γουινέα', IR: 'Ιράν',
  KN: 'Άγιος Χριστόφορος και Νέβις', KR: 'Νότια Κορέα', LA: 'Λάος', LY: 'Λιβύη', LI: 'Λίχτενσταϊν',
  LS: 'Λεσότο', MC: 'Μονακό', MD: 'Μολδαβία', MK: 'Βόρεια Μακεδονία', KP: 'Βόρεια Κορέα', PS: 'Παλαιστίνη',
  RU: 'Ρωσία', SY: 'Συρία', TW: 'Ταϊβάν', TZ: 'Τανζανία', US: 'ΗΠΑ', VA: 'Βατικανό', XK: 'Κόσσοβο', HT: 'Αϊτή', UA: 'Ουκρανία', TD: 'Τσαντ',
};
const CUR_FIX = { 'δολάριο Ηνωμένες Πολιτείες': 'Δολάριο ΗΠΑ', 'νέο σέκελ Ισραήλ': 'Νέο σέκελ Ισραήλ', 'ρενμίνμπι': 'Γιουάν (Ρενμίνμπι)' };
const cap1 = (s) => s && (CUR_FIX[s] || s.charAt(0).toUpperCase() + s.slice(1)).replace(' (νόμισμα)', '');

const out = [];
for (const c of list) {
  const name = SHORT[c.cca2] || iso.getName(c.cca2, 'el');
  if (!name) { console.error('no greek name', c.cca2); continue; }
  const w1 = wd1[c.cca2] || [];
  const w2 = wd2[c.cca2] || [];
  // capital: only when a single, Greek-labelled capital and world-countries agrees on a single capital
  const caps = uniq(w1.map(r => r.capLabel).filter(x => x));
  let capital = null;
  if (caps.length === 1 && !isQ(caps[0]) && /[α-ωΑ-Ω]/.test(caps[0]) && (c.capital || []).length === 1) capital = caps[0];
  // population: wikidata preferred rank (max if several), else country-json
  const pops = w1.map(r => +r.pop).filter(x => x > 0);
  let population = pops.length ? Math.max(...pops) : null;
  if (!population) { const p = cjPop.find(x => x.country === c.name.common); population = p && p.population ? +p.population : null; }
  // currency: single currency with Greek label
  const curs = uniq(w2.map(r => r.curLabel).filter(x => x));
  const currency = curs.length === 1 && !isQ(curs[0]) && /[α-ωΑ-Ω]/.test(curs[0]) ? cap1(curs[0]) : null;
  // highest point: single with Greek label
  const hps = uniq(w2.map(r => r.hpLabel).filter(x => x));
  const highest = hps.length === 1 && !isQ(hps[0]) && /[α-ωΑ-Ω]/.test(hps[0]) ? hps[0] : null;
  const elevs = uniq(w2.filter(r => r.hpLabel === highest).map(r => Math.round(+r.elev)).filter(x => x > 0));
  const borders = (c.borders || []).map(b => byCca3[b] && byCca3[b].cca2).filter(x => x && included.has(x));
  const onMap = atlasIds.has(String(c.ccn3)) ? String(c.ccn3) : null;
  const pop = population || 0;
  const eu = c.region === 'Europe';
  const tier = (eu && pop > 2e6) || pop > 60e6 ? 1 : ((eu) || pop > 15e6 ? 2 : 3);
  out.push({
    code: c.cca2, name, capital, population, area: c.area, region: REGION_EL[c.region] || c.region,
    sub: c.subregion, currency, highest, highestElev: elevs.length === 1 ? elevs[0] : null,
    borders, mapId: onMap, latlng: c.latlng, landlocked: c.landlocked, tier,
  });
}
fs.writeFileSync(OUT, '// Παράγεται αυτόματα από build_geo.js (world-countries, i18n-iso-countries, Wikidata)\nwindow.GEO_COUNTRIES = ' + JSON.stringify(out) + ';\n');
const s = (k) => out.filter(x => x[k]).length;
console.log('countries', out.length, 'capital', s('capital'), 'pop', s('population'), 'currency', s('currency'), 'highest', s('highest'), 'map', s('mapId'));
console.log(out.filter(x => !x.capital).map(x => x.code).join(' '));
