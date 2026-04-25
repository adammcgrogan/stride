'use strict';

let allActivities = [];
let apexChart     = null;
let hrZoneChart   = null;
let maxHR         = 190;

// ── filters ───────────────────────────────────────────────────────────────────

function applyFilters() {
    const dateFrom = document.getElementById('date-from').value;
    const dateTo   = document.getElementById('date-to').value;
    const sport    = document.getElementById('sport-filter').value;

    return allActivities.filter(a => {
        const date = a.StartDateLocal.slice(0, 10);
        if (dateFrom && date < dateFrom)              return false;
        if (dateTo   && date > dateTo)                return false;
        if (sport    && a.SportType !== sport)        return false;
        return true;
    });
}

// Returns activities in the comparison window for the given period:
//   week  → same 7-day span shifted back 7 days
//   month → same calendar days shifted back 1 month
//   year  → same window shifted back 1 year
function priorPeriodFilter(dateFrom, dateTo, period) {
    if (!dateFrom || !dateTo) return null;
    let from, to;
    if (period === 'week') {
        const f = new Date(dateFrom + 'T00:00:00'); f.setDate(f.getDate() - 7);
        const t = new Date(dateTo   + 'T00:00:00'); t.setDate(t.getDate() - 7);
        from = localDateStr(f); to = localDateStr(t);
    } else if (period === 'month') {
        const f = new Date(dateFrom + 'T00:00:00'); f.setMonth(f.getMonth() - 1);
        const t = new Date(dateTo   + 'T00:00:00'); t.setMonth(t.getMonth() - 1);
        from = localDateStr(f); to = localDateStr(t);
    } else {
        const shiftYear = s => `${parseInt(s.slice(0, 4), 10) - 1}${s.slice(4)}`;
        from = shiftYear(dateFrom); to = shiftYear(dateTo);
    }
    const sport = document.getElementById('sport-filter').value;
    return allActivities.filter(a => {
        const date = a.StartDateLocal.slice(0, 10);
        if (date < from || date > to)       return false;
        if (sport && a.SportType !== sport) return false;
        return true;
    });
}

// ── comparison helpers ────────────────────────────────────────────────────────

function deltaHtml(current, prior, label) {
    if (!prior) return '';
    const pct  = Math.round((current - prior) / prior * 100);
    if (pct === 0) return `<span class="stat-delta">= ${label}</span>`;
    const cls  = pct > 0 ? 'delta-up' : 'delta-down';
    const sign = pct > 0 ? '+' : '';
    return `<span class="stat-delta ${cls}">${sign}${pct}% ${label}</span>`;
}

// ── stat cards ────────────────────────────────────────────────────────────────

function updateSummaryCards(activities, priorActivities, priorLabel) {
    const count     = activities.length;
    const totalDist = activities.reduce((sum, a) => sum + a.Distance, 0);
    const totalElev = activities.reduce((sum, a) => sum + a.TotalElevationGain, 0);
    const totalTime = activities.reduce((sum, a) => sum + a.MovingTime, 0);

    document.getElementById('s-count').textContent     = count;
    document.getElementById('s-distance').innerHTML    = (totalDist / 1000).toFixed(1) + ' <small>km</small>';
    document.getElementById('s-elevation').innerHTML   = Math.round(totalElev) + ' <small>m</small>';
    document.getElementById('s-time').textContent      = fmtTime(totalTime);
    document.getElementById('s-avg').innerHTML         = count
        ? (totalDist / count / 1000).toFixed(1) + ' <small>km</small>'
        : '—';

    const deltaIds = ['s-count-delta', 's-distance-delta', 's-elevation-delta', 's-time-delta', 's-avg-delta'];

    if (priorActivities) {
        const pCount = priorActivities.length;
        const pDist  = priorActivities.reduce((sum, a) => sum + a.Distance, 0);
        const pElev  = priorActivities.reduce((sum, a) => sum + a.TotalElevationGain, 0);
        const pTime  = priorActivities.reduce((sum, a) => sum + a.MovingTime, 0);

        document.getElementById('s-count-delta').innerHTML     = deltaHtml(count, pCount, priorLabel);
        document.getElementById('s-distance-delta').innerHTML  = deltaHtml(totalDist, pDist, priorLabel);
        document.getElementById('s-elevation-delta').innerHTML = deltaHtml(totalElev, pElev, priorLabel);
        document.getElementById('s-time-delta').innerHTML      = deltaHtml(totalTime, pTime, priorLabel);
        document.getElementById('s-avg-delta').innerHTML       = (count && pCount)
            ? deltaHtml(totalDist / count, pDist / pCount, priorLabel) : '';
    } else {
        deltaIds.forEach(id => { document.getElementById(id).innerHTML = ''; });
    }
}

// ── sport bar list ────────────────────────────────────────────────────────────

function updateSportTable(activities) {
    const bySport = {};
    for (const a of activities) {
        if (!bySport[a.SportType]) bySport[a.SportType] = { count: 0, distance: 0, time: 0 };
        bySport[a.SportType].count++;
        bySport[a.SportType].distance += a.Distance;
        bySport[a.SportType].time     += a.MovingTime;
    }

    const rows     = Object.entries(bySport).sort((a, b) => b[1].count - a[1].count);
    const maxCount = rows.length ? rows[0][1].count : 1;
    const container = document.getElementById('sport-bars');

    if (!rows.length) {
        container.innerHTML = '<p style="color:var(--muted);font-size:.875rem">No activities</p>';
        return;
    }

    container.innerHTML = rows.map(([sport, stats]) => {
        const pct = (stats.count / maxCount * 100).toFixed(1);
        return `<div class="sport-bar-row">
            <span class="sport-bar-label">${sport}</span>
            <div class="sport-bar-track"><div class="sport-bar-fill" style="width:${pct}%"></div></div>
            <span class="sport-bar-meta">
                <strong>${stats.count}</strong>
                <span>${fmtKm(stats.distance)}</span>
                <span>${fmtTime(stats.time)}</span>
            </span>
        </div>`;
    }).join('');
}

// ── day/hour heatmap ──────────────────────────────────────────────────────────

function renderDayHourHeatmap(activities) {
    const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const a of activities) {
        const d    = new Date(a.StartDateLocal.slice(0, 10) + 'T00:00:00');
        const dow  = (d.getDay() + 6) % 7;
        const hour = parseInt(a.StartDateLocal.slice(11, 13), 10);
        if (!isNaN(dow) && !isNaN(hour)) grid[dow][hour]++;
    }

    const maxVal = Math.max(...grid.flat(), 1);
    const DAYS   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const CELL = 16, GAP = 3, STEP = CELL + GAP;
    const LEFT = 32, TOP = 22;
    const ns   = 'http://www.w3.org/2000/svg';
    const svg  = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${LEFT + 24 * STEP} ${TOP + 7 * STEP}`);
    svg.style.cssText = 'display:block;width:100%;height:auto;min-width:400px';

    for (let h = 0; h < 24; h += 3) {
        const label = h === 0 ? '12am' : h === 12 ? '12pm' : h < 12 ? h + 'am' : (h - 12) + 'pm';
        const t = document.createElementNS(ns, 'text');
        t.setAttribute('x', LEFT + h * STEP + CELL / 2);
        t.setAttribute('y', TOP - 8);
        t.setAttribute('font-size', '9'); t.setAttribute('fill', '#9ca3af');
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-family', 'Inter, system-ui, sans-serif');
        t.textContent = label;
        svg.appendChild(t);
    }

    for (let d = 0; d < 7; d++) {
        const t = document.createElementNS(ns, 'text');
        t.setAttribute('x', LEFT - 4);
        t.setAttribute('y', TOP + d * STEP + CELL - 3);
        t.setAttribute('font-size', '9'); t.setAttribute('fill', '#9ca3af');
        t.setAttribute('text-anchor', 'end');
        t.setAttribute('font-family', 'Inter, system-ui, sans-serif');
        t.textContent = DAYS[d];
        svg.appendChild(t);
    }

    const tip = (() => {
        let el = document.getElementById('dh-heatmap-tip');
        if (!el) {
            el = document.createElement('div');
            el.id = 'dh-heatmap-tip';
            el.className = 'heatmap-tip';
            document.body.appendChild(el);
        }
        return el;
    })();

    for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
            const count     = grid[d][h];
            const intensity = count / maxVal;
            const fill      = count === 0
                ? '#ebedf0'
                : `rgba(252,76,2,${(0.15 + intensity * 0.85).toFixed(2)})`;
            const rect = document.createElementNS(ns, 'rect');
            rect.setAttribute('x', LEFT + h * STEP); rect.setAttribute('y', TOP + d * STEP);
            rect.setAttribute('width', CELL); rect.setAttribute('height', CELL);
            rect.setAttribute('rx', 3); rect.setAttribute('fill', fill);
            const hourLabel = h === 0 ? '12am' : h === 12 ? '12pm'
                : h < 12 ? h + 'am' : (h - 12) + 'pm';
            const tipText = `${DAYS[d]} ${hourLabel} · ${count} activit${count === 1 ? 'y' : 'ies'}`;
            rect.addEventListener('mouseenter', e => {
                tip.textContent = tipText; tip.style.display = 'block';
                tip.style.left = (e.clientX + 12) + 'px'; tip.style.top = (e.clientY - 34) + 'px';
            });
            rect.addEventListener('mousemove', e => {
                tip.style.left = (e.clientX + 12) + 'px'; tip.style.top = (e.clientY - 34) + 'px';
            });
            rect.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
            svg.appendChild(rect);
        }
    }

    const container = document.getElementById('day-hour-heatmap');
    container.innerHTML = '';
    container.appendChild(svg);
}

// ── HR zone breakdown ─────────────────────────────────────────────────────────

const ZONE_COLORS = ['#94a3b8', '#4ade80', '#facc15', '#fb923c', '#ef4444'];
const ZONE_NAMES  = ['Z1 Recovery', 'Z2 Aerobic', 'Z3 Tempo', 'Z4 Threshold', 'Z5 VO₂ Max'];
const ZONE_UPPER  = [0.60, 0.70, 0.80, 0.90, Infinity];

function renderHRZones(activities) {
    const counts = [0, 0, 0, 0, 0];
    let withHR = 0;
    for (const a of activities) {
        if (!a.AverageHeartrate) continue;
        withHR++;
        const pct  = a.AverageHeartrate / maxHR;
        const zone = ZONE_UPPER.findIndex(upper => pct < upper);
        counts[zone >= 0 ? zone : 4]++;
    }

    const container = document.getElementById('hr-zones-chart');
    if (withHR === 0) {
        if (hrZoneChart) { hrZoneChart.destroy(); hrZoneChart = null; }
        container.innerHTML = '<p style="color:var(--muted);font-size:.875rem;padding:.5rem 0">No heart rate data in selected activities.</p>';
        return;
    }

    const options = {
        chart: {
            type: 'bar', height: 220,
            fontFamily: 'Inter, system-ui, sans-serif',
            toolbar: { show: false }, animations: { enabled: false }, background: 'transparent',
        },
        plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '55%', distributed: true } },
        colors: ZONE_COLORS,
        series: [{ name: 'Activities', data: counts }],
        xaxis: {
            categories: ZONE_NAMES,
            labels: { style: { colors: '#94a3b8', fontSize: '11px' } },
            axisBorder: { show: false }, axisTicks: { show: false },
        },
        yaxis: { labels: { style: { colors: '#64748b', fontSize: '11px' } } },
        grid: {
            borderColor: 'rgba(15,17,23,.06)', strokeDashArray: 4,
            xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } },
        },
        dataLabels: { enabled: false },
        tooltip: { theme: 'dark', y: { formatter: v => v + ' activit' + (v === 1 ? 'y' : 'ies') } },
        legend: { show: false },
    };

    if (hrZoneChart) { hrZoneChart.destroy(); hrZoneChart = null; }
    hrZoneChart = new ApexCharts(container, options);
    hrZoneChart.render();
}

// ── chart ─────────────────────────────────────────────────────────────────────

const xAxisStyle = {
    style:      { colors: '#94a3b8', fontSize: '11px' },
    axisBorder: { show: false },
    axisTicks:  { show: false },
};

const BASE_CHART_OPTIONS = {
    chart: {
        type: 'bar', height: 280,
        fontFamily: 'Inter, system-ui, sans-serif',
        toolbar: { show: false }, animations: { enabled: false }, background: 'transparent',
    },
    plotOptions: { bar: { borderRadius: 5, columnWidth: '55%' } },
    colors:      ['#FC4C02', '#cbd5e1'],
    stroke:      { width: [0, 2], curve: 'smooth' },
    legend:      { show: false },
    dataLabels:  { enabled: false },
    grid:        { borderColor: 'rgba(15,17,23,.06)', strokeDashArray: 4, xaxis: { lines: { show: false } } },
    yaxis:       { labels: { formatter: v => v.toFixed(0) + ' km', style: { colors: '#94a3b8', fontSize: '11px' } } },
    tooltip:     { enabledOnSeries: [0], y: { formatter: v => v.toFixed(1) + ' km' }, theme: 'dark' },
};

function groupByGranularity(activities, granularity) {
    const groups = {};
    for (const a of activities) {
        const key = granularity === 'day'  ? a.StartDateLocal.slice(0, 10)
                  : granularity === 'week' ? isoWeekStart(a.StartDateLocal.slice(0, 10))
                  :                          a.StartDateLocal.slice(0, 7);
        groups[key] = (groups[key] || 0) + a.Distance / 1000;
    }
    return groups;
}

// Options when a prior period series is shown alongside the current period.
// The prior series starts hidden — click the legend to toggle it on.
function withPriorSeries(base, currentName, priorName, distanceData, priorData, xaxis) {
    return {
        ...base,
        chart: {
            ...base.chart,
            events: {
                mounted: (ctx) => ctx.hideSeries(priorName),
            },
        },
        series: [
            { name: currentName, type: 'bar', data: distanceData },
            { name: priorName,   type: 'bar', data: priorData },
        ],
        colors:      ['#FC4C02', '#94a3b8'],
        stroke:      { width: [0, 0] },
        plotOptions: { bar: { borderRadius: 5, columnWidth: '72%' } },
        legend:      { show: true, labels: { colors: ['#94a3b8', '#94a3b8'] }, fontSize: '12px', fontFamily: 'Inter, system-ui, sans-serif' },
        tooltip:     { y: { formatter: v => v.toFixed(1) + ' km' }, theme: 'dark' },
        xaxis,
    };
}

function buildChartOptions(activities, priorActivities, dateFrom, dateTo, period) {
    if (period === 'week') {
        const weekStart = new Date(dateFrom + 'T00:00:00');
        const groups      = groupByGranularity(activities, 'day');
        const priorGroups = priorActivities ? groupByGranularity(priorActivities, 'day') : null;
        const categories = [], distanceData = [], priorData = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
            categories.push(d.toLocaleString('default', { weekday: 'short' }));
            distanceData.push(+(groups[localDateStr(d)] || 0).toFixed(1));
            if (priorGroups) {
                const pd = new Date(d); pd.setDate(pd.getDate() - 7);
                priorData.push(+(priorGroups[localDateStr(pd)] || 0).toFixed(1));
            }
        }
        const xaxis = { categories, ...xAxisStyle };
        if (priorGroups) {
            return withPriorSeries(BASE_CHART_OPTIONS, 'This week', 'Last week', distanceData, priorData, xaxis);
        }
        return { ...BASE_CHART_OPTIONS, series: [{ name: 'Distance', type: 'bar', data: distanceData }, { name: 'Trend', type: 'line', data: movingAvg(distanceData, 3) }], xaxis };
    }

    if (period === 'month') {
        const start = new Date(dateFrom + 'T00:00:00');
        const end   = new Date(dateTo   + 'T00:00:00');
        const groups      = groupByGranularity(activities, 'day');
        const priorGroups = priorActivities ? groupByGranularity(priorActivities, 'day') : null;
        const categories = [], distanceData = [], priorData = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            categories.push(d.getDate());
            distanceData.push(+(groups[localDateStr(d)] || 0).toFixed(1));
            if (priorGroups) {
                const pd = new Date(d); pd.setMonth(pd.getMonth() - 1);
                priorData.push(+(priorGroups[localDateStr(pd)] || 0).toFixed(1));
            }
        }
        const xaxis = { categories, tickAmount: 10, ...xAxisStyle };
        if (priorGroups) {
            const thisMonth  = new Date(dateFrom + 'T00:00:00');
            const priorMonth = new Date(dateFrom + 'T00:00:00'); priorMonth.setMonth(priorMonth.getMonth() - 1);
            const fmt = d => d.toLocaleString('default', { month: 'long' });
            return withPriorSeries(BASE_CHART_OPTIONS, fmt(thisMonth), fmt(priorMonth), distanceData, priorData, xaxis);
        }
        return { ...BASE_CHART_OPTIONS, series: [{ name: 'Distance', type: 'bar', data: distanceData }, { name: 'Trend', type: 'line', data: movingAvg(distanceData, 3) }], xaxis };
    }

    if (period === 'year') {
        const [fromYear]        = dateFrom.split('-').map(Number);
        const [, toMonth]       = dateTo.split('-').map(Number);
        const groups      = groupByGranularity(activities, 'month');
        const priorGroups = priorActivities ? groupByGranularity(priorActivities, 'month') : null;
        const categories = [], distanceData = [], priorData = [];
        const monthCount = toMonth;
        for (let m = 1; m <= monthCount; m++) {
            const monthKey = String(m).padStart(2, '0');
            categories.push(new Date(fromYear, m - 1, 1).toLocaleString('default', { month: 'short' }));
            distanceData.push(+(groups[`${fromYear}-${monthKey}`] || 0).toFixed(1));
            if (priorGroups) {
                priorData.push(+(priorGroups[`${fromYear - 1}-${monthKey}`] || 0).toFixed(1));
            }
        }
        const xaxis = { categories, ...xAxisStyle };
        if (priorGroups) {
            return withPriorSeries(BASE_CHART_OPTIONS, String(fromYear), String(fromYear - 1), distanceData, priorData, xaxis);
        }
        return { ...BASE_CHART_OPTIONS, series: [{ name: 'Distance', type: 'bar', data: distanceData }, { name: 'Trend', type: 'line', data: movingAvg(distanceData, 3) }], xaxis };
    }

    // Custom / all-time — datetime axis, no prior year overlay.
    const spanDays   = dateFrom ? (new Date(dateTo) - new Date(dateFrom)) / 86400000 : Infinity;
    const granularity = spanDays <= 31 ? 'day' : spanDays <= 365 ? 'week' : 'month';
    const groups      = groupByGranularity(activities, granularity);
    const barData     = Object.keys(groups).sort().map(key => ({
        x: new Date((granularity === 'month' ? key + '-01' : key) + 'T00:00:00').getTime(),
        y: +groups[key].toFixed(1),
    }));
    return {
        ...BASE_CHART_OPTIONS,
        series: [{ name: 'Distance', type: 'bar', data: barData }, { name: 'Trend', type: 'line', data: movingAvg(barData, 3) }],
        xaxis: {
            type: 'datetime',
            labels: { format: granularity === 'month' ? 'MMM yy' : 'dd MMM', ...xAxisStyle.style },
            ...xAxisStyle,
        },
        tooltip: { ...BASE_CHART_OPTIONS.tooltip, x: { format: granularity === 'month' ? 'MMM yyyy' : 'dd MMM yyyy' } },
    };
}

function updateChart(activities, priorActivities, dateFrom, dateTo, period) {
    const activeBtn = document.querySelector('.period-btn.active');
    document.getElementById('chart-label').textContent =
        'Distance — ' + (activeBtn ? activeBtn.textContent : 'Custom');

    const options = buildChartOptions(activities, priorActivities, dateFrom, dateTo, period);
    if (apexChart) { apexChart.destroy(); apexChart = null; }
    apexChart = new ApexCharts(document.getElementById('statsChart'), options);
    apexChart.render();
}

// ── period buttons ────────────────────────────────────────────────────────────

function setActivePeriod(period) {
    document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
    if (!period) return;
    document.querySelector(`[data-period="${period}"]`).classList.add('active');
    const { from, to } = periodRange(period);
    document.getElementById('date-from').value = from || '';
    document.getElementById('date-to').value   = to;
}

// ── render ────────────────────────────────────────────────────────────────────

function render() {
    const dateFrom = document.getElementById('date-from').value || null;
    const dateTo   = document.getElementById('date-to').value   || null;
    const period   = location.hash.slice(1) || null;

    const activities      = applyFilters();
    const priorActivities = (period && period !== 'all') ? priorPeriodFilter(dateFrom, dateTo, period) : null;
    const priorLabel      = period === 'week' ? 'vs last week'
                          : period === 'month' ? 'vs last month'
                          : 'vs last year';

    updateSummaryCards(activities, priorActivities, priorLabel);
    updateSportTable(activities);
    updateChart(activities, priorActivities, dateFrom, dateTo, period);
    renderDayHourHeatmap(activities);
    renderHRZones(activities);
}

// ── event wiring ──────────────────────────────────────────────────────────────

document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        location.hash = btn.dataset.period;
        setActivePeriod(btn.dataset.period);
        render();
    });
});

['date-from', 'date-to'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
        history.replaceState(null, '', location.pathname);
        setActivePeriod(null);
        render();
    });
});

document.getElementById('sport-filter').addEventListener('change', render);

// ── init ──────────────────────────────────────────────────────────────────────

(async function init() {
    const [activitiesResp, settingsResp] = await Promise.all([
        fetch('/api/activities?limit=10000'),
        fetch('/api/settings'),
    ]);
    if (!activitiesResp.ok) return;
    allActivities = await activitiesResp.json();

    if (settingsResp.ok) {
        const settings = await settingsResp.json();
        maxHR = settings.max_hr || 190;
        document.getElementById('max-hr-input').value = maxHR;
    }

    const sports = [...new Set(allActivities.map(a => a.SportType))].sort();
    const select = document.getElementById('sport-filter');
    for (const sport of sports) {
        const option = document.createElement('option');
        option.value = sport; option.textContent = sport;
        select.appendChild(option);
    }

    document.getElementById('max-hr-input').addEventListener('change', async e => {
        const val = parseInt(e.target.value, 10);
        if (val < 100 || val > 250) return;
        maxHR = val;
        await fetch('/api/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ max_hr: val }),
        });
        renderHRZones(applyFilters());
    });

    setActivePeriod(location.hash.slice(1) || 'week');
    render();
})();
