import React, {memo, useCallback, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {InfoTip, Segmented, T, tap} from '../../components/ui';
import {ArrowDown2, ArrowUp2} from '../../components/icons';
import {useAppTheme, withAlpha} from '../../theme';
import {savePct, signed} from '../../utils/format';
import {
    CONFERENCE_DIVISIONS,
    CONFERENCE_NAMES,
    DIVISION_NAMES,
    TeamCell,
    abbrevOf,
    bySequence,
    conferenceOf,
    divisionOf,
    styles as shared,
    toNum,
} from './shared';

const ROW_H = 44;
const TEAM_W = 126;

const VIEWS = [
    {key: 'league', label: 'League'},
    {key: 'conference', label: 'Conference'},
    {key: 'division', label: 'Division'},
    {key: 'wildcard', label: 'Wild Card'},
];

const rec = (...xs) => xs.map((x) => toNum(x) ?? 0).join('-');
const streakValue = (r) => {
    const c = toNum(r.streakCount) ?? 0;
    if (r.streakCode === 'W') return c;
    if (r.streakCode === 'L') return -c;
    return -c / 2; // OT
};

// value: used for sorting (higher = better unless asc), text: what is shown.
const COLUMNS = [
    {key: 'gp', title: 'GP', width: 36, value: (r) => toNum(r.gamesPlayed)},
    {key: 'pts', title: 'PTS', width: 40, bold: true, value: (r) => toNum(r.points)},
    {key: 'pct', title: 'P%', width: 48, value: (r) => toNum(r.pointPctg), text: (r) => savePct(r.pointPctg)},
    {key: 'w', title: 'W', width: 32, value: (r) => toNum(r.wins)},
    {key: 'l', title: 'L', width: 32, value: (r) => toNum(r.losses), lowerIsBetter: true},
    {key: 'otl', title: 'OTL', width: 36, value: (r) => toNum(r.otLosses), lowerIsBetter: true},
    {key: 'rw', title: 'RW', width: 34, value: (r) => toNum(r.regulationWins)},
    {key: 'row', title: 'ROW', width: 40, value: (r) => toNum(r.regulationPlusOtWins)},
    {key: 'gf', title: 'GF', width: 38, value: (r) => toNum(r.goalFor)},
    {key: 'ga', title: 'GA', width: 38, value: (r) => toNum(r.goalAgainst), lowerIsBetter: true},
    {key: 'diff', title: 'DIFF', width: 44, value: (r) => toNum(r.goalDifferential), text: (r) => signed(r.goalDifferential), signedColor: true},
    {key: 'l10', title: 'L10', width: 62, value: (r) => 2 * (toNum(r.l10Wins) ?? 0) + (toNum(r.l10OtLosses) ?? 0), text: (r) => rec(r.l10Wins, r.l10Losses, r.l10OtLosses)},
    {key: 'strk', title: 'STRK', width: 44, value: streakValue, text: (r) => (r.streakCode ? `${r.streakCode}${r.streakCount ?? ''}` : '–'), streak: true},
    {key: 'home', title: 'HOME', width: 70, value: (r) => toNum(r.homePoints) ?? 2 * (toNum(r.homeWins) ?? 0) + (toNum(r.homeOtLosses) ?? 0), text: (r) => rec(r.homeWins, r.homeLosses, r.homeOtLosses)},
    {key: 'road', title: 'ROAD', width: 70, value: (r) => toNum(r.roadPoints) ?? 2 * (toNum(r.roadWins) ?? 0) + (toNum(r.roadOtLosses) ?? 0), text: (r) => rec(r.roadWins, r.roadLosses, r.roadOtLosses)},
    {key: 'so', title: 'S/O', width: 44, value: (r) => toNum(r.shootoutWins), text: (r) => rec(r.shootoutWins, r.shootoutLosses)},
    {key: 'hdiff', title: 'H DIFF', width: 52, value: (r) => toNum(r.homeGoalDifferential), text: (r) => signed(r.homeGoalDifferential), signedColor: true},
    {key: 'rdiff', title: 'R DIFF', width: 52, value: (r) => toNum(r.roadGoalDifferential), text: (r) => signed(r.roadGoalDifferential), signedColor: true},
];
const COL_BY_KEY = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));
const DEFAULT_SORT = {key: 'pts', desc: true};

const CLINCH_INFO = 'Letters next to a team: x = clinched a playoff spot, y = clinched the division, ' +
    'z = clinched the conference, p = clinched the Presidents’ Trophy, e = eliminated. ' +
    'Tap a column title to sort by it; tap again to flip the order. RW = regulation wins, ROW = regulation + overtime wins (the first tiebreakers).';

function sortRows(rows, sort) {
    const col = COL_BY_KEY[sort.key] ?? COL_BY_KEY.pts;
    const dir = sort.desc ? -1 : 1;
    return [...rows].sort((a, b) => {
        const va = col.value(a);
        const vb = col.value(b);
        if (va == null && vb == null) return bySequence(a, b);
        if (va == null) return 1;
        if (vb == null) return -1;
        if (va !== vb) return (va - vb) * dir;
        return bySequence(a, b);
    });
}

function buildSections(rows, view, sort) {
    const s = (list) => sortRows(list, sort);
    if (view === 'league') return [{key: 'league', title: null, rows: s(rows)}];
    if (view === 'conference') {
        return ['E', 'W'].map((c) => ({key: c, title: `${CONFERENCE_NAMES[c]} Conference`, rows: s(rows.filter((r) => conferenceOf(r) === c))}));
    }
    if (view === 'division') {
        return ['A', 'M', 'C', 'P'].map((d) => ({key: d, title: DIVISION_NAMES[d], rows: s(rows.filter((r) => divisionOf(r) === d))}));
    }
    // Wild card: top 3 of each division, then everyone else in the conference by wild-card order.
    const out = [];
    for (const c of ['E', 'W']) {
        const conf = rows.filter((r) => conferenceOf(r) === c);
        const leaders = new Set();
        for (const d of CONFERENCE_DIVISIONS[c]) {
            const div = conf.filter((r) => divisionOf(r) === d).sort((a, b) => {
                const sa = toNum(a.divisionSequence);
                const sb = toNum(b.divisionSequence);
                return sa != null && sb != null ? sa - sb : bySequence(a, b);
            });
            const top = div.slice(0, 3);
            top.forEach((r) => leaders.add(r));
            out.push({key: `${c}-${d}`, title: DIVISION_NAMES[d], rows: s(top)});
        }
        out.push({
            key: `${c}-wc`,
            title: `${CONFERENCE_NAMES[c]} Wild Card`,
            rows: s(conf.filter((r) => !leaders.has(r))),
            cutAfter: 2,
        });
    }
    return out;
}

const HeaderCell = memo(function HeaderCell({col, sort, onSort}) {
    const {colors} = useAppTheme();
    const active = sort.key === col.key;
    const Arrow = sort.desc ? ArrowDown2 : ArrowUp2;
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${col.title}`}
            hitSlop={6}
            onPress={() => onSort(col.key)}
            style={[st.hCell, {width: col.width}]}>
            {active ? <Arrow size={10} color={colors.text}/> : null}
            <T variant="caption" muted={!active} numberOfLines={1}>{col.title}</T>
        </Pressable>
    );
});

function StatCells({row}) {
    const {colors} = useAppTheme();
    return COLUMNS.map((c) => {
        const v = c.value(row);
        const text = c.text ? c.text(row) : v == null ? '–' : String(v);
        let color;
        if (c.signedColor && v) color = v > 0 ? colors.positive : colors.negative;
        if (c.streak && row.streakCode) color = row.streakCode === 'W' ? colors.positive : row.streakCode === 'L' ? colors.negative : colors.warning;
        return (
            <T key={c.key} variant={c.bold ? 'label' : 'caption'} color={color} numberOfLines={1} style={[shared.num, {width: c.width}]}>
                {text}
            </T>
        );
    });
}

const TableSection = memo(function TableSection({section, sort, onSort, fav, onTeamPress, showCut}) {
    const {colors, teamColor} = useAppTheme();
    const rowBg = (abbrev) => (fav && abbrev === fav ? withAlpha(teamColor(abbrev), 0.14) : undefined);
    const cutIdx = showCut && section.cutAfter != null && section.rows.length > section.cutAfter ? section.cutAfter : -1;
    return (
        <View style={st.section}>
            {section.title ? <T variant="heading" style={st.sectionTitle}>{section.title}</T> : null}
            <View style={st.split}>
                {/* Fixed team column */}
                <View style={[st.fixed, {backgroundColor: colors.background, borderRightColor: colors.border}]}>
                    <View style={[st.hRow, {borderBottomColor: colors.border}]}>
                        <T variant="caption" muted style={{paddingLeft: 12}}>TEAM</T>
                    </View>
                    {section.rows.map((r, i) => {
                        const a = abbrevOf(r);
                        const isFav = fav && a === fav;
                        return (
                            <React.Fragment key={a ?? i}>
                                {i === cutIdx ? <View style={[st.cutSpacer, {borderColor: colors.negative}]}/> : null}
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`${a}, ${r.points ?? 0} points`}
                                    onPress={() => {
                                        tap();
                                        onTeamPress(a);
                                    }}
                                    style={({pressed}) => [
                                        st.cell,
                                        {borderBottomColor: colors.border, backgroundColor: rowBg(a)},
                                        isFav && {borderLeftColor: teamColor(a)},
                                        pressed && {opacity: 0.6},
                                    ]}>
                                    <TeamCell rank={i + 1} abbrev={a} width={TEAM_W - 14} suffix={r.clinchIndicator ? r.clinchIndicator : null}/>
                                </Pressable>
                            </React.Fragment>
                        );
                    })}
                </View>
                {/* Scrollable stats */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flex: 1}}>
                    <View>
                        <View style={[st.hRow, st.statsRow, {borderBottomColor: colors.border}]}>
                            {COLUMNS.map((c) => <HeaderCell key={c.key} col={c} sort={sort} onSort={onSort}/>)}
                        </View>
                        {section.rows.map((r, i) => {
                            const a = abbrevOf(r);
                            return (
                                <React.Fragment key={a ?? i}>
                                    {i === cutIdx ? <View style={[st.cutSpacer, {borderColor: colors.negative}]}/> : null}
                                    <Pressable
                                        onPress={() => {
                                            tap();
                                            onTeamPress(a);
                                        }}
                                        style={({pressed}) => [st.statsRow, st.cellRight, {borderBottomColor: colors.border, backgroundColor: rowBg(a)}, pressed && {opacity: 0.6}]}>
                                        <StatCells row={r}/>
                                    </Pressable>
                                </React.Fragment>
                            );
                        })}
                    </View>
                </ScrollView>
            </View>
            {cutIdx >= 0 ? (
                <T variant="caption" muted style={st.cutNote}>Dashed line: playoff cut (the top two wild cards make it)</T>
            ) : null}
        </View>
    );
});

/** Standings tables. rows: api-web standings rows. Memoised: the full table isn't virtualised. */
export default memo(function StandingsView({rows, fav, onTeamPress, refreshControl, listRef}) {
    const [view, setView] = useState('league');
    const [sort, setSort] = useState(DEFAULT_SORT);
    const onSort = useCallback((key) => {
        tap();
        setSort((s) => (s.key === key ? {key, desc: !s.desc} : {key, desc: !COL_BY_KEY[key]?.lowerIsBetter}));
    }, []);
    const sections = useMemo(() => buildSections(rows ?? [], view, sort), [rows, view, sort]);
    const isDefault = sort.key === DEFAULT_SORT.key && sort.desc;

    return (
        <ScrollView ref={listRef} refreshControl={refreshControl} contentContainerStyle={shared.listContent}>
            <View style={shared.subHeader}>
                <Segmented options={VIEWS} value={view} onChange={setView}/>
                <View style={st.legend}>
                    <T variant="caption" muted style={{flex: 1}}>
                        {isDefault ? 'Sorted by points' : `Sorted by ${COL_BY_KEY[sort.key]?.title} ${sort.desc ? '↓' : '↑'}`}
                    </T>
                    {!isDefault ? (
                        <Pressable accessibilityRole="button" accessibilityLabel="Reset sort to points" hitSlop={14} onPress={() => {
                            tap();
                            setSort(DEFAULT_SORT);
                        }}>
                            <T variant="caption" style={{textDecorationLine: 'underline'}}>Reset</T>
                        </Pressable>
                    ) : null}
                    <InfoTip title="Reading the table" body={CLINCH_INFO} size={14}/>
                </View>
            </View>
            {sections.map((s) => (
                <TableSection key={s.key} section={s} sort={sort} onSort={onSort} fav={fav} onTeamPress={onTeamPress} showCut={isDefault}/>
            ))}
            {view === 'wildcard' && !isDefault ? (
                <T variant="caption" muted style={shared.note}>Reset the sort to see the wild-card line.</T>
            ) : null}
        </ScrollView>
    );
});

const st = StyleSheet.create({
    section: {marginTop: 12},
    sectionTitle: {paddingHorizontal: 16, marginBottom: 4},
    split: {flexDirection: 'row'},
    fixed: {width: TEAM_W, borderRightWidth: StyleSheet.hairlineWidth, zIndex: 1},
    hRow: {height: 32, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth},
    statsRow: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8},
    hCell: {flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2},
    cell: {
        height: ROW_H,
        justifyContent: 'center',
        paddingLeft: 4,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderLeftWidth: 3,
        borderLeftColor: 'transparent',
    },
    cellRight: {height: ROW_H, borderBottomWidth: StyleSheet.hairlineWidth},
    cutSpacer: {height: 0, borderTopWidth: 2, borderStyle: 'dashed'},
    cutNote: {paddingHorizontal: 16, paddingTop: 6},
    legend: {flexDirection: 'row', alignItems: 'center', gap: 10},
});
