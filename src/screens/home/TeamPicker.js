import React, {memo, useCallback, useMemo} from 'react';
import {Modal, Platform, Pressable, SectionList, StyleSheet, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {CloseCircle, TickCircle} from '../../components/icons';
import {T, TeamLogo, tap} from '../../components/ui';
import TEAMS from '../../data/teams';
import {useAppTheme} from '../../theme';

const SECTIONS = ['Atlantic', 'Metropolitan', 'Central', 'Pacific'].map((division) => ({
    title: division,
    data: TEAMS.filter((t) => t.division === division).sort((a, b) => a.name.localeCompare(b.name)),
}));

const TeamOption = memo(function TeamOption({team, selected, onSelect}) {
    const {colors, teamColor} = useAppTheme();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{selected}}
            onPress={() => onSelect(team.abbrev)}
            style={({pressed}) => [styles.row, {backgroundColor: colors.card}, pressed && {opacity: 0.6}]}>
            <View style={[styles.stripe, {backgroundColor: teamColor(team.abbrev)}]}/>
            <TeamLogo abbrev={team.abbrev} size={30}/>
            <T variant="body" style={styles.flex} numberOfLines={1}>{team.name}</T>
            {selected ? <TickCircle size={20} color={teamColor(team.abbrev)} variant="Bold"/> : null}
        </Pressable>
    );
});

/** Native page-sheet team switcher (swipe down to dismiss on iOS). */
function TeamPicker({visible, current, onSelect, onClose, title = 'Select a team'}) {
    const {colors} = useAppTheme();
    const select = useCallback((abbrev) => {
        tap();
        onSelect(abbrev);
        onClose();
    }, [onSelect, onClose]);
    const renderItem = useCallback(
        ({item}) => <TeamOption team={item} selected={item.abbrev === current} onSelect={select}/>,
        [current, select],
    );
    const extra = useMemo(() => ({current}), [current]);
    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
            onRequestClose={onClose}>
            <SafeAreaView edges={Platform.OS === 'ios' ? [] : ['top']} style={[styles.flex, {backgroundColor: colors.background}]}>
                <View style={styles.header}>
                    <T variant="title" style={styles.flex}>{title}</T>
                    <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={onClose}>
                        <CloseCircle size={26} color={colors.textSecondary}/>
                    </Pressable>
                </View>
                <SectionList
                    sections={SECTIONS}
                    extraData={extra}
                    keyExtractor={(t) => t.abbrev}
                    renderItem={renderItem}
                    renderSectionHeader={({section}) => (
                        <T variant="label" muted style={[styles.sectionTitle, {backgroundColor: colors.background}]}>{section.title}</T>
                    )}
                    ItemSeparatorComponent={Separator}
                    contentContainerStyle={styles.list}
                    stickySectionHeadersEnabled
                />
            </SafeAreaView>
        </Modal>
    );
}

function Separator() {
    return <View style={styles.sep}/>;
}

export default memo(TeamPicker);

const styles = StyleSheet.create({
    flex: {flex: 1},
    header: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8},
    list: {paddingHorizontal: 16, paddingBottom: 40},
    sectionTitle: {paddingTop: 16, paddingBottom: 8},
    row: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingRight: 14, borderRadius: 14, overflow: 'hidden'},
    stripe: {width: 4, alignSelf: 'stretch', borderRadius: 2},
    sep: {height: 6},
});
