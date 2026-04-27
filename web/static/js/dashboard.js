'use strict';

let dashboardActivities = [];
let weeklyChart = null;

function renderWeeklyChart(activities) {
    const distByWeek = {};
    for (const activity of activities) {
        const weekStart = isoWeekStart(activity.StartDateLocal.slice(0, 10));
        distByWeek[weekStart] = (distByWeek[weekStart] || 0) + activity.Distance;
    }

    const now        = new Date();
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - ((now.getDay() || 7) - 1));

    const categories   = [];
    const distanceData = [];
    const divisor      = getUnits() === 'mi' ? 1609.344 : 1000;
    const unitLabel    = getUnits() === 'mi' ? 'mi' : 'km';

    for (let weeksAgo = 15; weeksAgo >= 0; weeksAgo--) {
        const weekDate = new Date(thisMonday);
        weekDate.setDate(thisMonday.getDate() - weeksAgo * 7);
        categories.push(weekDate.toLocaleString('default', { month: 'short', day: 'numeric' }));
        distanceData.push(+((distByWeek[localDateStr(weekDate)] || 0) / divisor).toFixed(1));
    }

    if (weeklyChart) { weeklyChart.destroy(); weeklyChart = null; }

    weeklyChart = new ApexCharts(document.getElementById('weeklyChart'), {
        chart: {
            type: 'bar',
            height: 220,
            fontFamily: 'Inter, system-ui, sans-serif',
            toolbar: { show: false },
            animations: { enabled: false },
            background: 'transparent',
        },
        series: [
            { name: 'Distance', type: 'bar',  data: distanceData },
            { name: 'Trend',    type: 'line', data: movingAvg(distanceData, 3) },
        ],
        xaxis: {
            categories,
            tickAmount: 8,
            labels: { rotate: -30, style: { colors: '#94a3b8', fontSize: '11px' } },
            axisBorder: { show: false },
            axisTicks:  { show: false },
        },
        yaxis: {
            labels: { formatter: v => v.toFixed(0) + ' ' + unitLabel, style: { colors: '#94a3b8', fontSize: '11px' } },
        },
        colors:      ['#FC4C02', '#cbd5e1'],
        stroke:      { width: [0, 2], curve: 'smooth' },
        legend:      { show: false },
        tooltip:     { enabledOnSeries: [0], y: { formatter: v => v.toFixed(1) + ' ' + unitLabel }, theme: 'dark' },
        plotOptions: { bar: { borderRadius: 5, columnWidth: '58%' } },
        dataLabels:  { enabled: false },
        grid: { borderColor: 'rgba(15,17,23,.06)', strokeDashArray: 4, xaxis: { lines: { show: false } } },
    });
    weeklyChart.render();
}

function renderStreaks(activities) {
    if (!activities.length) return;

    const activeDays = new Set(activities.map(a => a.StartDateLocal.slice(0, 10)));

    // Current streak — count backwards from today; if today is inactive, start from yesterday
    let currentStreak = 0;
    const cursor = new Date(); cursor.setHours(0, 0, 0, 0);
    if (!activeDays.has(localDateStr(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (activeDays.has(localDateStr(cursor))) {
        currentStreak++;
        cursor.setDate(cursor.getDate() - 1);
    }

    // Longest ever streak
    const sorted = [...activeDays].sort();
    let longestStreak = sorted.length > 0 ? 1 : 0;
    let run = 1;
    for (let i = 1; i < sorted.length; i++) {
        const gap = (new Date(sorted[i] + 'T00:00:00') - new Date(sorted[i - 1] + 'T00:00:00')) / 86400000;
        if (gap === 1) { run++; if (run > longestStreak) longestStreak = run; }
        else run = 1;
    }

    // Days active this month
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const activeThisMonth = [...activeDays].filter(d => d.startsWith(monthPrefix)).length;

    // Consistency: % of last 30 days with at least one activity
    let activeLast30 = 0;
    for (let i = 0; i < 30; i++) {
        const d = new Date(now); d.setDate(now.getDate() - i);
        if (activeDays.has(localDateStr(d))) activeLast30++;
    }
    const consistency = Math.round(activeLast30 / 30 * 100);

    document.getElementById('streak-current').innerHTML     = `${currentStreak}<small> days</small>`;
    document.getElementById('streak-longest').innerHTML     = `${longestStreak}<small> days</small>`;
    document.getElementById('streak-month').innerHTML       = `${activeThisMonth}<small> days</small>`;
    document.getElementById('streak-consistency').innerHTML = `${consistency}<small>%</small>`;
    document.getElementById('consistency-fill').style.width = consistency + '%';
}

// Exposed so the layout's units toggle can call render() to redraw the chart.
function render() {
    renderWeeklyChart(dashboardActivities);
}

// ── Training DNA ──────────────────────────────────────────────────────────────

let dnaChart = null;

function computeTrainingDNA(activities) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d28    = new Date(today); d28.setDate(today.getDate() - 28);
    const d28Str = localDateStr(d28);

    const recent = activities.filter(a => a.StartDateLocal.slice(0, 10) >= d28Str);
    const sorted = [...activities].sort((a, b) => a.StartDateLocal.localeCompare(b.StartDateLocal));
    if (!sorted.length) return null;

    const earliest = new Date(sorted[0].StartDateLocal.slice(0, 10) + 'T00:00:00');
    let maxVol = 0, maxIntensity = 0, maxElevPKm = 0, maxVariety = 0;

    for (let d = new Date(earliest); d < today; d.setDate(d.getDate() + 7)) {
        const from = localDateStr(d);
        const toD  = new Date(d); toD.setDate(d.getDate() + 28);
        const to   = localDateStr(toD);
        const w    = activities.filter(a => { const dt = a.StartDateLocal.slice(0, 10); return dt >= from && dt < to; });
        if (!w.length) continue;

        const vol       = w.reduce((s, a) => s + a.Distance, 0) / 1000;
        const elev      = w.reduce((s, a) => s + a.TotalElevationGain, 0);
        const ePKm      = vol > 0 ? elev / vol : 0;
        const variety   = new Set(w.map(a => a.SportType)).size;
        const sufferSum = w.reduce((s, a) => s + (a.SufferScore || 0), 0);
        const intensity = sufferSum > 0 ? sufferSum / w.length : w.reduce((s, a) => s + a.MovingTime, 0) / 3600;

        if (vol > maxVol)           maxVol = vol;
        if (intensity > maxIntensity) maxIntensity = intensity;
        if (ePKm > maxElevPKm)      maxElevPKm = ePKm;
        if (variety > maxVariety)   maxVariety = variety;
    }

    const rVol      = recent.reduce((s, a) => s + a.Distance, 0) / 1000;
    const rElev     = recent.reduce((s, a) => s + a.TotalElevationGain, 0);
    const rEPKm     = rVol > 0 ? rElev / rVol : 0;
    const rVariety  = new Set(recent.map(a => a.SportType)).size;
    const rSuffer   = recent.reduce((s, a) => s + (a.SufferScore || 0), 0);
    const rIntensity = rSuffer > 0
        ? rSuffer / Math.max(1, recent.length)
        : recent.reduce((s, a) => s + a.MovingTime, 0) / 3600;

    const activeDays  = new Set(recent.map(a => a.StartDateLocal.slice(0, 10))).size;
    const consistency = Math.round(activeDays / 28 * 100);

    const pct = (v, max) => max > 0 ? Math.min(100, Math.round(v / max * 100)) : 0;
    return {
        volume:      pct(rVol, maxVol),
        intensity:   pct(rIntensity, maxIntensity),
        consistency,
        elevation:   pct(rEPKm, maxElevPKm),
        variety:     pct(rVariety, maxVariety),
    };
}

function renderDNA(activities) {
    const scores = computeTrainingDNA(activities);
    if (!scores) return;

    document.getElementById('dna-card').style.display = '';

    const dims = [
        { key: 'volume',      label: 'Volume',      color: '#FC4C02', title: 'km in last 28 days vs. your best ever 4-week block' },
        { key: 'intensity',   label: 'Intensity',   color: '#ef4444', title: 'avg effort per session vs. personal peak' },
        { key: 'consistency', label: 'Consistency', color: '#f97316', title: '% of the last 28 days where you trained' },
        { key: 'elevation',   label: 'Elevation',   color: '#3b82f6', title: 'm of climbing per km vs. your hilliest 4-week block' },
        { key: 'variety',     label: 'Variety',     color: '#8b5cf6', title: 'distinct sport types vs. your most varied 4-week block' },
    ];

    document.getElementById('dna-scores').innerHTML = dims.map(d => `
        <div class="dna-row" title="${d.title}">
            <span class="dna-row-label">${d.label}</span>
            <div class="dna-bar-track"><div class="dna-bar-fill" style="width:${scores[d.key]}%;background:${d.color}"></div></div>
            <span class="dna-row-value">${scores[d.key]}</span>
        </div>
    `).join('');

    const isDark    = document.documentElement.dataset.theme === 'dark';
    const polyColor = isDark ? 'rgba(255,255,255,.07)' : 'rgba(15,17,23,.07)';

    if (dnaChart) { dnaChart.destroy(); dnaChart = null; }

    dnaChart = new ApexCharts(document.getElementById('dna-chart'), {
        chart: {
            type: 'radar', height: 260, toolbar: { show: false },
            background: 'transparent', fontFamily: 'Inter, system-ui, sans-serif',
            animations: { enabled: false },
        },
        series:  [{ name: 'Score', data: dims.map(d => scores[d.key]) }],
        xaxis:   { categories: dims.map(d => d.label) },
        yaxis:   { show: false, max: 100, min: 0 },
        fill:    { opacity: 0.18 },
        stroke:  { width: 2 },
        colors:  ['#FC4C02'],
        markers: { size: 4, colors: ['#FC4C02'], strokeWidth: 0 },
        plotOptions: {
            radar: {
                size: 100,
                polygons: { strokeColors: polyColor, fill: { colors: [polyColor, 'transparent'] } },
            },
        },
        tooltip: { theme: 'dark', y: { formatter: v => Math.round(v) + ' / 100' } },
    });
    dnaChart.render();
}

// ── init ──────────────────────────────────────────────────────────────────────

async function init() {
    const resp = await fetch('/api/activities?limit=10000');
    if (!resp.ok) return;
    dashboardActivities = await resp.json() || [];
    renderWeeklyChart(dashboardActivities);
    renderStreaks(dashboardActivities);
    renderDNA(dashboardActivities);
}

init();
