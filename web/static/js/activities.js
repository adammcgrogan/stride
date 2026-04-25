const PAGE_SIZE = 20;
let allActivities = [];
let filtered = [];
let currentPage = 1;

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── filter ────────────────────────────────────────────────────────────────────

function applyFilters() {
    const search    = document.getElementById('act-search').value.toLowerCase();
    const sport     = document.getElementById('sport-filter').value;
    const dateFrom  = document.getElementById('date-from').value;
    const dateTo    = document.getElementById('date-to').value;

    filtered = allActivities.filter(activity => {
        const date = activity.StartDateLocal.slice(0, 10);
        if (dateFrom && date < dateFrom)                              return false;
        if (dateTo   && date > dateTo)                               return false;
        if (sport    && activity.SportType !== sport)                 return false;
        if (search   && !activity.Name.toLowerCase().includes(search)) return false;
        return true;
    });
    currentPage = 1;
}

// ── stat cards ────────────────────────────────────────────────────────────────

function updateSummaryCards() {
    const count      = filtered.length;
    const totalDist  = filtered.reduce((sum, a) => sum + a.Distance, 0);
    const totalElev  = filtered.reduce((sum, a) => sum + a.TotalElevationGain, 0);
    const totalTime  = filtered.reduce((sum, a) => sum + a.MovingTime, 0);

    document.getElementById('s-count').textContent = count;
    document.getElementById('s-dist').innerHTML    = (totalDist / 1000).toFixed(1) + ' <small>km</small>';
    document.getElementById('s-elev').innerHTML    = Math.round(totalElev) + ' <small>m</small>';
    document.getElementById('s-time').textContent  = fmtTime(totalTime);

    const badge = document.getElementById('act-badge');
    badge.textContent = count + ' ' + (count === 1 ? 'activity' : 'activities');
}

// ── table ─────────────────────────────────────────────────────────────────────

function renderTable() {
    const pageStart = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);
    const tbody     = document.querySelector('#act-table tbody');

    if (!pageItems.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999">No activities found.</td></tr>';
        return;
    }

    tbody.innerHTML = pageItems.map(activity => `
        <tr>
            <td><a href="/activities/${activity.ID}">${escapeHtml(activity.Name)}</a></td>
            <td>${escapeHtml(activity.SportType)}</td>
            <td>${fmtKm(activity.Distance)}</td>
            <td>${fmtTime(activity.MovingTime)}</td>
            <td>${Math.round(activity.TotalElevationGain)} m</td>
            <td>${activity.StartDateLocal.slice(0, 10)}</td>
        </tr>
    `).join('');
}

// ── pagination ────────────────────────────────────────────────────────────────

function renderPagination() {
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const container  = document.getElementById('act-pagination');

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    if (currentPage > 1)          html += `<a href="#" data-page="${currentPage - 1}">&larr; Prev</a>`;
    html += `<span>${currentPage} / ${totalPages}</span>`;
    if (currentPage < totalPages) html += `<a href="#" data-page="${currentPage + 1}">Next &rarr;</a>`;
    container.innerHTML = html;

    container.querySelectorAll('a[data-page]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            currentPage = parseInt(link.dataset.page, 10);
            renderTable();
            renderPagination();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

// ── render ────────────────────────────────────────────────────────────────────

function render() {
    applyFilters();
    updateSummaryCards();
    renderTable();
    renderPagination();
}

// ── period buttons ────────────────────────────────────────────────────────────

function setActivePeriod(period) {
    document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
    if (!period) return;
    const activeBtn = document.querySelector(`[data-period="${period}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    const { from, to } = periodRange(period);
    document.getElementById('date-from').value = from || '';
    document.getElementById('date-to').value   = to;
}

document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => { setActivePeriod(btn.dataset.period); render(); });
});

['date-from', 'date-to'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        render();
    });
});

document.getElementById('sport-filter').addEventListener('change', render);
document.getElementById('act-search').addEventListener('input', render);

// ── init ──────────────────────────────────────────────────────────────────────

(async function init() {
    const resp = await fetch('/api/activities?limit=10000');
    if (!resp.ok) return;
    allActivities = await resp.json() || [];

    const sports = [...new Set(allActivities.map(a => a.SportType))].sort();
    const select = document.getElementById('sport-filter');
    for (const sport of sports) {
        const option = document.createElement('option');
        option.value = sport;
        option.textContent = sport;
        select.appendChild(option);
    }

    render();
})();
