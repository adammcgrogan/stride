'use strict';

// Distance bands per sport category — mirrors records.go bandsByCategory
const BANDS = {
    running: [
        { key: '5k',       label: '5K',            min: 4000,   max: 8000   },
        { key: '10k',      label: '10K',            min: 8000,   max: 15000  },
        { key: 'half',     label: 'Half Marathon',  min: 17000,  max: 25000  },
        { key: 'marathon', label: 'Marathon',       min: 36000,  max: 50000  },
    ],
    cycling: [
        { key: 'c10k',  label: '10K',   min: 8000,   max: 15000  },
        { key: 'c20k',  label: '20K',   min: 15000,  max: 28000  },
        { key: 'c50k',  label: '50K',   min: 38000,  max: 65000  },
        { key: 'c100k', label: '100K',  min: 80000,  max: 130000 },
    ],
    swimming: [
        { key: 's500',  label: '500m',  min: 300,   max: 800   },
        { key: 's1k',   label: '1K',    min: 700,   max: 2000  },
        { key: 's2k',   label: '2K',    min: 1500,  max: 3500  },
        { key: 's5k',   label: '5K',    min: 3500,  max: 8000  },
    ],
};

const SPORT_CATEGORY = {
    Run: 'running', TrailRun: 'running', VirtualRun: 'running', Walk: 'running', Hike: 'running',
    Ride: 'cycling', VirtualRide: 'cycling', GravelRide: 'cycling', MountainBikeRide: 'cycling', EBikeRide: 'cycling',
    Swim: 'swimming', OpenWaterSwim: 'swimming',
};

let progressionChart = null;
let progressionData  = [];
let activeDist       = null;
let activeSport      = ''; // '' = all

function bandsForSport(sport) {
    if (!sport) {
        // "All" — use first visible sport card's category
        const firstCard = document.querySelector('.records-sport-card:not([style*="none"])');
        const s = firstCard ? firstCard.dataset.sport : '';
        return BANDS[SPORT_CATEGORY[s] || 'running'] || BANDS.running;
    }
    return BANDS[SPORT_CATEGORY[sport] || 'running'] || BANDS.running;
}

function buildProgressionTabs(sport) {
    const bands = bandsForSport(sport);
    const container = document.getElementById('progression-dist-tabs');
    container.innerHTML = '';

    bands.forEach((b, i) => {
        const btn = document.createElement('button');
        btn.className = 'period-btn' + (i === 0 ? ' active' : '');
        btn.dataset.dist = b.key;
        btn.textContent  = b.label;
        btn.addEventListener('click', () => renderProgressionChart(b.key, sport));
        container.appendChild(btn);
    });

    activeDist = bands[0].key;
}

function renderProgressionChart(distKey, sport) {
    activeDist = distKey;
    const bands = bandsForSport(sport);
    const band  = bands.find(b => b.key === distKey) || bands[0];

    document.querySelectorAll('#progression-dist-tabs .period-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.dist === distKey);
    });

    // Filter data by distance band and (if set) sport
    const matching = progressionData.filter(a => {
        if (sport && a.Sport !== sport) return false;
        return a.Distance >= band.min && a.Distance <= band.max;
    });

    const emptyEl  = document.getElementById('progression-empty');
    const chartEl  = document.getElementById('progression-chart');

    if (matching.length < 3) {
        emptyEl.style.display = '';
        chartEl.style.display = 'none';
        return;
    }
    emptyEl.style.display = 'none';
    chartEl.style.display = '';

    // Group by month, keep best pace per month
    const byMonth = {};
    const dist = getUnits() === 'mi' ? 1609.344 : 1000;
    for (const a of matching) {
        const month = a.Date.slice(0, 7);
        const pace  = a.Time / (a.Distance / dist);
        if (!byMonth[month] || pace < byMonth[month]) byMonth[month] = pace;
    }

    const months   = Object.keys(byMonth).sort();
    const paceData = months.map(m => ({ x: m, y: +byMonth[m].toFixed(1) }));
    const unit     = getUnits() === 'mi' ? '/mi' : '/km';

    const isDark    = document.documentElement.dataset.theme === 'dark';
    const textColor = isDark ? '#8b97aa' : '#64748b';
    const gridColor = isDark ? 'rgba(255,255,255,.05)' : 'rgba(15,17,23,.05)';

    if (progressionChart) { progressionChart.destroy(); progressionChart = null; }

    progressionChart = new ApexCharts(chartEl, {
        chart: {
            type: 'line', height: 240,
            toolbar: { show: false }, background: 'transparent',
            animations: { enabled: false },
        },
        series: [{ name: `Pace (min${unit})`, data: paceData }],
        xaxis: {
            type: 'category',
            labels: { style: { colors: textColor, fontSize: '11px' }, rotate: -30 },
            axisBorder: { show: false }, axisTicks: { show: false },
        },
        yaxis: {
            reversed: true,
            labels: {
                style: { colors: textColor, fontSize: '11px' },
                formatter: v => { const m = Math.floor(v/60), s = Math.round(v%60); return `${m}:${String(s).padStart(2,'0')}`; },
            },
            title: { text: `min${unit}`, style: { color: textColor, fontSize: '11px', fontWeight: 500 } },
        },
        stroke: { curve: 'smooth', width: 2 },
        colors: ['#FC4C02'],
        markers: { size: 4, colors: ['#FC4C02'], strokeWidth: 0 },
        grid: { borderColor: gridColor, strokeDashArray: 4 },
        tooltip: {
            theme: isDark ? 'dark' : 'light',
            y: { formatter: v => { const m = Math.floor(v/60), s = Math.round(v%60); return `${m}:${String(s).padStart(2,'0')}${unit}`; } },
        },
    });
    progressionChart.render();
}

(async function initRecords() {
    const card = document.getElementById('progression-card');
    if (!card) return;

    const resp = await fetch('/api/progress');
    if (!resp.ok) return;
    progressionData = await resp.json() || [];

    buildProgressionTabs(activeSport);
    renderProgressionChart(activeDist, activeSport);

    // Re-build tabs and chart when sport filter changes
    document.addEventListener('records-sport-changed', e => {
        activeSport = e.detail.sport;
        buildProgressionTabs(activeSport);
        renderProgressionChart(activeDist, activeSport);
    });
})();
