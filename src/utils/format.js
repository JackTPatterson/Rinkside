const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const pad2 = (n) => String(n).padStart(2, '0');

// Local calendar date as YYYY-MM-DD (the NHL API's date format).
export function toISODate(date = new Date()) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

// Parses YYYY-MM-DD as a *local* date (new Date('2026-10-15') would be UTC midnight).
export function parseISODate(s) {
    const [y, m, d] = String(s).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
}

export function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatTime(date) {
    let h = date.getHours();
    const m = date.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${pad2(m)} ${ampm}`;
}

export function dayName(date) {
    return DAY_NAMES[date.getDay()];
}

export function shortDate(date) {
    return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

// "Today", "Tomorrow", "Yesterday", or "Sat, Oct 18".
export function relativeDayLabel(date, now = new Date()) {
    const diff = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) -
        new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return `${dayName(date)}, ${shortDate(date)}`;
}

export function countdown(target, now = new Date()) {
    const diff = Math.max(0, target - now);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

export function ordinal(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return String(n ?? '');
    const s = ['th', 'st', 'nd', 'rd'];
    const mod = v % 100;
    return v + (s[(mod - 20) % 10] || s[mod] || s[0]);
}

export function pct(x, digits = 0) {
    if (x == null || !Number.isFinite(Number(x))) return '–';
    return `${(Number(x) * 100).toFixed(digits)}%`;
}

export function num(x, digits = 0) {
    if (x == null || !Number.isFinite(Number(x))) return '–';
    return Number(x).toFixed(digits);
}

export function signed(x, digits = 0) {
    if (x == null || !Number.isFinite(Number(x))) return '–';
    const v = Number(x);
    return `${v > 0 ? '+' : ''}${v.toFixed(digits)}`;
}

// Save percentage in hockey notation: .915
export function savePct(x) {
    if (x == null || !Number.isFinite(Number(x))) return '–';
    return Number(x).toFixed(3).replace(/^0/, '');
}

// "MM:SS" or seconds -> seconds
export function mmssToSeconds(s) {
    if (typeof s === 'number') return s;
    const [m, sec] = String(s ?? '0:0').split(':').map(Number);
    return (m || 0) * 60 + (sec || 0);
}

export function secondsToMMSS(total) {
    const t = Math.max(0, Math.round(total));
    return `${Math.floor(t / 60)}:${pad2(t % 60)}`;
}

export function periodLabel(number, periodType) {
    if (periodType === 'SO') return 'SO';
    if (periodType === 'OT' || number > 3) return number > 4 ? `${number - 3}OT` : 'OT';
    return ordinal(number);
}

// The NHL API localises names as {default: 'Name', fr: ...}.
export const loc = (v) => (v && typeof v === 'object' ? v.default ?? '' : v ?? '');
