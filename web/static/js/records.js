'use strict';

// Distance bands matching records.go bandsByCategory["running"]
const DIST_BANDS = {
    '5k':       { label: '5K',           min: 4000,   max: 8000   },
    '10k':      { label: '10K',          min: 8000,   max: 15000  },
    'half':     { label: 'Half Marathon', min: 17000,  max: 25000  },
    'marathon': { label: 'Marathon',      min: 36000,  max: 50000  },
};

let progressionChart = null;
let progressionData  = [];
let activeDist       = '5k';

function secPerUnit(movingTime, distance) {
    if (getUnits() === 'mi') return movingTime / (distance / 1609.344);
    return movingTime / (distance / 1000);
}

function fmtPaceSecs(secsPerUnit) {
    const m = Math.floor(secsPerUnit / 60);
    const s = Math.round(secsPerUnit % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

function renderProgressionChart(distKey) {
    activeDist = distKey;
    document.querySelectorAll('#progression-dist-tabs .period-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.dist === distKey);
    });

    const band = DIST_BANDS[distKey];
    const matching = progressionData.filter(a =>
        a.Distance >= band.min && a.Distance <= band.max
    );

    const empty = document.getElementById('progression-empty');
    const chartEl = document.getElementById('progression-chart');

    if (matching.length < 3) {
        empty.style.display = '';
        chartEl.style.display = 'none';
        return;
    }
    empty.style.display = 'none';
    chartEl.style.display = '';

    // Group by month, keep best pace (lowest sec/km) per month
    const byMonth = {};
    for (const a of matching) {
        const month = a.Date.slice(0, 7); // "YYYY-MM"
        const pace  = secPerUnit(a.Time, a.Distance);
        if (!byMonth[month] || pace < byMonth[month]) {
            byMonth[month] = pace;
        }
    }

    const months   = Object.keys(byMonth).sort();
    const paceData = months.map(m => ({ x: m, y: +byMonth[m].toFixed(1) }));

    const isDark    = document.documentElement.dataset.theme === 'dark';
    const textColor = isDark ? '#8b97aa' : '#64748b';
    const gridColor = isDark ? 'rgba(255,255,255,.05)' : 'rgba(15,17,23,.05)';
    const unit      = getUnits() === 'mi' ? '/mi' : '/km';

    if (progressionChart) { progressionChart.destroy(); progressionChart = null; }

    progressionChart = new ApexCharts(chartEl, {
        chart: {
            type: 'line',
            height: 240,
            toolbar: { show: false },
            background: 'transparent',
            animations: { enabled: false },
        },
        series: [{ name: `Pace (min${unit})`, data: paceData }],
        xaxis: {
            type: 'category',
            labels: {
                style: { colors: textColor, fontSize: '11px' },
                rotate: -30,
                rotateAlways: false,
            },
            axisBorder: { show: false },
            axisTicks: { show: false },
        },
        yaxis: {
            reversed: true,
            labels: {
                style: { colors: textColor, fontSize: '11px' },
                formatter: v => fmtPaceSecs(v),
            },
            title: { text: `min${unit}`, style: { color: textColor, fontSize: '11px', fontWeight: 500 } },
        },
        stroke: { curve: 'smooth', width: 2 },
        colors: ['#FC4C02'],
        markers: { size: 4, colors: ['#FC4C02'], strokeWidth: 0 },
        grid: { borderColor: gridColor, strokeDashArray: 4 },
        tooltip: {
            theme: isDark ? 'dark' : 'light',
            y: { formatter: v => fmtPaceSecs(v) + unit },
        },
    });
    progressionChart.render();
}

(async function initRecords() {
    const card = document.getElementById('progression-card');
    if (!card) return;

    const resp = await fetch('/api/progress');
    if (!resp.ok) return;
    progressionData = await resp.json();
    if (!progressionData) progressionData = [];

    document.querySelectorAll('#progression-dist-tabs .period-btn').forEach(btn => {
        btn.addEventListener('click', () => renderProgressionChart(btn.dataset.dist));
    });

    renderProgressionChart(activeDist);
})();
