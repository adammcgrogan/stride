'use strict';

let splitsData  = [];
let splitsChart = null;

// ── helpers ───────────────────────────────────────────────────────────────────

function currentUnit() {
    return getUnits() === 'mi' ? 'standard' : 'metric';
}

function unitDist() {
    return currentUnit() === 'standard' ? 1609.344 : 1000;
}

function unitLabel() {
    return currentUnit() === 'standard' ? '/mi' : '/km';
}

function unitSpeedLabel() {
    return currentUnit() === 'standard' ? 'mph' : 'km/h';
}

function toSpeed(mps) {
    // m/s → km/h or mph
    return currentUnit() === 'standard' ? mps * 2.23694 : mps * 3.6;
}

function fmtPaceSecs(mps) {
    if (!mps) return '—';
    const secs = unitDist() / mps;
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtSplitDist(meters) {
    return currentUnit() === 'standard'
        ? (meters / 1609.344).toFixed(2) + ' mi'
        : (meters / 1000).toFixed(2) + ' km';
}

function fmtMMSS(totalSecs) {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function elevArrow(diff) {
    if (diff > 1)  return `<span class="elev-up">▲ ${Math.round(diff)}m</span>`;
    if (diff < -1) return `<span class="elev-down">▼ ${Math.abs(Math.round(diff))}m</span>`;
    return `<span style="opacity:.4">—</span>`;
}

// ── chart ─────────────────────────────────────────────────────────────────────

function renderSplitsChart(splits) {
    if (splitsChart) { splitsChart.destroy(); splitsChart = null; }

    const isDark    = document.documentElement.dataset.theme === 'dark';
    const textColor = isDark ? '#8b97aa' : '#64748b';
    const gridColor = isDark ? 'rgba(255,255,255,.05)' : 'rgba(15,17,23,.05)';

    const labels    = splits.map(s => String(s.SplitIndex));
    const speedData = splits.map(s => s.AvgSpeed > 0 ? +toSpeed(s.AvgSpeed).toFixed(2) : 0);
    const elevData  = splits.map(s => +s.ElevDiff.toFixed(1));
    const hasElev   = elevData.some(v => Math.abs(v) > 0.5);
    const sl        = unitSpeedLabel();

    const series = [{ name: sl, type: 'column', data: speedData }];
    if (hasElev) series.push({ name: 'Elevation (m)', type: 'line', data: elevData });

    const yaxis = [{
        seriesName: sl,
        labels: {
            style: { colors: textColor, fontSize: '11px' },
            formatter: v => v.toFixed(1),
        },
        title: { text: sl, style: { color: textColor, fontSize: '11px', fontWeight: 500 } },
    }];
    if (hasElev) {
        yaxis.push({
            opposite: true,
            seriesName: 'Elevation (m)',
            labels: {
                style: { colors: textColor, fontSize: '11px' },
                formatter: v => `${Math.round(v)}m`,
            },
            title: { text: 'Elevation', style: { color: textColor, fontSize: '11px', fontWeight: 500 } },
        });
    }

    const strokeWidths = hasElev ? [0, 2] : [0];
    const markerSizes  = hasElev ? [0, 3] : [0];
    const colors       = hasElev ? ['#FC4C02', '#60a5fa'] : ['#FC4C02'];

    try {
        splitsChart = new ApexCharts(document.getElementById('splits-chart'), {
            chart: {
                type: 'line',
                height: 220,
                toolbar: { show: false },
                background: 'transparent',
                animations: { enabled: false },
            },
            series,
            xaxis: {
                categories: labels,
                labels: { style: { colors: textColor, fontSize: '11px' } },
                axisBorder: { show: false },
                axisTicks:  { show: false },
                title: {
                    text: currentUnit() === 'standard' ? 'Mile' : 'Kilometre',
                    style: { color: textColor, fontSize: '11px' },
                },
            },
            yaxis,
            stroke:  { width: strokeWidths, curve: 'smooth' },
            colors,
            markers: { size: markerSizes, strokeWidth: 0 },
            plotOptions: { bar: { columnWidth: '60%', borderRadius: 3 } },
            dataLabels: { enabled: false },
            grid: { borderColor: gridColor, strokeDashArray: 4 },
            legend: { show: hasElev, position: 'top', labels: { colors: textColor } },
            tooltip: {
                theme: isDark ? 'dark' : 'light',
                shared: true,
                y: [
                    { formatter: v => `${v.toFixed(1)} ${sl}` },
                    ...(hasElev ? [{ formatter: v => `${Math.round(v)} m` }] : []),
                ],
            },
        });
        splitsChart.render();
    } catch (e) {
        console.error('splits chart error:', e);
    }
}

// ── table ─────────────────────────────────────────────────────────────────────

function renderSplitsTable(splits) {
    const hasHR = splits.some(s => s.AvgHR > 0);
    const ul    = unitLabel();

    const avgSpeed = splits.filter(s => s.AvgSpeed > 0).reduce((a, s) => a + s.AvgSpeed, 0) /
                     (splits.filter(s => s.AvgSpeed > 0).length || 1);

    const thead = `<thead><tr>
        <th>#</th><th>Distance</th><th>Time</th><th>Pace</th><th>Elev</th>
        ${hasHR ? '<th>Avg HR</th>' : ''}
    </tr></thead>`;

    const rows = splits.map(s => {
        const paceSec    = s.AvgSpeed > 0 ? unitDist() / s.AvgSpeed : 0;
        const avgPaceSec = avgSpeed > 0    ? unitDist() / avgSpeed   : 0;
        const cls = paceSec > 0 && avgPaceSec > 0
            ? (paceSec < avgPaceSec * 0.98 ? 'split-fast' : paceSec > avgPaceSec * 1.02 ? 'split-slow' : '')
            : '';
        return `<tr>
            <td class="split-num">${s.SplitIndex}</td>
            <td>${fmtSplitDist(s.Distance)}</td>
            <td>${fmtMMSS(s.MovingTime)}</td>
            <td class="${cls}">${fmtPaceSecs(s.AvgSpeed)} ${ul}</td>
            <td>${elevArrow(s.ElevDiff)}</td>
            ${hasHR ? `<td>${s.AvgHR > 0 ? Math.round(s.AvgHR) + ' bpm' : '—'}</td>` : ''}
        </tr>`;
    }).join('');

    document.getElementById('splits-table-wrap').innerHTML =
        `<table class="pr-table splits-table">${thead}<tbody>${rows}</tbody></table>`;
}

// ── public render (called by navbar units toggle) ─────────────────────────────

function render() {
    const splits = splitsData.filter(s => s.Unit === currentUnit());
    if (!splits.length) return;
    renderSplitsChart(splits);
    renderSplitsTable(splits);
}

// ── init ──────────────────────────────────────────────────────────────────────

(async function init() {
    const resp = await fetch(`/api/activities/${ACTIVITY_ID}/splits`);
    if (!resp.ok) return;
    const raw = await resp.json();
    splitsData = raw || [];

    const splits = splitsData.filter(s => s.Unit === currentUnit());
    if (!splits.length) return;

    document.getElementById('splits-section').style.display = '';
    renderSplitsChart(splits);
    renderSplitsTable(splits);
})();
