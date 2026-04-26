// Shared utilities used by all page scripts.

function localDateStr(d) {
    const year  = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day   = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Returns the Monday of the ISO week containing dateStr (YYYY-MM-DD).
function isoWeekStart(dateStr) {
    const d          = new Date(dateStr + 'T00:00:00');
    const dayOfWeek  = d.getDay() || 7;
    d.setDate(d.getDate() - dayOfWeek + 1);
    return localDateStr(d);
}

function getUnits() {
    return localStorage.getItem('units') || 'km';
}

// Distance display — respects the km/mi preference.
function fmtDist(meters) {
    if (getUnits() === 'mi') return (meters / 1609.344).toFixed(1) + ' mi';
    return (meters / 1000).toFixed(1) + ' km';
}

// Kept for compatibility; delegates to fmtDist.
function fmtKm(meters) { return fmtDist(meters); }

function fmtTime(totalSeconds) {
    const hours   = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// Pace display — respects the km/mi preference.
function fmtPace(metersPerSecond) {
    if (!metersPerSecond) return '—';
    const dist   = getUnits() === 'mi' ? 1609.344 : 1000;
    const unit   = getUnits() === 'mi' ? '/mi' : '/km';
    const secs   = dist / metersPerSecond;
    const m      = Math.floor(secs / 60);
    const s      = Math.round(secs % 60);
    return `${m}:${String(s).padStart(2, '0')} ${unit}`;
}

// Returns {from, to} date strings covering the named period.
// 'from' is null for 'all' (no lower bound).
function periodRange(period) {
    const now   = new Date();
    const today = localDateStr(now);

    if (period === 'week') {
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((now.getDay() || 7) - 1));
        return { from: localDateStr(monday), to: today };
    }
    if (period === 'month') {
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return { from: localDateStr(firstOfMonth), to: today };
    }
    if (period === 'year') {
        return { from: `${now.getFullYear()}-01-01`, to: today };
    }
    return { from: null, to: today };
}

// Centered moving average. Handles both number[] and {x, y}[] inputs.
function movingAvg(data, windowSize) {
    if (data.length === 0) return [];
    const isXYPairs  = typeof data[0] === 'object' && data[0] !== null && 'x' in data[0];
    const values     = isXYPairs ? data.map(d => d.y || 0) : data.map(v => v || 0);
    const halfWindow = Math.floor(windowSize / 2);

    const averages = values.map((_, i) => {
        const windowSlice = values.slice(
            Math.max(0, i - halfWindow),
            Math.min(values.length, i + halfWindow + 1)
        );
        const sum = windowSlice.reduce((total, v) => total + v, 0);
        return +(sum / windowSlice.length).toFixed(2);
    });

    return isXYPairs ? data.map((d, i) => ({ x: d.x, y: averages[i] })) : averages;
}

// Converts elements with data-m (meters) or data-mps (m/s) attributes
// to the current unit preference. Called on page load and unit toggle.
function applyUnits() {
    document.querySelectorAll('[data-m]').forEach(el => {
        el.textContent = fmtDist(parseFloat(el.dataset.m));
    });
    document.querySelectorAll('[data-mps]').forEach(el => {
        el.textContent = fmtPace(parseFloat(el.dataset.mps));
    });
    document.querySelectorAll('[data-mps-max]').forEach(el => {
        const mps = parseFloat(el.dataset.mpsMax);
        if (getUnits() === 'mi') {
            el.textContent = (mps * 2.23694).toFixed(1) + ' mph';
        } else {
            el.textContent = (mps * 3.6).toFixed(1) + ' km/h';
        }
    });
}
