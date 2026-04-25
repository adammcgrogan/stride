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
})();

function selectSport(sport) {
    currentSport  = sport;
    currentSeedIdx = 0;

    document.querySelectorAll('#sport-filter-bar .period-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === sport);
    });

    const category = SPORT_CATEGORY[sport] || 'running';
    document.getElementById('pace-col-header').textContent =
        category === 'cycling'  ? 'Speed'        :
        category === 'swimming' ? 'Pace /100m'   :
                                  'Pace /km';

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

    const tbody = document.querySelector('#predictions-table tbody');
    tbody.innerHTML = '';

    for (const target of targets) {
        const ratio    = Math.max(target.m, seed.DistanceM) / Math.min(target.m, seed.DistanceM);
        const isSeed   = ratio < 1.5;
        const isFar    = ratio > 5;
        const time     = isSeed ? seed.Seconds : riegel(seed.DistanceM, seed.Seconds, target.m);

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
        return `${((distM / 1000) / (secs / 3600)).toFixed(1)} km/h`;
    }
    if (category === 'swimming') {
        const sper100 = secs / (distM / 100);
        return `${Math.floor(sper100 / 60)}:${pad(Math.round(sper100 % 60))}`;
    }
    const spkm = secs / (distM / 1000);
    return `${Math.floor(spkm / 60)}:${pad(Math.round(spkm % 60))}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
