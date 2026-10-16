// Deep imports keep the bundle from including all ~1000 iconsax icons.
// React 19 ignores defaultProps on forwardRef components, so wrap each icon with explicit defaults.
// To add an icon: import it from 'iconsax-react-native/dist/esm/<Name>' and wrap it below.
import React from 'react';
import {View} from 'react-native';
import Svg, {G, Path} from 'react-native-svg';
import StatusRaw from 'iconsax-react-native/dist/esm/Status';
import MonitorRaw from 'iconsax-react-native/dist/esm/Monitor';
import AwardRaw from 'iconsax-react-native/dist/esm/Award';
import SpeedometerRaw from 'iconsax-react-native/dist/esm/Speedometer';
import LampRaw from 'iconsax-react-native/dist/esm/Lamp';
import HealthRaw from 'iconsax-react-native/dist/esm/Health';
import HierarchyRaw from 'iconsax-react-native/dist/esm/Hierarchy';
import DiagramRaw from 'iconsax-react-native/dist/esm/Diagram';
import Messages2Raw from 'iconsax-react-native/dist/esm/Messages2';
import CodeRaw from 'iconsax-react-native/dist/esm/Code';
import InformationRaw from 'iconsax-react-native/dist/esm/Information';
import HeartRaw from 'iconsax-react-native/dist/esm/Heart';
import LocationRaw from 'iconsax-react-native/dist/esm/Location';
import DocumentTextRaw from 'iconsax-react-native/dist/esm/DocumentText';
import GlobalRaw from 'iconsax-react-native/dist/esm/Global';
import LinkRaw from 'iconsax-react-native/dist/esm/Link';
import Edit2Raw from 'iconsax-react-native/dist/esm/Edit2';
import ArrowUp2Raw from 'iconsax-react-native/dist/esm/ArrowUp2';
import ActivityRaw from 'iconsax-react-native/dist/esm/Activity';
import ArrowDown2Raw from 'iconsax-react-native/dist/esm/ArrowDown2';
import ArrowLeft2Raw from 'iconsax-react-native/dist/esm/ArrowLeft2';
import ArrowRight2Raw from 'iconsax-react-native/dist/esm/ArrowRight2';
import BrodcastRaw from 'iconsax-react-native/dist/esm/Brodcast';
import CalendarRaw from 'iconsax-react-native/dist/esm/Calendar';
import CategoryRaw from 'iconsax-react-native/dist/esm/Category';
import ChartRaw from 'iconsax-react-native/dist/esm/Chart';
import Chart2Raw from 'iconsax-react-native/dist/esm/Chart2';
import ClockRaw from 'iconsax-react-native/dist/esm/Clock';
import Crown1Raw from 'iconsax-react-native/dist/esm/Crown1';
import CupRaw from 'iconsax-react-native/dist/esm/Cup';
import DangerRaw from 'iconsax-react-native/dist/esm/Danger';
import FilterRaw from 'iconsax-react-native/dist/esm/Filter';
import FlashRaw from 'iconsax-react-native/dist/esm/Flash';
import GraphRaw from 'iconsax-react-native/dist/esm/Graph';
import Home2Raw from 'iconsax-react-native/dist/esm/Home2';
import InfoCircleRaw from 'iconsax-react-native/dist/esm/InfoCircle';
import MedalRaw from 'iconsax-react-native/dist/esm/Medal';
import Microphone2Raw from 'iconsax-react-native/dist/esm/Microphone2';
import MoneysRaw from 'iconsax-react-native/dist/esm/Moneys';
import PeopleRaw from 'iconsax-react-native/dist/esm/People';
import PlayRaw from 'iconsax-react-native/dist/esm/Play';
import PauseRaw from 'iconsax-react-native/dist/esm/Pause';
import Profile2UserRaw from 'iconsax-react-native/dist/esm/Profile2User';
import RadarRaw from 'iconsax-react-native/dist/esm/Radar';
import RankingRaw from 'iconsax-react-native/dist/esm/Ranking';
import RefreshRaw from 'iconsax-react-native/dist/esm/Refresh';
import RowVerticalRaw from 'iconsax-react-native/dist/esm/RowVertical';
import SearchNormal1Raw from 'iconsax-react-native/dist/esm/SearchNormal1';
import Setting2Raw from 'iconsax-react-native/dist/esm/Setting2';
import ShieldRaw from 'iconsax-react-native/dist/esm/Shield';
import SortRaw from 'iconsax-react-native/dist/esm/Sort';
import Star1Raw from 'iconsax-react-native/dist/esm/Star1';
import TickCircleRaw from 'iconsax-react-native/dist/esm/TickCircle';
import Timer1Raw from 'iconsax-react-native/dist/esm/Timer1';
import UserRaw from 'iconsax-react-native/dist/esm/User';
import VideoRaw from 'iconsax-react-native/dist/esm/Video';

const wrap = (C) => {
    const Icon = ({size = 22, color = '#888', variant = 'Linear', ...rest}) => (
        <C size={size} color={color} variant={variant} {...rest}/>
    );
    Icon.displayName = C.displayName;
    return Icon;
};

export const Activity = wrap(ActivityRaw);
export const ArrowDown2 = wrap(ArrowDown2Raw);
export const ArrowLeft2 = wrap(ArrowLeft2Raw);
export const ArrowRight2 = wrap(ArrowRight2Raw);
export const Brodcast = wrap(BrodcastRaw);
export const Calendar = wrap(CalendarRaw);
export const Category = wrap(CategoryRaw);
export const Chart = wrap(ChartRaw);
export const Chart2 = wrap(Chart2Raw);
export const Clock = wrap(ClockRaw);
/**
 * Plain X (iconsax only ships boxed/circled closes). Drawn on iconsax's 24pt grid at its 1.5 stroke
 * so it matches the other Linear icons; `variant="Bold"` uses a heavier stroke.
 */
export function Close({size = 22, color = '#888', variant = 'Linear', ...rest}) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
            <Path d="M6 6L18 18M18 6L6 18" stroke={color} strokeWidth={variant === 'Bold' ? 2.25 : 1.5} strokeLinecap="round"/>
        </Svg>
    );
}
export const Crown1 = wrap(Crown1Raw);
export const Cup = wrap(CupRaw);
export const Danger = wrap(DangerRaw);
export const Filter = wrap(FilterRaw);
export const Flash = wrap(FlashRaw);
export const Graph = wrap(GraphRaw);
export const Home2 = wrap(Home2Raw);
export const InfoCircle = wrap(InfoCircleRaw);
export const Medal = wrap(MedalRaw);
export const Microphone2 = wrap(Microphone2Raw);
export const Moneys = wrap(MoneysRaw);
export const People = wrap(PeopleRaw);
export const Play = wrap(PlayRaw);
export const Pause = wrap(PauseRaw);
export const Profile2User = wrap(Profile2UserRaw);
export const Radar = wrap(RadarRaw);
export const Ranking = wrap(RankingRaw);
export const Refresh = wrap(RefreshRaw);
export const RowVertical = wrap(RowVerticalRaw);
export const SearchNormal1 = wrap(SearchNormal1Raw);
export const Setting2 = wrap(Setting2Raw);
export const Shield = wrap(ShieldRaw);
export const Sort = wrap(SortRaw);
export const Star1 = wrap(Star1Raw);
export const TickCircle = wrap(TickCircleRaw);
export const Timer1 = wrap(Timer1Raw);
export const User = wrap(UserRaw);
export const Video = wrap(VideoRaw);
export const ArrowUp2 = wrap(ArrowUp2Raw);
export const Edit2 = wrap(Edit2Raw);
export const Link = wrap(LinkRaw);
export const Global = wrap(GlobalRaw);
export const DocumentText = wrap(DocumentTextRaw);
export const Location = wrap(LocationRaw);
export const Heart = wrap(HeartRaw);
export const Information = wrap(InformationRaw);
export const Code = wrap(CodeRaw);
export const Messages2 = wrap(Messages2Raw);
export const Diagram = wrap(DiagramRaw);
export const Hierarchy = wrap(HierarchyRaw);
export const Health = wrap(HealthRaw);
export const Lamp = wrap(LampRaw);
export const Speedometer = wrap(SpeedometerRaw);
export const Monitor = wrap(MonitorRaw);
export const Award = wrap(AwardRaw);
export const Status = wrap(StatusRaw);

/**
 * Diagonal movement arrows (↗ up, ↘ down), the 45° style the original Rinkside UI used for
 * "moved up / moved down". Drawn with a heavy stroke so they read at small sizes.
 */
const DIAG_STROKE = 2.6;

/** Television with rabbit-ear antennas (iconsax has no TV), drawn to match the 1.5-stroke Linear icons. */
export function Tv({size = 22, color = '#888'}) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M2.75 11.5C2.75 9.01 4.76 7 7.25 7H16.75C19.24 7 21.25 9.01 21.25 11.5V15.5C21.25 17.99 19.24 20 16.75 20H7.25C4.76 20 2.75 17.99 2.75 15.5V11.5Z" stroke={color} strokeWidth={1.5}/>
            <Path d="M8 2.75L12 7L16 2.75" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
            <Path d="M7 22H17" stroke={color} strokeWidth={1.5} strokeLinecap="round"/>
        </Svg>
    );
}

/**
 * One bold arrow, drawn pointing right and rotated for every direction, so straight and 45° arrows
 * match across the app (chevrons, back buttons and dropdowns keep the iconsax chevrons).
 */
function BoldArrow({size = 22, color = '#888', strokeWidth = DIAG_STROKE, angle = 0}) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <G transform={`rotate(${angle} 12 12)`}>
                <Path d="M4.5 12H19M13 6L19 12L13 18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
            </G>
        </Svg>
    );
}

export const ArrowRight = (p) => <BoldArrow {...p} angle={0}/>;
export const ArrowDown = (p) => <BoldArrow {...p} angle={90}/>;
export const ArrowLeft = (p) => <BoldArrow {...p} angle={180}/>;
export const ArrowUp = (p) => <BoldArrow {...p} angle={-90}/>;
export const ArrowUpRight = (p) => <BoldArrow {...p} angle={-45}/>;
export const ArrowDownRight = (p) => <BoldArrow {...p} angle={45}/>;
// Trend icons are the same 45° arrows.
export const TrendUp = ArrowUpRight;
export const TrendDown = ArrowDownRight;
