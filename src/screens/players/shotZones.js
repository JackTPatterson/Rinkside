// NHL Edge shot-location areas laid out as a simple zone map of the offensive zone (pure, no React).
// Rink coordinates: depth x from the blue line (25) to the end boards (100), width y from -42.5
// (left, looking at the net from the blue line) to 42.5. The net sits at x = 89.

const rect = (x0, x1, y0, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const mirror = (pts) => pts.map(([x, y]) => [x, -y]);

// Four rows (behind the net, low, high, point) split into slot / inside / outside bands.
const LEFT = {
    'L Corner': {pts: rect(89, 100, -42.5, -11), label: [94.5, -27]},
    'L Net Side': {pts: rect(69, 89, -22, -9), label: [79, -15.5]},
    // The faceoff circle: the inside band up high plus the outside band down low.
    'L Circle': {pts: [[54, -9], [54, -30], [69, -30], [69, -42.5], [89, -42.5], [89, -22], [69, -22], [69, -9]], label: [76, -32]},
    'Outside L': {pts: rect(54, 69, -42.5, -30), label: [61.5, -36.5]},
    'L Point': {pts: rect(25, 54, -42.5, -14), label: [39.5, -28]},
};

export const SHOT_ZONES = {
    'Behind the Net': {pts: rect(89, 100, -11, 11), label: [94.5, 0]},
    'Low Slot': {pts: rect(69, 89, -9, 9), label: [76, 0]},
    Crease: {pts: rect(84, 89, -5, 5), label: [86.5, 0], small: true},
    'High Slot': {pts: rect(54, 69, -9, 9), label: [61.5, 0]},
    'Center Point': {pts: rect(25, 54, -14, 14), label: [39.5, 0]},
    ...LEFT,
    ...Object.fromEntries(Object.entries(LEFT).map(([k, z]) => [
        k.replace('L ', 'R ').replace('Outside L', 'Outside R'),
        {pts: mirror(z.pts), label: [z.label[0], -z.label[1]]},
    ])),
};

// Painting order: the crease goes on top of the low slot.
export const ZONE_ORDER = [...Object.keys(SHOT_ZONES).filter((k) => k !== 'Crease'), 'Crease'];

/** Rink point → screen point: the net at the top, the blue line at the bottom. */
export function toScreen([x, y], width) {
    const scale = width / 85;
    return [(y + 42.5) * scale, (100 - x) * scale];
}

export const mapHeight = (width) => (75 * width) / 85;
