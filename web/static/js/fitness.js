(async function () {
    const resp = await fetch('/api/activities?limit=10000');
    if (!resp.ok) return;
    const activities = await resp.json();

    if (!activities || activities.length === 0) {
        document.getElementById('no-data').style.display = 'block';
        return;
    }

    document.getElementById('fitness-content').style.display = 'flex';

    // ── Build daily load map ────────────────────────────────────────────────

    const dailyLoad = {};
    for (const a of activities) {
        const date = a.StartDateLocal.slice(0, 10);
        const load = activityLoad(a);
        dailyLoad[date] = (dailyLoad[date] || 0) + load;
    }

    // ── EWMA over every calendar day from earliest activity to today ────────

    const K42 = Math.exp(-1 / 42);
    const K7  = Math.exp(-1 / 7);

    const sortedDates = Object.keys(dailyLoad).sort();
    const startDate   = new Date(sortedDates[0] + 'T00:00:00');
    const today       = new Date();
    today.setHours(0, 0, 0, 0);

    const series = []; // { date, ctl, atl, tsb }
    let ctl = 0, atl = 0;

    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
        const dateStr = localDateStr(d);
        const load    = dailyLoad[dateStr] || 0;
        ctl = ctl * K42 + load * (1 - K42);
        atl = atl * K7  + load * (1 - K7);
        series.push({ date: dateStr, ctl: +ctl.toFixed(1), atl: +atl.toFixed(1), tsb: +(ctl - atl).toFixed(1) });
    }

    // ── Stat cards ─────────────────────────────────────────────────────────

    const latest = series[series.length - 1];
    document.getElementById('ctl-value').textContent = latest.ctl.toFixed(0);
    document.getElementById('atl-value').textContent = latest.atl.toFixed(0);
    document.getElementById('tsb-value').textContent = (latest.tsb >= 0 ? '+' : '') + latest.tsb.toFixed(0);

    const { label: zoneLabel, cls: zoneCls } = tsbZone(latest.tsb);
    document.getElementById('tsb-zone').textContent = zoneLabel;
    document.getElementById('tsb-hero').classList.add(zoneCls);

    // ── Race window forecast ────────────────────────────────────────────────
    // Project CTL/ATL 28 days forward assuming complete rest (pure decay)
    // and find when TSB first enters the +10…+25 "race-ready" window.

    (function renderForecast() {
        const callout = document.getElementById('forecast-callout');
        if (!callout) return;

        let fCTL = latest.ctl, fATL = latest.atl;
        let peakDate = null, peakTSB = -Infinity;

        for (let i = 1; i <= 28; i++) {
            fCTL *= K42;
            fATL *= K7;
            const fTSB = fCTL - fATL;
            if (fTSB > peakTSB) { peakTSB = fTSB; peakDate = i; }
        }

        if (peakDate === null || peakTSB < 5) { callout.style.display = 'none'; return; }

        const raceDay = new Date(today);
        raceDay.setDate(today.getDate() + peakDate);
        const dayLabel = raceDay.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

        const inWindow = peakTSB >= 10 && peakTSB <= 25;
        const msg = inWindow
            ? `If you rest now, your form peaks around <strong>${dayLabel}</strong> — ideal race window (+${peakTSB.toFixed(0)}).`
            : `If you rest now, form peaks around <strong>${dayLabel}</strong> at +${peakTSB.toFixed(0)}.${peakTSB > 25 ? ' More training first would boost fitness before tapering.' : ''}`;

        callout.style.display = 'flex';
        callout.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>${msg}</span>
        `;
    })();

    // ── Period filter ───────────────────────────────────────────────────────

    let activePeriod = '1y';
    document.querySelectorAll('.period-btn[data-period]').forEach(btn => {
        btn.addEventListener('click', () => {
            activePeriod = btn.dataset.period;
            document.querySelectorAll('.period-btn[data-period]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderChart(series, activePeriod);
        });
    });

    renderChart(series, activePeriod);
})();

// ── Training load proxy ─────────────────────────────────────────────────────

function activityLoad(a) {
    if (a.SufferScore > 0)  return a.SufferScore;
    if (a.Kilojoules > 0)   return a.Kilojoules / 10;
    return (a.MovingTime / 3600) * 50;
}

// ── TSB zone ────────────────────────────────────────────────────────────────

function tsbZone(tsb) {
    if (tsb < -10) return { label: 'Overreaching',  cls: 'tsb-overreach' };
    if (tsb <   0) return { label: 'Fatigued',      cls: 'tsb-fatigued'  };
    if (tsb <= 10) return { label: 'Fresh',         cls: 'tsb-fresh'     };
    if (tsb <= 25) return { label: 'Race-ready',    cls: 'tsb-peak'      };
    return              { label: 'Detrained',       cls: 'tsb-detrained' };
}

// ── Chart ───────────────────────────────────────────────────────────────────

let chartInstance = null;

function renderChart(series, period) {
    const cutoff = periodCutoff(period);
    const slice  = cutoff ? series.filter(p => p.date >= cutoff) : series;

    // Downsample for very long series (keep every Nth point) to keep chart fast
    const maxPoints = 365;
    const step      = Math.max(1, Math.floor(slice.length / maxPoints));
    const pts       = slice.filter((_, i) => i % step === 0 || i === slice.length - 1);

    const ctlData = pts.map(p => ({ x: p.date, y: p.ctl }));
    const atlData = pts.map(p => ({ x: p.date, y: p.atl }));
    const tsbData = pts.map(p => ({ x: p.date, y: p.tsb }));

    const options = {
        chart: {
            type: 'line',
            height: 300,
            fontFamily: 'Inter, system-ui, sans-serif',
            toolbar: { show: false },
            animations: { enabled: false },
            background: 'transparent',
        },
        series: [
            { name: 'Fitness', data: ctlData },
            { name: 'Fatigue', data: atlData },
            { name: 'Form',    data: tsbData },
        ],
        colors: ['#3b82f6', '#ef4444', '#22c55e'],
        stroke: { width: [2, 2, 2], curve: 'smooth' },
        fill: {
            type: ['solid', 'solid', 'gradient'],
            gradient: {
                type: 'vertical',
                colorStops: [
                    { offset: 0,   color: '#22c55e', opacity: 0.25 },
                    { offset: 50,  color: '#22c55e', opacity: 0.05 },
                    { offset: 50,  color: '#ef4444', opacity: 0.05 },
                    { offset: 100, color: '#ef4444', opacity: 0.15 },
                ],
            },
        },
        xaxis: {
            type: 'datetime',
            labels: { style: { colors: '#94a3b8', fontSize: '11px' }, datetimeUTC: false },
            axisBorder: { show: false },
            axisTicks:  { show: false },
        },
        yaxis: {
            labels: { formatter: v => v.toFixed(0), style: { colors: '#94a3b8', fontSize: '11px' } },
        },
        tooltip: {
            theme: 'dark',
            x: { format: 'd MMM yyyy' },
            y: { formatter: v => v.toFixed(1) },
            shared: true,
            intersect: false,
        },
        legend: { show: false },
        dataLabels: { enabled: false },
        grid: {
            borderColor: 'rgba(15,17,23,.06)',
            strokeDashArray: 4,
            xaxis: { lines: { show: false } },
        },
        annotations: {
            yaxis: [{ y: 0, borderColor: 'rgba(15,17,23,.15)', strokeDashArray: 0, borderWidth: 1 }],
        },
    };

    if (chartInstance) {
        chartInstance.updateOptions(options, true, false);
    } else {
        chartInstance = new ApexCharts(document.getElementById('fitnessChart'), options);
        chartInstance.render();
    }
}

function periodCutoff(period) {
    const today = new Date();
    if (period === '3m')  { const d = new Date(today); d.setMonth(d.getMonth() - 3);  return localDateStr(d); }
    if (period === '6m')  { const d = new Date(today); d.setMonth(d.getMonth() - 6);  return localDateStr(d); }
    if (period === '1y')  { const d = new Date(today); d.setFullYear(d.getFullYear() - 1); return localDateStr(d); }
    return null;
}
