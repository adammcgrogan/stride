let allActivities = [];
let apexChart = null;

// ── filter ────────────────────────────────────────────────────────────────────

function applyFilters() {
    const dateFrom = document.getElementById('date-from').value;
    const dateTo   = document.getElementById('date-to').value;
    const sport    = document.getElementById('sport-filter').value;

    return allActivities.filter(activity => {
        const date = activity.StartDateLocal.slice(0, 10);
        if (dateFrom && date < dateFrom)           return false;
        if (dateTo   && date > dateTo)             return false;
        if (sport    && activity.SportType !== sport) return false;
        return true;
    });
}

// ── stat cards ────────────────────────────────────────────────────────────────

function updateSummaryCards(activities) {
    const count     = activities.length;
    const totalDist = activities.reduce((sum, a) => sum + a.Distance, 0);
    const totalElev = activities.reduce((sum, a) => sum + a.TotalElevationGain, 0);
    const totalTime = activities.reduce((sum, a) => sum + a.MovingTime, 0);

    document.getElementById('s-count').textContent    = count;
    document.getElementById('s-distance').innerHTML   = (totalDist / 1000).toFixed(1) + ' <small>km</small>';
    document.getElementById('s-elevation').innerHTML  = Math.round(totalElev) + ' <small>m</small>';
    document.getElementById('s-time').textContent     = fmtTime(totalTime);
    document.getElementById('s-avg').innerHTML        = count
        ? (totalDist / count / 1000).toFixed(1) + ' <small>km</small>'
        : '—';
}

// ── sport table ───────────────────────────────────────────────────────────────

function updateSportTable(activities) {
    const bySport = {};
    for (const activity of activities) {
        if (!bySport[activity.SportType]) {
            bySport[activity.SportType] = { count: 0, distance: 0, time: 0 };
        }
        bySport[activity.SportType].count++;
        bySport[activity.SportType].distance += activity.Distance;
        bySport[activity.SportType].time     += activity.MovingTime;
    }

    const rows = Object.entries(bySport).sort((a, b) => b[1].count - a[1].count);
    document.querySelector('#sport-table tbody').innerHTML =
        rows.map(([sport, stats]) =>
            `<tr>
                <td>${sport}</td>
                <td>${stats.count}</td>
                <td>${fmtKm(stats.distance)}</td>
                <td>${fmtTime(stats.time)}</td>
            </tr>`
        ).join('') || '<tr><td colspan="4">No activities</td></tr>';
}

// ── chart ─────────────────────────────────────────────────────────────────────

const xAxisStyle = {
    style: { colors: '#9ca3af', fontSize: '12px' },
    axisBorder: { show: false },
    axisTicks:  { show: false },
};

const BASE_CHART_OPTIONS = {
    chart: {
        type: 'bar',
        height: 280,
        fontFamily: 'Inter, system-ui, sans-serif',
        toolbar: { show: false },
        animations: { enabled: false },
    },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
    colors:      ['#FC4C02', '#9ca3af'],
    stroke:      { width: [0, 2], curve: 'smooth' },
    legend:      { show: false },
    dataLabels:  { enabled: false },
    grid:        { borderColor: '#e5e7eb', strokeDashArray: 3, xaxis: { lines: { show: false } } },
    yaxis:       { labels: { formatter: v => v.toFixed(0) + ' km', style: { colors: '#9ca3af', fontSize: '12px' } } },
    tooltip:     { enabledOnSeries: [0], y: { formatter: v => v.toFixed(1) + ' km' } },
};

// Groups activities into a {key → totalKm} map at the given granularity.
function groupByGranularity(activities, granularity) {
    const groups = {};
    for (const activity of activities) {
        const key = granularity === 'day'  ? activity.StartDateLocal.slice(0, 10)
                  : granularity === 'week' ? isoWeekStart(activity.StartDateLocal.slice(0, 10))
                  :                          activity.StartDateLocal.slice(0, 7); // month
        groups[key] = (groups[key] || 0) + activity.Distance / 1000;
    }
    return groups;
}

// Wraps distance and trend data into the series format ApexCharts expects.
function buildSeries(distanceData) {
    return [
        { name: 'Distance', type: 'bar',  data: distanceData },
        { name: 'Trend',    type: 'line', data: movingAvg(distanceData, 3) },
    ];
}

function buildChartOptions(activities, dateFrom, dateTo, period) {
    if (period === 'week') {
        const weekStart = new Date(dateFrom + 'T00:00:00');
        const groups    = groupByGranularity(activities, 'day');
        const categories = [], distanceData = [];
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + dayOffset);
            categories.push(d.toLocaleString('default', { weekday: 'short' }));
            distanceData.push(+(groups[localDateStr(d)] || 0).toFixed(1));
        }
        return { ...BASE_CHART_OPTIONS, series: buildSeries(distanceData), xaxis: { categories, ...xAxisStyle } };
    }

    if (period === 'month') {
        const start  = new Date(dateFrom + 'T00:00:00');
        const end    = new Date(dateTo   + 'T00:00:00');
        const groups = groupByGranularity(activities, 'day');
        const categories = [], distanceData = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            categories.push(d.getDate());
            distanceData.push(+(groups[localDateStr(d)] || 0).toFixed(1));
        }
        return { ...BASE_CHART_OPTIONS, series: buildSeries(distanceData), xaxis: { categories, tickAmount: 10, ...xAxisStyle } };
    }

    if (period === 'year') {
        const [fromYear]         = dateFrom.split('-').map(Number);
        const [toYear, toMonth]  = dateTo.split('-').map(Number);
        const groups             = groupByGranularity(activities, 'month');
        const categories = [], distanceData = [];
        const monthCount = fromYear === toYear ? toMonth : 12;
        for (let month = 1; month <= monthCount; month++) {
            categories.push(new Date(fromYear, month - 1, 1).toLocaleString('default', { month: 'short' }));
            distanceData.push(+(groups[`${fromYear}-${String(month).padStart(2, '0')}`] || 0).toFixed(1));
        }
        return { ...BASE_CHART_OPTIONS, series: buildSeries(distanceData), xaxis: { categories, ...xAxisStyle } };
    }

    // Custom or "all time" — use a datetime axis; pick granularity based on span length.
    const spanDays  = dateFrom ? (new Date(dateTo) - new Date(dateFrom)) / 86400000 : Infinity;
    const granularity = spanDays <= 31 ? 'day' : spanDays <= 365 ? 'week' : 'month';
    const groups      = groupByGranularity(activities, granularity);
    const barData     = Object.keys(groups).sort().map(key => ({
        x: new Date((granularity === 'month' ? key + '-01' : key) + 'T00:00:00').getTime(),
        y: +groups[key].toFixed(1),
    }));
    return {
        ...BASE_CHART_OPTIONS,
        series: buildSeries(barData),
        xaxis: {
            type: 'datetime',
            labels: { format: granularity === 'month' ? 'MMM yy' : 'dd MMM', ...xAxisStyle.style },
            ...xAxisStyle,
        },
        tooltip: {
            ...BASE_CHART_OPTIONS.tooltip,
            x: { format: granularity === 'month' ? 'MMM yyyy' : 'dd MMM yyyy' },
        },
    };
}

function updateChart(activities, dateFrom, dateTo, period) {
    const activeBtn = document.querySelector('.period-btn.active');
    document.getElementById('chart-label').textContent =
        'Distance — ' + (activeBtn ? activeBtn.textContent : 'Custom');

    const options = buildChartOptions(activities, dateFrom, dateTo, period);
    if (apexChart) { apexChart.destroy(); apexChart = null; }
    apexChart = new ApexCharts(document.getElementById('statsChart'), options);
    apexChart.render();
}

// ── render ────────────────────────────────────────────────────────────────────

function currentPeriod() {
    const btn = document.querySelector('.period-btn.active');
    return btn ? btn.dataset.period : null;
}

function render() {
    const dateFrom  = document.getElementById('date-from').value || null;
    const dateTo    = document.getElementById('date-to').value   || null;
    const activities = applyFilters();
    updateSummaryCards(activities);
    updateSportTable(activities);
    updateChart(activities, dateFrom, dateTo, currentPeriod());
}

// ── event wiring ─────────────────────────────────────────────────────────────

function setActivePeriod(period) {
    document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
    if (!period) return;
    document.querySelector(`[data-period="${period}"]`).classList.add('active');
    const { from, to } = periodRange(period);
    document.getElementById('date-from').value = from || '';
    document.getElementById('date-to').value   = to;
}

document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => { setActivePeriod(btn.dataset.period); render(); });
});

['date-from', 'date-to'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
        document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
        render();
    });
});

document.getElementById('sport-filter').addEventListener('change', render);

// ── init ──────────────────────────────────────────────────────────────────────

(async function init() {
    const resp = await fetch('/api/activities?limit=10000');
    if (!resp.ok) return;
    allActivities = await resp.json();

    const sports = [...new Set(allActivities.map(a => a.SportType))].sort();
    const select = document.getElementById('sport-filter');
    for (const sport of sports) {
        const option = document.createElement('option');
        option.value = sport;
        option.textContent = sport;
        select.appendChild(option);
    }

    setActivePeriod('month');
    render();
})();
