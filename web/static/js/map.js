'use strict';

// ── polyline decoder ──────────────────────────────────────────────────────────

function decodePolyline(encoded) {
    const coords = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
        let b, shift = 0, result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lat += result & 1 ? ~(result >> 1) : (result >> 1);
        shift = 0; result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lng += result & 1 ? ~(result >> 1) : (result >> 1);
        coords.push([lng / 1e5, lat / 1e5]);
    }
    return coords;
}

// ── colour helpers ────────────────────────────────────────────────────────────

function lerpColor(a, b, t) {
    const ah = parseInt(a.slice(1), 16), bh = parseInt(b.slice(1), 16);
    const lerp = (mask, shift) =>
        Math.round(((ah >> shift) & mask) + (((bh >> shift) & mask) - ((ah >> shift) & mask)) * t);
    const r = lerp(0xff, 16), g = lerp(0xff, 8), bl = lerp(0xff, 0);
    return '#' + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0');
}

function fmtPace(secsPerKm) {
    const m = Math.floor(secsPerKm / 60);
    const s = Math.round(secsPerKm % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

// ── state ─────────────────────────────────────────────────────────────────────

let decoded     = [];
let colorMode   = 'default';
let viewMode    = 'lines';
let sportFilter = '';
let glMap       = null;

// ── GeoJSON builders ──────────────────────────────────────────────────────────

function buildLineGeoJSON(rows) {
    if (!rows.length) return { type: 'FeatureCollection', features: [] };

    const tsList   = rows.map(r => r.ts);
    const paceList = rows.filter(r => r.pace !== null).map(r => r.pace);
    let minTs = tsList[0], maxTs = tsList[0];
    for (const t of tsList) { if (t < minTs) minTs = t; if (t > maxTs) maxTs = t; }
    let minPace = paceList[0] ?? 0, maxPace = paceList[0] ?? 1;
    for (const p of paceList) { if (p < minPace) minPace = p; if (p > maxPace) maxPace = p; }

    return {
        type: 'FeatureCollection',
        features: rows.map(r => {
            let color = '#FC4C02';
            if (colorMode === 'recency') {
                const t = maxTs > minTs ? (r.ts - minTs) / (maxTs - minTs) : 1;
                color = lerpColor('#3b82f6', '#FC4C02', t);
            } else if (colorMode === 'pace' && r.pace !== null) {
                const t = maxPace > minPace ? (r.pace - minPace) / (maxPace - minPace) : 0;
                color = lerpColor('#22c55e', '#ef4444', t);
            }
            return {
                type: 'Feature',
                properties: {
                    color,
                    name:       r.Name,
                    date:       r.StartDateLocal.slice(0, 10),
                    distance:   r.Distance,
                    pace:       r.pace,
                    activityId: r.ID,
                },
                geometry: { type: 'LineString', coordinates: r.coords },
            };
        }),
    };
}

function buildHeatPoints(rows) {
    const features = [];
    for (const r of rows) {
        for (let i = 0; i < r.coords.length; i += 4) {
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: r.coords[i] },
                properties: {},
            });
        }
    }
    return { type: 'FeatureCollection', features };
}

// ── update ────────────────────────────────────────────────────────────────────

function filteredRows() {
    return sportFilter ? decoded.filter(r => r.SportType === sportFilter) : decoded;
}

function updateLegend() {
    const el  = document.getElementById('color-legend');
    const bar = el.querySelector('.legend-bar');
    if (viewMode === 'heatmap' || colorMode === 'default') {
        el.style.display = 'none';
        return;
    }
    el.style.display = 'flex';
    if (colorMode === 'recency') {
        bar.style.background = 'linear-gradient(to right, #3b82f6, #FC4C02)';
        document.getElementById('legend-lo').textContent = 'Oldest';
        document.getElementById('legend-hi').textContent = 'Most recent';
    } else {
        bar.style.background = 'linear-gradient(to right, #22c55e, #ef4444)';
        document.getElementById('legend-lo').textContent = 'Fastest';
        document.getElementById('legend-hi').textContent = 'Slowest';
    }
}

function update() {
    const rows    = filteredRows();
    const countEl = document.getElementById('route-count');
    countEl.textContent = rows.length === decoded.length
        ? `${rows.length} routes`
        : `${rows.length} of ${decoded.length} routes`;

    if (viewMode === 'lines') {
        glMap.setLayoutProperty('routes-lines', 'visibility', 'visible');
        glMap.setLayoutProperty('routes-heat',  'visibility', 'none');
        glMap.getSource('routes-lines-src').setData(buildLineGeoJSON(rows));
    } else {
        glMap.setLayoutProperty('routes-lines', 'visibility', 'none');
        glMap.setLayoutProperty('routes-heat',  'visibility', 'visible');
        glMap.getSource('routes-heat-src').setData(buildHeatPoints(rows));
    }
    updateLegend();
}

// ── init ──────────────────────────────────────────────────────────────────────

(async function init() {
    const resp = await fetch('/api/polylines');
    if (!resp.ok) return;
    const rows = await resp.json() || [];

    decoded = rows.map(r => ({
        ...r,
        coords: decodePolyline(r.Polyline),
        ts:     new Date(r.StartDateLocal).getTime(),
        pace:   r.Distance > 0 ? r.MovingTime / (r.Distance / 1000) : null,
    }));

    // Sport filter
    const sports      = [...new Set(rows.map(r => r.SportType))].sort();
    const sportSelect = document.getElementById('sport-filter');
    for (const s of sports) {
        const o = document.createElement('option');
        o.value = s; o.textContent = s;
        sportSelect.appendChild(o);
    }
    sportSelect.addEventListener('change', () => { sportFilter = sportSelect.value; update(); });

    // View toggle
    document.querySelectorAll('[data-view]').forEach(btn => {
        btn.addEventListener('click', () => {
            viewMode = btn.dataset.view;
            document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('color-by-group').style.display =
                viewMode === 'lines' ? '' : 'none';
            update();
        });
    });

    // Colour-by
    document.getElementById('color-by').addEventListener('change', e => {
        colorMode = e.target.value;
        update();
    });

    glMap = new maplibregl.Map({
        container: 'map',
        style: {
            version: 8,
            sources: {
                carto: {
                    type: 'raster',
                    tiles: [
                        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                    ],
                    tileSize: 256,
                    attribution: '© <a href="https://carto.com/">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                },
            },
            layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
        },
        center: [0, 20],
        zoom: 2,
    });

    glMap.on('load', () => {
        const empty = { type: 'FeatureCollection', features: [] };

        glMap.addSource('routes-lines-src', { type: 'geojson', data: empty });
        glMap.addLayer({
            id: 'routes-lines',
            type: 'line',
            source: 'routes-lines-src',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': ['get', 'color'], 'line-opacity': 0.07, 'line-width': 3 },
        });

        glMap.addSource('routes-heat-src', { type: 'geojson', data: empty });
        glMap.addLayer({
            id: 'routes-heat',
            type: 'heatmap',
            source: 'routes-heat-src',
            layout: { visibility: 'none' },
            paint: {
                'heatmap-weight': 1,
                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
                'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
                    0,   'rgba(0,0,0,0)',
                    0.2, '#1d4ed8',
                    0.4, '#7c3aed',
                    0.6, '#dc2626',
                    0.8, '#f97316',
                    1,   '#fbbf24',
                ],
                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 20],
                'heatmap-opacity': 0.85,
            },
        });

        // Click popup on routes
        glMap.on('click', 'routes-lines', e => {
            const p    = e.features[0].properties;
            const dist = p.distance ? (p.distance / 1000).toFixed(1) + ' km' : '—';
            const pace = p.pace     ? fmtPace(p.pace) + '/km' : '—';
            new maplibregl.Popup({ closeButton: false, offset: 8 })
                .setLngLat(e.lngLat)
                .setHTML(
                    `<a href="/activities/${p.activityId}"><strong>${p.name}</strong></a>` +
                    `<br><span>${p.date} &nbsp;·&nbsp; ${dist} &nbsp;·&nbsp; ${pace}</span>`
                )
                .addTo(glMap);
        });
        glMap.on('mouseenter', 'routes-lines', () => { glMap.getCanvas().style.cursor = 'pointer'; });
        glMap.on('mouseleave', 'routes-lines', () => { glMap.getCanvas().style.cursor = ''; });

        // Auto-fit to all routes
        if (decoded.length > 0) {
            let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
            for (const r of decoded) {
                for (const [lng, lat] of r.coords) {
                    if (lng < minLng) minLng = lng; if (lat < minLat) minLat = lat;
                    if (lng > maxLng) maxLng = lng; if (lat > maxLat) maxLat = lat;
                }
            }
            glMap.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 40, maxZoom: 14 });
        }

        update();
    });
})();
