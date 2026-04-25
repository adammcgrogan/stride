(async function renderHeatmap() {
    const container = document.getElementById('heatmap-svg');
    if (!container) return;

    const resp = await fetch('/api/activities?limit=10000');
    if (!resp.ok) return;
    const activities = await resp.json() || [];

    // Aggregate by local date
    const byDate = {};
    for (const a of activities) {
        const date = a.StartDateLocal.slice(0, 10);
        if (!byDate[date]) byDate[date] = { count: 0, distance: 0 };
        byDate[date].count++;
        byDate[date].distance += a.Distance;
    }

    // Quartile-based thresholds so the scale adapts to each athlete's volume
    const distances = Object.values(byDate).map(d => d.distance).sort((a, b) => a - b);
    function nthPct(q) {
        if (!distances.length) return 0;
        return distances[Math.floor(distances.length * q)] || 0;
    }
    const [t1, t2, t3] = [nthPct(0.25), nthPct(0.5), nthPct(0.75)];
    function level(dist) {
        if (!dist) return 0;
        if (dist <= t1) return 1;
        if (dist <= t2) return 2;
        if (dist <= t3) return 3;
        return 4;
    }

    // Grid: 53 cols (weeks) × 7 rows (Mon–Sun)
    const CELL = 11, GAP = 2, STEP = CELL + GAP;
    const LEFT = 28, TOP = 20;
    const WEEKS = 53, DAYS = 7;

    // Start: Monday 52 full weeks before this week's Monday
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = today.getDay() || 7; // Mon=1 … Sun=7
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - dow + 1);
    const gridStart = new Date(thisMonday);
    gridStart.setDate(thisMonday.getDate() - 52 * 7);

    const COLORS = ['#ebedf0', '#f9967a', '#f66237', '#FC4C02', '#b83600'];
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const ns = 'http://www.w3.org/2000/svg';

    const svgW = LEFT + WEEKS * STEP;
    const svgH = TOP + DAYS * STEP + 18; // 18px for legend row

    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
    svg.style.cssText = 'display:block;width:100%;height:auto;min-width:600px';

    // Month labels across the top
    let lastMonth = -1;
    for (let w = 0; w < WEEKS; w++) {
        const weekDate = new Date(gridStart);
        weekDate.setDate(gridStart.getDate() + w * 7);
        const month = weekDate.getMonth();
        if (month !== lastMonth) {
            lastMonth = month;
            const t = document.createElementNS(ns, 'text');
            t.setAttribute('x', LEFT + w * STEP);
            t.setAttribute('y', TOP - 6);
            t.setAttribute('font-size', '9');
            t.setAttribute('fill', '#9ca3af');
            t.setAttribute('font-family', 'Inter, system-ui, sans-serif');
            t.textContent = MONTHS[month];
            svg.appendChild(t);
        }
    }

    // Day labels: Mon, Wed, Fri (rows 0, 2, 4)
    for (const [d, label] of [[0, 'Mon'], [2, 'Wed'], [4, 'Fri']]) {
        const t = document.createElementNS(ns, 'text');
        t.setAttribute('x', LEFT - 4);
        t.setAttribute('y', TOP + d * STEP + CELL - 1);
        t.setAttribute('font-size', '9');
        t.setAttribute('fill', '#9ca3af');
        t.setAttribute('text-anchor', 'end');
        t.setAttribute('font-family', 'Inter, system-ui, sans-serif');
        t.textContent = label;
        svg.appendChild(t);
    }

    // Tooltip element
    const tip = document.createElement('div');
    tip.className = 'heatmap-tip';
    document.body.appendChild(tip);

    function moveTip(e) {
        const tipW = tip.offsetWidth;
        const x = e.clientX + 12 + tipW > window.innerWidth
            ? e.clientX - tipW - 12
            : e.clientX + 12;
        tip.style.left = x + 'px';
        tip.style.top  = (e.clientY - 34) + 'px';
    }

    // Cells
    for (let w = 0; w < WEEKS; w++) {
        for (let d = 0; d < DAYS; d++) {
            const cellDate = new Date(gridStart);
            cellDate.setDate(gridStart.getDate() + w * 7 + d);
            if (cellDate > today) continue;

            const dateStr = localDateStr(cellDate);
            const data    = byDate[dateStr];
            const lv      = data ? level(data.distance) : 0;

            const rect = document.createElementNS(ns, 'rect');
            rect.setAttribute('x', LEFT + w * STEP);
            rect.setAttribute('y', TOP + d * STEP);
            rect.setAttribute('width', CELL);
            rect.setAttribute('height', CELL);
            rect.setAttribute('rx', 2);
            rect.setAttribute('fill', COLORS[lv]);

            const tipText = data
                ? `${dateStr} · ${data.count} activit${data.count === 1 ? 'y' : 'ies'} · ${(data.distance / 1000).toFixed(1)} km`
                : dateStr;

            rect.addEventListener('mouseenter', e => { tip.textContent = tipText; tip.style.display = 'block'; moveTip(e); });
            rect.addEventListener('mousemove', moveTip);
            rect.addEventListener('mouseleave', () => { tip.style.display = 'none'; });

            svg.appendChild(rect);
        }
    }

    // Legend: Less □□□□□ More
    const legendY = TOP + DAYS * STEP + 7;
    const legendRight = LEFT + WEEKS * STEP;
    const legendBlockW = COLORS.length * (CELL + 2) - 2;
    const moreW = 26, lessW = 24, gutter = 4;
    const legendX = legendRight - moreW - gutter - legendBlockW - gutter - lessW;

    const less = document.createElementNS(ns, 'text');
    less.setAttribute('x', legendX);
    less.setAttribute('y', legendY + CELL - 1);
    less.setAttribute('font-size', '9');
    less.setAttribute('fill', '#9ca3af');
    less.setAttribute('font-family', 'Inter, system-ui, sans-serif');
    less.textContent = 'Less';
    svg.appendChild(less);

    for (let i = 0; i < COLORS.length; i++) {
        const r = document.createElementNS(ns, 'rect');
        r.setAttribute('x', legendX + lessW + gutter + i * (CELL + 2));
        r.setAttribute('y', legendY);
        r.setAttribute('width', CELL);
        r.setAttribute('height', CELL);
        r.setAttribute('rx', 2);
        r.setAttribute('fill', COLORS[i]);
        svg.appendChild(r);
    }

    const more = document.createElementNS(ns, 'text');
    more.setAttribute('x', legendX + lessW + gutter + legendBlockW + gutter);
    more.setAttribute('y', legendY + CELL - 1);
    more.setAttribute('font-size', '9');
    more.setAttribute('fill', '#9ca3af');
    more.setAttribute('font-family', 'Inter, system-ui, sans-serif');
    more.textContent = 'More';
    svg.appendChild(more);

    container.appendChild(svg);
})();
