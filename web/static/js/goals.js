// ── Drawer ─────────────────────────────────────────────────────────────────

(function setupDrawer() {
    const fab     = document.getElementById('goal-fab-btn');
    const drawer  = document.getElementById('goal-drawer');
    const overlay = document.getElementById('goal-drawer-overlay');
    const close   = document.getElementById('goal-drawer-close');
    if (!fab) return;

    function open()  { drawer.classList.add('open'); overlay.classList.add('open'); document.body.style.overflow = 'hidden'; }
    function shut()  { drawer.classList.remove('open'); overlay.classList.remove('open'); document.body.style.overflow = ''; }

    fab.addEventListener('click', open);
    close.addEventListener('click', shut);
    overlay.addEventListener('click', shut);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') shut(); });
})();

const METRIC_UNIT = {
    distance:     'km',
    moving_time:  'h',
    elevation:    'm',
    count:        '',
    kilojoules:   'kJ',
    suffer_score: 'pts',
};


const PERIOD_LABEL = {
    week: 'Weekly', month: 'Monthly', year: 'Yearly', all: 'All Time',
};

// ── Form unit label ────────────────────────────────────────────────────────

(function setupForm() {
    const metricSel = document.getElementById('f-metric');
    const unitLabel = document.getElementById('unit-label');
    if (!metricSel) return;

    function update() {
        unitLabel.textContent = METRIC_UNIT[metricSel.value] || '';
    }

    metricSel.addEventListener('change', update);
    update();
})();

// ── Progress rendering ─────────────────────────────────────────────────────

(async function renderGoals() {
    if (!GOALS.length) {
        document.getElementById('active-empty').style.display = 'block';
        return;
    }

    const resp = await fetch('/api/activities?limit=10000');
    if (!resp.ok) return;
    const activities = await resp.json() || [];

    const activeGrid    = document.getElementById('active-grid');
    const completedGrid = document.getElementById('completed-grid');
    const activeEmpty   = document.getElementById('active-empty');
    const completedSec  = document.getElementById('completed-section');

    let hasActive = false, hasCompleted = false;

    for (const goal of GOALS) {
        const { current, pct } = calcProgress(goal, activities);
        const card = makeCard(goal, current, pct);
        if (pct >= 1) {
            completedGrid.appendChild(card);
            hasCompleted = true;
        } else {
            activeGrid.appendChild(card);
            hasActive = true;
        }
    }

    if (!hasActive) activeEmpty.style.display = 'block';
    if (hasCompleted) completedSec.style.display = 'block';
})();

function calcProgress(goal, activities) {
    const now = new Date();
    let fromDate = null;

    if (goal.Period === 'week') {
        fromDate = isoWeekStart(localDateStr(now));
    } else if (goal.Period === 'month') {
        fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    } else if (goal.Period === 'year') {
        fromDate = `${now.getFullYear()}-01-01`;
    }

    let filtered = activities;
    if (goal.SportType) filtered = filtered.filter(a => a.SportType === goal.SportType);
    if (fromDate) filtered = filtered.filter(a => a.StartDateLocal.slice(0, 10) >= fromDate);

    let current = 0;
    switch (goal.Metric) {
        case 'distance':     current = filtered.reduce((s, a) => s + a.Distance / 1000, 0); break;
        case 'moving_time':  current = filtered.reduce((s, a) => s + a.MovingTime / 3600, 0); break;
        case 'elevation':    current = filtered.reduce((s, a) => s + a.TotalElevationGain, 0); break;
        case 'count':        current = filtered.length; break;
        case 'kilojoules':   current = filtered.reduce((s, a) => s + a.Kilojoules, 0); break;
        case 'suffer_score': current = filtered.reduce((s, a) => s + (a.SufferScore || 0), 0); break;
    }

    return { current, pct: Math.min(current / goal.Target, 1) };
}

function fmtValue(value, metric) {
    switch (metric) {
        case 'distance':     return value.toFixed(1) + ' km';
        case 'moving_time':  return value.toFixed(1) + ' h';
        case 'elevation':    return Math.round(value).toLocaleString() + ' m';
        case 'count':        return Math.round(value) + (Math.round(value) === 1 ? ' activity' : ' activities');
        case 'kilojoules':   return Math.round(value).toLocaleString() + ' kJ';
        case 'suffer_score': return Math.round(value).toLocaleString() + ' pts';
        default:             return value.toFixed(1);
    }
}

function fmtTarget(target, metric) {
    switch (metric) {
        case 'distance':     return target.toFixed(0) + ' km';
        case 'moving_time':  return target.toFixed(0) + ' h';
        case 'elevation':    return Math.round(target).toLocaleString() + ' m';
        case 'count':        return Math.round(target) + (Math.round(target) === 1 ? ' activity' : ' activities');
        case 'kilojoules':   return Math.round(target).toLocaleString() + ' kJ';
        case 'suffer_score': return Math.round(target).toLocaleString() + ' pts';
        default:             return target.toFixed(0);
    }
}

function timeLeft(period) {
    const now = new Date();
    if (period === 'week') {
        const days = 7 - (now.getDay() || 7);
        return days === 0 ? 'Last day of the week' : `${days} day${days === 1 ? '' : 's'} left this week`;
    }
    if (period === 'month') {
        const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
        return days === 0 ? 'Last day of the month' : `${days} day${days === 1 ? '' : 's'} left this month`;
    }
    if (period === 'year') {
        const days = Math.ceil((new Date(now.getFullYear(), 11, 31) - now) / 86400000);
        return `${days} day${days === 1 ? '' : 's'} left this year`;
    }
    return null;
}

function makeRing(pct) {
    const R = 30, CX = 38, CY = 38, SW = 7;
    const circ = 2 * Math.PI * R;
    const done = pct >= 1;
    const color = done ? '#22c55e' : '#FC4C02';
    const trackColor = done ? '#bbf7d0' : '#e5e7eb';
    const fill = Math.min(pct, 1) * circ;
    const pctLabel = done ? '✓' : Math.round(pct * 100) + '%';
    const fontSize = done ? '18' : '12';
    const textColor = done ? '#16a34a' : '#111318';

    return `<svg width="76" height="76" viewBox="0 0 76 76">
        <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${trackColor}" stroke-width="${SW}"/>
        <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${color}" stroke-width="${SW}"
            stroke-dasharray="${fill.toFixed(2)} ${circ.toFixed(2)}"
            stroke-linecap="round"
            transform="rotate(-90 ${CX} ${CY})"/>
        <text x="${CX}" y="${CY}" text-anchor="middle" dominant-baseline="middle"
            font-size="${fontSize}" font-weight="700" fill="${textColor}"
            font-family="Inter, system-ui, sans-serif">${pctLabel}</text>
    </svg>`;
}

function makeCard(goal, current, pct) {
    const done = pct >= 1;
    const barColor = done ? '#22c55e' : '#FC4C02';
    const remaining = timeLeft(goal.Period);

    const footer = done
        ? `<span class="goal-footer-note goal-footer-note--done">Goal achieved!</span>`
        : remaining
            ? `<span class="goal-footer-note">${remaining}</span>`
            : '';

    const card = document.createElement('article');
    card.className = 'goal-card' + (done ? ' goal-card--done' : '');
    card.dataset.goalId = goal.ID;

    card.innerHTML = `
        <div class="goal-card-header">
            <div class="goal-card-meta">
                <div class="goal-card-title">${escHtml(goal.Title)}</div>
                <div class="goal-badges">
                    <span class="goal-badge goal-badge--period">${PERIOD_LABEL[goal.Period] || goal.Period}</span>
                    <span class="goal-badge goal-badge--sport">${goal.SportType || 'All Sports'}</span>
                    ${done ? '<span class="goal-badge goal-badge--done">Completed</span>' : ''}
                </div>
            </div>
            <div class="goal-card-actions">
                <div class="goal-ring">${makeRing(pct)}</div>
                <button class="goal-delete-btn" title="Delete goal" aria-label="Delete goal">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                    </svg>
                </button>
            </div>
        </div>
        <div class="goal-numbers">
            <span class="goal-current" style="color:${barColor}">${fmtValue(current, goal.Metric)}</span>
            <span class="goal-target-label">of ${fmtTarget(goal.Target, goal.Metric)}</span>
        </div>
        <div class="goal-bar-track">
            <div class="goal-bar-fill" style="width:${(pct * 100).toFixed(2)}%;background:${barColor}"></div>
        </div>
        ${footer}
    `;

    card.querySelector('.goal-delete-btn').addEventListener('click', () => deleteGoal(goal.ID, card));
    return card;
}

function escHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function deleteGoal(id, card) {
    if (!confirm('Delete this goal? This cannot be undone.')) return;

    const resp = await fetch(`/goals/${id}`, { method: 'DELETE' });
    if (!resp.ok) return;

    card.remove();

    const activeGrid    = document.getElementById('active-grid');
    const completedGrid = document.getElementById('completed-grid');
    const activeEmpty   = document.getElementById('active-empty');
    const completedSec  = document.getElementById('completed-section');

    if (!activeGrid.children.length)    activeEmpty.style.display = 'block';
    if (!completedGrid.children.length) completedSec.style.display = 'none';
}
