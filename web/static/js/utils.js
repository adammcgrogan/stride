// Shared utilities used by dashboard.js, activities.js, and stats.js.

function localDateStr(d) {
    const year  = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day   = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Returns the Monday of the ISO week containing dateStr (YYYY-MM-DD).
function isoWeekStart(dateStr) {
    const d          = new Date(dateStr + 'T00:00:00');
    const dayOfWeek  = d.getDay() || 7; // treat Sunday (0) as 7 so Monday is always 1
    d.setDate(d.getDate() - dayOfWeek + 1);
    return localDateStr(d);
}

function fmtKm(meters) {
    return (meters / 1000).toFixed(1) + ' km';
}

function fmtTime(totalSeconds) {
    const hours   = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
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
