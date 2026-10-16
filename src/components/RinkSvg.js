import React, {memo} from 'react';
import Svg, {Circle, ClipPath, Defs, G, Line, Path, Rect} from 'react-native-svg';
import {useAppTheme, withAlpha} from '../theme';

// A regulation NHL rink drawn in feet, from centre ice: x −100…100 along the length, y −42.5…42.5.
const CORNER = 28;
const RED = '#D93A3A';
const BLUE = '#2F6FD6';
// Dark mode: brighter line colours and a lifted ice tone so the markings read against black.
const RED_DARK = '#FF5A5A';
const BLUE_DARK = '#5B9BFF';
const ICE_DARK = '#1E2226';

/**
 * How each view maps rink feet onto the drawing. full: whole rink, horizontal. half: one end
 * (centre line → end boards), vertical with the net at the top. zone: the offensive zone only
 * (blue line → end boards), net at the top, left/right as seen from the blue line.
 */
const VIEWS = {
    full: {box: [-100, -42.5, 200, 85], transform: undefined},
    // X = 42.5 − y, Y = 100 − x (rotated so the net is up, mirrored like the old half-rink image).
    half: {box: [0, 0, 85, 100], transform: 'matrix(0 -1 -1 0 42.5 100)'},
    // X = y + 42.5, Y = 100 − x.
    zone: {box: [0, 0, 85, 75], transform: 'matrix(0 -1 1 0 42.5 100)'},
};

/** Board outline (with 28 ft corners) as a path, for clipping and the ice fill. */
const BOARDS = `M${-100 + CORNER} -42.5H${100 - CORNER}A${CORNER} ${CORNER} 0 0 1 100 ${-42.5 + CORNER}V${42.5 - CORNER}` +
    `A${CORNER} ${CORNER} 0 0 1 ${100 - CORNER} 42.5H${-100 + CORNER}A${CORNER} ${CORNER} 0 0 1 -100 ${42.5 - CORNER}` +
    `V${-42.5 + CORNER}A${CORNER} ${CORNER} 0 0 1 ${-100 + CORNER} -42.5Z`;

/** One end's markings (net toward +x); mirrored for the other end. */
function EndMarkings({red, blue, crease, thin}) {
    return (
        <>
            <Line x1={89} y1={-42.5} x2={89} y2={42.5} stroke={red} strokeWidth={thin}/>
            <Path d="M89 -4H84.5A6 6 0 0 0 84.5 4H89Z" fill={crease} stroke={red} strokeWidth={thin}/>
            <Rect x={89} y={-3} width={2.3} height={6} fill="none" stroke={red} strokeWidth={thin * 1.4}/>
            <Line x1={89} y1={-11} x2={100} y2={-14} stroke={red} strokeWidth={thin}/>
            <Line x1={89} y1={11} x2={100} y2={14} stroke={red} strokeWidth={thin}/>
            {[-22, 22].map((y) => (
                <G key={y}>
                    <Circle cx={69} cy={y} r={15} fill="none" stroke={red} strokeWidth={thin}/>
                    <Circle cx={69} cy={y} r={1} fill={red}/>
                    <Circle cx={20} cy={y} r={1} fill={red}/>
                </G>
            ))}
            <Rect x={24.5} y={-42.5} width={1} height={85} fill={blue}/>
        </>
    );
}

/**
 * Drawn NHL rink (no images): boards, red centre and goal lines, blue lines, creases, nets,
 * trapezoids, faceoff circles and dots. Children are drawn on top in the same pixel space.
 * `lines`: markings only, faint, no ice fill (for overlaying on a coloured map).
 */
function RinkSvg({view = 'full', width, height, lines = false, children, style}) {
    const {colors, dark} = useAppTheme();
    const v = VIEWS[view];
    const [bx, by, bw, bh] = v.box;
    // Board outline width (ft). The view is padded by half of it so the outline isn't clipped along
    // the straight edges (which made it look thinner there than in the corners).
    const edge = dark ? 0.8 : 0.6;
    // No padding when overlaying a map, so the markings line up exactly with its tiles.
    const pad = lines ? 0 : edge / 2;
    const fade = lines ? (dark ? 0.5 : 0.4) : dark ? 0.9 : 0.8;
    const red = withAlpha(dark ? RED_DARK : RED, fade);
    const blue = withAlpha(dark ? BLUE_DARK : BLUE, fade);
    const crease = lines ? 'none' : withAlpha(dark ? BLUE_DARK : BLUE, dark ? 0.3 : 0.15);
    const thin = dark ? 0.45 : 0.35;
    return (
        <Svg width={width} height={height} style={style}>
            <Svg width={width} height={height} viewBox={`${bx - pad} ${by - pad} ${bw + pad * 2} ${bh + pad * 2}`} preserveAspectRatio="xMidYMid meet">
                <Defs>
                    <ClipPath id={`boards-${view}`}>
                        <Path d={BOARDS}/>
                    </ClipPath>
                </Defs>
                <G transform={v.transform}>
                    {lines ? null : <Path d={BOARDS} fill={dark ? ICE_DARK : colors.card}/>}
                    <G clipPath={`url(#boards-${view})`}>
                        <EndMarkings red={red} blue={blue} crease={crease} thin={thin}/>
                        <G transform="scale(-1 1)">
                            <EndMarkings red={red} blue={blue} crease={crease} thin={thin}/>
                        </G>
                        <Rect x={-0.5} y={-42.5} width={1} height={85} fill={red}/>
                        <Circle cx={0} cy={0} r={15} fill="none" stroke={blue} strokeWidth={thin}/>
                        <Circle cx={0} cy={0} r={0.6} fill={blue}/>
                    </G>
                    <Path d={BOARDS} fill="none" stroke={withAlpha(colors.text, lines ? 0.3 : dark ? 0.55 : 0.35)} strokeWidth={edge}/>
                </G>
            </Svg>
            {children}
        </Svg>
    );
}

export default memo(RinkSvg);
