async function renderWeeklyChart() {
    const resp = await fetch('/api/activities?limit=10000');
    if (!resp.ok) return;
    const activities = await resp.json();

    // Group total km per ISO week.
    const kmByWeek = {};
    for (const activity of activities) {
        const weekStart = isoWeekStart(activity.StartDateLocal.slice(0, 10));
        kmByWeek[weekStart] = (kmByWeek[weekStart] || 0) + activity.Distance / 1000;
    }

    // Build the last 16 weeks ending this Monday.
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
        },
        series: [
            { name: 'Distance', type: 'bar',  data: distanceData },
            { name: 'Trend',    type: 'line', data: movingAvg(distanceData, 3) },
        ],
        xaxis: {
            categories,
            tickAmount: 8,
            labels: { rotate: -30, style: { colors: '#9ca3af', fontSize: '11px' } },
            axisBorder: { show: false },
            axisTicks:  { show: false },
        },
        yaxis: {
            labels: { formatter: v => v.toFixed(0) + ' km', style: { colors: '#9ca3af', fontSize: '12px' } },
        },
        colors:      ['#FC4C02', '#9ca3af'],
        stroke:      { width: [0, 2], curve: 'smooth' },
        legend:      { show: false },
        tooltip:     { enabledOnSeries: [0], y: { formatter: v => v.toFixed(1) + ' km' } },
        plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
        dataLabels:  { enabled: false },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 3, xaxis: { lines: { show: false } } },
    }).render();
}

renderWeeklyChart();
