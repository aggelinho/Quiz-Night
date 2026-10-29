// Σχεδίαση χάρτη για τις ερωτήσεις «Ποια χώρα είναι σημειωμένη;».
(function () {
  const CDN = {
    d3: 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js',
    topo: 'https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js',
    atlas: 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json',
  };
  let ready = null;
  const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  function load() {
    if (!ready) ready = Promise.all([loadScript(CDN.d3), loadScript(CDN.topo)])
      .then(() => fetch(CDN.atlas)).then((r) => r.json())
      .then((w) => topojson.feature(w, w.objects.countries).features);
    return ready;
  }
  async function draw(el, media) {
    el.innerHTML = '<div class="map-loading">Φόρτωση χάρτη…</div>';
    let features;
    try { features = await load(); } catch (e) { el.innerHTML = '<div class="map-loading">Ο χάρτης δεν φόρτωσε. Έλεγξε τη σύνδεση.</div>'; return; }
    const W = 640, H = 400;
    const [lat, lng] = media.latlng;
    const span = Math.max(24, Math.min(110, Math.sqrt(media.area) / 111 * 3.2));
    const box = { type: 'MultiPoint', coordinates: [[lng - span, Math.max(-80, lat - span * 0.6)], [lng + span, Math.min(82, lat + span * 0.6)]] };
    const proj = d3.geoMercator().fitExtent([[0, 0], [W, H]], box);
    const path = d3.geoPath(proj);
    const svg = d3.create('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('class', 'map-svg').attr('role', 'img').attr('aria-label', 'Χάρτης με σημειωμένη χώρα');
    svg.append('rect').attr('width', W).attr('height', H).attr('class', 'map-sea');
    svg.append('g').selectAll('path').data(features).join('path')
      .attr('d', path).attr('class', (d) => (String(d.id) === media.mapId ? 'map-target' : 'map-land'));
    const target = features.find((d) => String(d.id) === media.mapId);
    if (target && media.area < 30000) {
      let c = path.centroid(target);
      if (!isFinite(c[0]) || c[0] < 0 || c[0] > W || c[1] < 0 || c[1] > H) c = proj([lng, lat]);
      svg.append('circle').attr('cx', c[0]).attr('cy', c[1]).attr('r', 16).attr('class', 'map-ring');
    }
    el.innerHTML = '';
    el.appendChild(svg.node());
  }
  window.QuizMap = { draw, preload: load };
})();
