'use strict';

const PAGE_SIZE = 20;
let allActivities = [];
let filtered      = [];
let currentPage   = 1;

function sportPillClass(sport) {
    const s = sport.toLowerCase();
    if (s.includes('run') || s.includes('walk') || s.includes('hike')) return 'sport-pill--running';
    if (s.includes('ride') || s.includes('cycl') || s.includes('bike')) return 'sport-pill--cycling';
    if (s.includes('swim')) return 'sport-pill--swimming';
    return 'sport-pill--default';
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtPaceFromActivity(a) {
    if (!a.Distance || !a.MovingTime) return '—';
    return fmtPace(a.Distance / a.MovingTime); // m/s → fmtPace from utils.js
}

// ── filter ────────────────────────────────────────────────────────────────────

function applyFilters() {
    const search   = document.getElementById('act-search').value.toLowerCase();
    const sport    = document.getElementById('sport-filter').value;
    const dateFrom = document.getElementById('date-from').value;
    const dateTo   = document.getElementById('date-to').value;

    filtered = allActivities.filter(a => {
        const date = a.StartDateLocal.slice(0, 10);
        if (dateFrom && date < dateFrom)                         return false;
        if (dateTo   && date > dateTo)                          return false;
        if (sport    && a.SportType !== sport)                   return false;
        if (search   && !a.Name.toLowerCase().includes(search)) return false;
        return true;
    });
    currentPage = 1;
}

// ── stat cards ────────────────────────────────────────────────────────────────

function updateSummaryCards() {
    const count     = filtered.length;
    const totalDist = filtered.reduce((sum, a) => sum + a.Distance, 0);
    const totalElev = filtered.reduce((sum, a) => sum + a.TotalElevationGain, 0);
    const totalTime = filtered.reduce((sum, a) => sum + a.MovingTime, 0);

    document.getElementById('s-count').textContent = count;
    document.getElementById('s-dist').textContent  = fmtDist(totalDist);
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
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999">No activities found.</td></tr>';
        return;
    }

    tbody.innerHTML = pageItems.map(a => `
        <tr class="act-row" data-href="/activities/${a.ID}">
            <td><a href="/activities/${a.ID}">${escapeHtml(a.Name)}</a></td>
            <td><span class="sport-pill ${sportPillClass(a.SportType)}">${escapeHtml(a.SportType)}</span></td>
            <td>${fmtKm(a.Distance)}</td>
            <td class="act-pace">${fmtPaceFromActivity(a)}</td>
            <td>${fmtTime(a.MovingTime)}</td>
            <td>${Math.round(a.TotalElevationGain)} m</td>
            <td>${a.StartDateLocal.slice(0, 10)}</td>
        </tr>
    `).join('');

    tbody.querySelectorAll('.act-row').forEach(row => {
        row.addEventListener('click', e => {
            if (e.target.tagName !== 'A') window.location.href = row.dataset.href;
        });
    });
}

// ── pagination ────────────────────────────────────────────────────────────────

function renderPagination() {
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const container  = document.getElementById('act-pagination');

    if (totalPages <= 1) { container.innerHTML = ''; return; }

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
    const dateGroup = document.getElementById('date-range-group');

    if (!period || period === 'custom') {
        if (period === 'custom') {
            document.querySelector('[data-period="custom"]').classList.add('active');
        }
        dateGroup.style.display = 'flex';
        return;
    }

    dateGroup.style.display = 'none';
    document.querySelector(`[data-period="${period}"]`).classList.add('active');
    const { from, to } = periodRange(period);
    document.getElementById('date-from').value = from || '';
    document.getElementById('date-to').value   = to;
}

document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.period === 'custom') {
            setActivePeriod('custom');
            render();
            return;
        }
        location.hash = btn.dataset.period;
        setActivePeriod(btn.dataset.period);
        render();
    });
});

['date-from', 'date-to'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
        history.replaceState(null, '', location.pathname);
        setActivePeriod('custom');
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
        option.value = sport; option.textContent = sport;
        select.appendChild(option);
    }

    setActivePeriod(location.hash.slice(1) || 'all');
    render();
})();
