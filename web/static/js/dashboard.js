'use strict';

async function init() {
    const resp = await fetch('/api/activities?limit=10000');
    if (!resp.ok) return;
    const activities = await resp.json() || [];
    renderWeeklyChart(activities);
    renderStreaks(activities);
}

function renderWeeklyChart(activities) {
    const kmByWeek = {};
    for (const activity of activities) {
        const weekStart = isoWeekStart(activity.StartDateLocal.slice(0, 10));
        kmByWeek[weekStart] = (kmByWeek[weekStart] || 0) + activity.Distance / 1000;
    }

    const now        = new Date();
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - ((now.getDay() || 7) - 1));

    const categories = [];
    const distanceData = [];
    for (let weeksAgo = 15; weeksAgo >= 0; weeksAgo--) {
        const weekDate = new Date(thisMonday);
        weekDate.setDate(thisMonday.getDate() - weeksAgo * 7);
        categories.push(weekDate.toLocaleString('default', { month: 'short', day: 'numeric' }));
        distanceData.push(+(kmByWeek[localDateStr(weekDate)] || 0).toFixed(1));
    }

    new ApexCharts(document.getElementById('weeklyChart'), {
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
            labels: { formatter: v => v.toFixed(0) + ' km', style: { colors: '#94a3b8', fontSize: '11px' } },
        },
        colors:      ['#FC4C02', '#cbd5e1'],
        stroke:      { width: [0, 2], curve: 'smooth' },
        legend:      { show: false },
        tooltip:     { enabledOnSeries: [0], y: { formatter: v => v.toFixed(1) + ' km' }, theme: 'dark' },
        plotOptions: { bar: { borderRadius: 5, columnWidth: '58%' } },
        dataLabels:  { enabled: false },
        grid: { borderColor: 'rgba(15,17,23,.06)', strokeDashArray: 4, xaxis: { lines: { show: false } } },
    }).render();
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
    document.getElementById('streak-grid').style.display    = '';
}

init();
