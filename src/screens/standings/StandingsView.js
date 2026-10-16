import React, {memo, useCallback, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {Segmented, T, tap} from '../../components/ui';
import {ArrowDownRight, ArrowUpRight} from '../../components/icons';
import {GUTTER, useAppTheme} from '../../theme';
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
    type,
} from './shared';

const ROW_H = 48;
const TEAM_W = 136;

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
    {key: 'gp', title: 'GP', width: 34, value: (r) => toNum(r.gamesPlayed)},
    {key: 'pts', title: 'PTS', width: 42, bold: true, value: (r) => toNum(r.points)},
    {key: 'pct', title: 'P%', width: 54, value: (r) => toNum(r.pointPctg), text: (r) => savePct(r.pointPctg)},
    {key: 'w', title: 'W', width: 32, value: (r) => toNum(r.wins)},
    {key: 'l', title: 'L', width: 32, value: (r) => toNum(r.losses), lowerIsBetter: true},
    {key: 'otl', title: 'OTL', width: 38, value: (r) => toNum(r.otLosses), lowerIsBetter: true},
    {key: 'rw', title: 'RW', width: 36, value: (r) => toNum(r.regulationWins)},
    {key: 'row', title: 'ROW', width: 42, value: (r) => toNum(r.regulationPlusOtWins)},
    {key: 'gf', title: 'GF', width: 40, value: (r) => toNum(r.goalFor)},
    {key: 'ga', title: 'GA', width: 40, value: (r) => toNum(r.goalAgainst), lowerIsBetter: true},
    {key: 'diff', title: 'DIFF', width: 48, value: (r) => toNum(r.goalDifferential), text: (r) => signed(r.goalDifferential), signedColor: true},
    {key: 'l10', title: 'L10', width: 70, value: (r) => 2 * (toNum(r.l10Wins) ?? 0) + (toNum(r.l10OtLosses) ?? 0), text: (r) => rec(r.l10Wins, r.l10Losses, r.l10OtLosses)},
    {key: 'strk', title: 'STRK', width: 48, value: streakValue, text: (r) => (r.streakCode ? `${r.streakCode}${r.streakCount ?? ''}` : '–'), streak: true},
    {key: 'home', title: 'HOME', width: 80, value: (r) => toNum(r.homePoints) ?? 2 * (toNum(r.homeWins) ?? 0) + (toNum(r.homeOtLosses) ?? 0), text: (r) => rec(r.homeWins, r.homeLosses, r.homeOtLosses)},
    {key: 'road', title: 'ROAD', width: 80, value: (r) => toNum(r.roadPoints) ?? 2 * (toNum(r.roadWins) ?? 0) + (toNum(r.roadOtLosses) ?? 0), text: (r) => rec(r.roadWins, r.roadLosses, r.roadOtLosses)},
    {key: 'so', title: 'S/O', width: 48, value: (r) => toNum(r.shootoutWins), text: (r) => rec(r.shootoutWins, r.shootoutLosses)},
    {key: 'hdiff', title: 'H DIFF', width: 56, value: (r) => toNum(r.homeGoalDifferential), text: (r) => signed(r.homeGoalDifferential), signedColor: true},
    {key: 'rdiff', title: 'R DIFF', width: 56, value: (r) => toNum(r.roadGoalDifferential), text: (r) => signed(r.roadGoalDifferential), signedColor: true},
];
const COL_BY_KEY = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));
const DEFAULT_SORT = {key: 'pts', desc: true};

// Table key shown under the standings (replaces the old info sheet).
const LEGEND = [
    ['x', 'Clinched playoffs'],
    ['y', 'Clinched division'],
    ['z', 'Clinched conference'],
    ['p', 'Presidents’ Trophy'],
    ['e', 'Eliminated'],
    ['RW', 'Regulation wins'],
    ['ROW', 'Regulation + OT wins'],
];

/** Key for the letters next to teams and the tiebreaker columns, plus how sorting works. */
function Legend() {
    return (
        <View style={st.key}>
            <View style={st.keyRow}>
                {LEGEND.map(([code, label]) => (
                    <View key={code} style={st.keyItem}>
                        <T style={[type.small, st.keyCode]}>{code}</T>
                        <T muted style={type.small}>{label}</T>
                    </View>
                ))}
            </View>
            <T muted style={type.small}>Tap a column title to sort by it; tap again to flip the order.</T>
        </View>
    );
}

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
    const Arrow = sort.desc ? ArrowDownRight : ArrowUpRight; // 45° like the movement arrows
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${col.title}`}
            hitSlop={6}
            onPress={() => onSort(col.key)}
            style={[st.hCell, {width: col.width}]}>
            {active ? <Arrow size={12} color={colors.text}/> : null}
            <T numberOfLines={1} style={[type.col, active && st.hActive]}>{col.title}</T>
        </Pressable>
    );
});

function StatCells({row}) {
    const {colors} = useAppTheme();
    return COLUMNS.map((c) => {
        const v = c.value(row);
        const text = c.text ? c.text(row) : v == null ? '–' : String(v);
        let color;
        if (c.signedColor && v) color = v > 0 ? colors.positive : colors.live;
        if (c.streak && row.streakCode) color = row.streakCode === 'W' ? colors.positive : row.streakCode === 'L' ? colors.live : colors.warning;
        return (
            <T key={c.key} color={color} numberOfLines={1} style={[c.bold ? st.bold : type.value, shared.num, {width: c.width}]}>
                {text}
            </T>
        );
    });
}

const TableSection = memo(function TableSection({section, sort, onSort, fav, onTeamPress, showCut}) {
    const {colors, teamColor} = useAppTheme();
    // Old Rinkside: the favourite team's row gets a 2px team-colour line above and below.
    const favBorder = (abbrev) => (fav && abbrev === fav ? {borderColor: teamColor(abbrev)} : null);
    const cutIdx = showCut && section.cutAfter != null && section.rows.length > section.cutAfter ? section.cutAfter : -1;
    return (
        <View style={st.section}>
            {section.title ? <T variant="body" style={st.sectionTitle}>{section.title}</T> : null}
            <View style={st.split}>
                {/* Fixed team column */}
                <View style={[st.fixed, {backgroundColor: colors.background}]}>
                    <View style={st.hRow}>
                        <T style={[type.col, {paddingLeft: 10}]}>TEAM</T>
                    </View>
                    {section.rows.map((r, i) => {
                        const a = abbrevOf(r);
                        const isFav = fav && a === fav;
                        return (
                            <React.Fragment key={a ?? i}>
                                {i === cutIdx ? <View style={[st.cutSpacer, {borderColor: colors.live}]}/> : null}
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`${a}, ${r.points ?? 0} points`}
                                    onPress={() => {
                                        tap();
                                        onTeamPress(a);
                                    }}
                                    style={({pressed}) => [
                                        st.cell,
                                        isFav && favBorder(a),
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
                        <View style={[st.hRow, st.statsRow]}>
                            {COLUMNS.map((c) => <HeaderCell key={c.key} col={c} sort={sort} onSort={onSort}/>)}
                        </View>
                        {section.rows.map((r, i) => {
                            const a = abbrevOf(r);
                            return (
                                <React.Fragment key={a ?? i}>
                                    {i === cutIdx ? <View style={[st.cutSpacer, {borderColor: colors.live}]}/> : null}
                                    <Pressable
                                        onPress={() => {
                                            tap();
                                            onTeamPress(a);
                                        }}
                                        style={({pressed}) => [st.statsRow, st.cellRight, favBorder(a), pressed && {opacity: 0.6}]}>
                                        <StatCells row={r}/>
                                    </Pressable>
                                </React.Fragment>
                            );
                        })}
                    </View>
                </ScrollView>
            </View>
            {cutIdx >= 0 ? (
                <T muted style={[type.small, st.cutNote]}>Dashed line: playoff cut (the top two wild cards make it)</T>
            ) : null}
        </View>
    );
});

/** Standings tables. rows: api-web standings rows. Memoised: the full table isn't virtualised. */
export default memo(function StandingsView({rows, fav, onTeamPress, refreshControl, listRef}) {
    const {colors} = useAppTheme();
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
                {/* Only when the user has re-sorted: what it's sorted by and a way back. */}
                {!isDefault ? (
                    <View style={st.legend}>
                        <View style={st.sortedBy}>
                            <T muted style={type.small}>{`Sorted by ${COL_BY_KEY[sort.key]?.title}`}</T>
                            {sort.desc ? <ArrowDownRight size={12} color={colors.textSecondary}/> : <ArrowUpRight size={12} color={colors.textSecondary}/>}
                        </View>
                        <Pressable accessibilityRole="button" accessibilityLabel="Reset sort to points" hitSlop={14} onPress={() => {
                            tap();
                            setSort(DEFAULT_SORT);
                        }}>
                            <T style={[type.small, {textDecorationLine: 'underline'}]}>Reset</T>
                        </Pressable>
                    </View>
                ) : null}
            </View>
            {sections.map((s) => (
                <TableSection key={s.key} section={s} sort={sort} onSort={onSort} fav={fav} onTeamPress={onTeamPress} showCut={isDefault}/>
            ))}
            {view === 'wildcard' && !isDefault ? (
                <T muted style={[type.small, shared.note]}>Reset the sort to see the wild-card line.</T>
            ) : null}
            <Legend/>
        </ScrollView>
    );
});

const st = StyleSheet.create({
    sortedBy: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4},
    key: {marginTop: 20, marginHorizontal: GUTTER, gap: 10},
    keyRow: {flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 8},
    keyItem: {flexDirection: 'row', alignItems: 'center', gap: 6},
    keyCode: {fontFamily: 'Sora_700Bold'},
    section: {marginTop: 10, marginHorizontal: GUTTER},
    sectionTitle: {marginVertical: 10},
    // Plain rows straight on the page background, no card and no hairlines.
    split: {flexDirection: 'row', overflow: 'hidden'},
    fixed: {width: TEAM_W, zIndex: 1},
    hRow: {height: 32, justifyContent: 'center'},
    hActive: {opacity: 1},
    statsRow: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10},
    hCell: {flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2},
    bold: {fontFamily: 'Sora_600SemiBold', fontSize: 16, lineHeight: 22},
    cell: {
        height: ROW_H,
        justifyContent: 'center',
        paddingLeft: 2,
        borderTopWidth: 2,
        borderBottomWidth: 2,
        borderColor: 'transparent',
    },
    cellRight: {height: ROW_H, borderTopWidth: 2, borderBottomWidth: 2, borderColor: 'transparent'},
    cutSpacer: {height: 0, borderTopWidth: 2, borderStyle: 'dashed'},
    cutNote: {paddingTop: 6},
    legend: {flexDirection: 'row', alignItems: 'center', gap: 10},
});
