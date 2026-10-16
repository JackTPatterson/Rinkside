// Radar chart geometry (pure, no React): N axes starting at 12 o'clock, clockwise.

export const RADAR_RINGS = [0.25, 0.5, 0.75, 1];

/**
 * size: chart width/height; values: 0..1 per axis; pad: room left around the web for labels.
 * Returns {c, r, axes: [{x, y, lx, ly, anchor, angle}], rings: [points string], shape: points string,
 * dots: [{x, y}]}.
 */
export function radarGeometry(size, values, pad = 70) {
    const n = values.length;
    const c = size / 2;
    const r = c - pad;
    const at = (i, f) => {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
        return [c + r * f * Math.cos(a), c + r * f * Math.sin(a), a];
    };
    const ring = (f) => values.map((_, i) => at(i, f).slice(0, 2).map((v) => v.toFixed(1)).join(',')).join(' ');
    const axes = values.map((_, i) => {
        const [x, y, a] = at(i, 1);
        const [lx, ly] = at(i, 1 + 12 / r); // a fixed 12pt beyond the rim
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        return {
            x, y, lx,
            // Labels above the top axis sit higher, below the bottom axis lower, so they clear the web.
            ly: ly + (sin < -0.5 ? -14 : sin > 0.5 ? 6 : -6),
            anchor: cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle',
            angle: a,
        };
    });
    const clamp = (v) => Math.max(0.03, Math.min(1, v ?? 0));
    const dots = values.map((v, i) => {
        const [x, y] = at(i, clamp(v));
        return {x, y};
    });
    return {
        c,
        r,
        axes,
        rings: RADAR_RINGS.map(ring),
        shape: dots.map((d) => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' '),
        dots,
    };
}
