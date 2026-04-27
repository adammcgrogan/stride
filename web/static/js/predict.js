const SPORT_CATEGORY = {
    Run: 'running', TrailRun: 'running', VirtualRun: 'running',
    Walk: 'running', Hike: 'running',
    Ride: 'cycling', VirtualRide: 'cycling', GravelRide: 'cycling',
    MountainBikeRide: 'cycling', EBikeRide: 'cycling',
    Swim: 'swimming', OpenWaterSwim: 'swimming',
};

const TARGETS = {
    running: [
        { label: '1 Mile',        m: 1609.34 },
        { label: '5K',            m: 5000 },
        { label: '10K',           m: 10000 },
        { label: '15K',           m: 15000 },
        { label: 'Half Marathon', m: 21097 },
        { label: 'Marathon',      m: 42195 },
    ],
    cycling: [
        { label: '20K',  m: 20000 },
        { label: '40K',  m: 40000 },
        { label: '100K', m: 100000 },
        { label: '200K', m: 200000 },
    ],
    swimming: [
        { label: '100m', m: 100 },
        { label: '500m', m: 500 },
        { label: '1K',   m: 1000 },
        { label: '2K',   m: 2000 },
        { label: '5K',   m: 5000 },
    ],
};

let currentSport = null;
let currentSeedIdx = 0;
let currentTSB = 0;

function computeCurrentTSB(activities) {
    const K42 = Math.exp(-1 / 42);
    const K7  = Math.exp(-1 / 7);
    const dailyLoad = {};
    for (const a of activities) {
        const date = a.StartDateLocal.slice(0, 10);
        const load = a.SufferScore > 0 ? a.SufferScore
                   : a.Kilojoules  > 0 ? a.Kilojoules / 10
                   : (a.MovingTime / 3600) * 50;
        dailyLoad[date] = (dailyLoad[date] || 0) + load;
    }
    const startDate = new Date(Object.keys(dailyLoad).sort()[0] + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let ctl = 0, atl = 0;
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
        const load = dailyLoad[localDateStr(d)] || 0;
        ctl = ctl * K42 + load * (1 - K42);
        atl = atl * K7  + load * (1 - K7);
    }
    return ctl - atl;
}

function tsbFactor(tsb) {
    if (tsb >= 20) return 0.97;   // peak freshness
    if (tsb >=  0) return 1.00;   // fresh baseline
    if (tsb >= -10) return 1.03;  // fatigued
    return 1.06;                  // overreaching
}

(function init() {
    if (!SEEDS.length) {
        document.getElementById('no-data').style.display = 'block';
        return;
    }

    document.getElementById('predictor').style.display = 'flex';

    const sports = [...new Set(SEEDS.map(s => s.SportType))];

    // Only show the sport filter when the athlete has multiple sports
    if (sports.length > 1) {
        const toolbar = document.getElementById('sport-toolbar');
        const bar     = document.getElementById('sport-filter-bar');
        toolbar.style.display = '';
        for (const sport of sports) {
            const btn = document.createElement('button');
            btn.className = 'period-btn';
            btn.textContent = sport;
            btn.addEventListener('click', () => selectSport(sport));
            bar.appendChild(btn);
        }
    }

    selectSport(sports[0]);

    // Fetch TSB in background; re-renders predictions once ready
    fetch('/api/activities?limit=10000').then(r => r.ok ? r.json() : []).then(activities => {
        if (!activities || !activities.length) return;
        currentTSB = computeCurrentTSB(activities);
        if (currentSport) renderPredictions();
    }).catch(() => {});
})();

// Exposed so the units toggle in layout can call render() to refresh pace labels.
function render() { if (currentSport) selectSport(currentSport); }

function selectSport(sport) {
    currentSport  = sport;
    currentSeedIdx = 0;

    document.querySelectorAll('#sport-filter-bar .period-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === sport);
    });

    const category = SPORT_CATEGORY[sport] || 'running';
    document.getElementById('pace-col-header').textContent =
        category === 'cycling'  ? (getUnits() === 'mi' ? 'Speed (mph)' : 'Speed (km/h)') :
        category === 'swimming' ? 'Pace /100m' :
                                  (getUnits() === 'mi' ? 'Pace /mi' : 'Pace /km');

    renderEfforts();
}

function renderEfforts() {
    const sportSeeds = SEEDS.filter(s => s.SportType === currentSport);
    const list = document.getElementById('seeds-list');
    list.innerHTML = '';

    sportSeeds.forEach((seed, idx) => {
        const isActive = idx === currentSeedIdx;
        const category = SPORT_CATEGORY[seed.SportType] || 'running';
        const card = document.createElement('div');
        card.className = 'effort-card' + (isActive ? ' effort-card--active' : '');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-pressed', isActive ? 'true' : 'false');

        const date = new Date(seed.Date.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
        });

        card.innerHTML = `
            <div class="effort-distance">${seed.Label}</div>
            <div class="effort-time">${fmtSecs(seed.Seconds)}</div>
            <div class="effort-pace">${fmtPace(seed.DistanceM, seed.Seconds, category)}</div>
            <div class="effort-meta">${escHtml(seed.ActivityName)}</div>
            <div class="effort-date">${date}</div>
        `;
        card.addEventListener('click', () => {
            currentSeedIdx = idx;
            renderEfforts();
        });
        list.appendChild(card);
    });

    renderPredictions();
}

function renderPredictions() {
    const sportSeeds = SEEDS.filter(s => s.SportType === currentSport);
    if (!sportSeeds.length) return;

    const seed     = sportSeeds[currentSeedIdx];
    const category = SPORT_CATEGORY[seed.SportType] || 'running';
    const targets  = TARGETS[category] || TARGETS.running;

    const date = new Date(seed.Date.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
    });
    const banner = document.getElementById('seed-banner');
    banner.style.display = '';
    document.getElementById('seed-banner-distance').textContent = seed.Label;
    document.getElementById('seed-banner-time').textContent = fmtSecs(seed.Seconds);
    document.getElementById('seed-banner-meta').innerHTML =
        `${escHtml(seed.ActivityName)}<br><span style="color:var(--muted)">${date}</span>`;

    // Form banner
    const formBanner = document.getElementById('form-banner');
    if (formBanner && currentTSB !== 0) {
        const factor = tsbFactor(currentTSB);
        const sign   = currentTSB >= 0 ? '+' : '';
        const zoneLabel = currentTSB >= 20 ? 'Race-ready'
                        : currentTSB >= 0  ? 'Fresh'
                        : currentTSB >= -10 ? 'Fatigued'
                        : 'Overreaching';
        const bannerCls = currentTSB >= 10  ? 'form-banner--peak'
                        : currentTSB >= 0   ? 'form-banner--fresh'
                        : currentTSB >= -10 ? 'form-banner--fatigued'
                        : 'form-banner--overreach';
        const adjNote   = factor < 1   ? `times adjusted ${((1 - factor) * 100).toFixed(0)}% faster`
                        : factor > 1   ? `times adjusted ${((factor - 1) * 100).toFixed(0)}% slower`
                        : 'no adjustment applied';
        formBanner.className = `form-banner ${bannerCls}`;
        formBanner.style.display = 'flex';
        formBanner.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            <div><strong>Form: ${zoneLabel}</strong> (TSB ${sign}${currentTSB.toFixed(0)}) — ${adjNote}.</div>
        `;
    } else if (formBanner) {
        formBanner.style.display = 'none';
    }

    const factor = tsbFactor(currentTSB);

    const tbody = document.querySelector('#predictions-table tbody');
    tbody.innerHTML = '';

    for (const target of targets) {
        const seedM    = seed.CanonicalM || seed.DistanceM;
        const ratio    = Math.max(target.m, seedM) / Math.min(target.m, seedM);
        const isSeed   = ratio < 1.5;
        const isFar    = ratio > 5;
        const rawTime  = isSeed ? seed.Seconds : riegel(seed.DistanceM, seed.Seconds, target.m);
        const time     = isSeed ? rawTime : Math.round(rawTime * factor);

        const tr = document.createElement('tr');
        if (isSeed) tr.className = 'pred-seed-row';
        if (isFar)  tr.className = 'pred-far-row';

        const timeCell = isSeed
            ? `<strong>${fmtSecs(time)}</strong> <span class="pred-your-time">your time</span>`
            : (isFar ? `<span class="pred-approx">~${fmtSecs(time)}</span>` : fmtSecs(time));

        tr.innerHTML = `
            <td class="pred-dist">${target.label}</td>
            <td class="pred-time">${timeCell}</td>
            <td class="pred-pace">${fmtPace(target.m, time, category)}</td>
        `;
        tbody.appendChild(tr);
    }
}

// ── Riegel formula ─────────────────────────────────────────────────────────

function riegel(d1, t1, d2) {
    return t1 * Math.pow(d2 / d1, 1.06);
}

// ── Formatting ─────────────────────────────────────────────────────────────

function fmtSecs(s) {
    s = Math.round(s);
    const h   = Math.floor(s / 3600);
    const m   = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
    return `${m}:${pad(sec)}`;
}

function fmtPace(distM, secs, category) {
    if (category === 'cycling') {
        const speedKph = (distM / 1000) / (secs / 3600);
        return getUnits() === 'mi'
            ? `${(speedKph / 1.60934).toFixed(1)} mph`
            : `${speedKph.toFixed(1)} km/h`;
    }
    if (category === 'swimming') {
        const sper100 = secs / (distM / 100);
        return `${Math.floor(sper100 / 60)}:${pad(Math.round(sper100 % 60))}`;
    }
    const dist = getUnits() === 'mi' ? 1609.344 : 1000;
    const unit = getUnits() === 'mi' ? '/mi' : '/km';
    const sp   = secs / (distM / dist);
    return `${Math.floor(sp / 60)}:${pad(Math.round(sp % 60))} ${unit}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
