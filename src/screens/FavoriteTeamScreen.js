import React, {useCallback, useRef} from 'react';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {BackButton, Header, Screen} from '../components/ui';
import {useFavoriteTeam} from '../hooks/useFavoriteTeam';
import TeamPicker from './settings/TeamPicker';

/** Change the favourite team: saves on tap and returns to Settings. */
export default function FavoriteTeamScreen({navigation}) {
    const {team, setTeam} = useFavoriteTeam();
    const insets = useSafeAreaInsets();

    // A quick double tap must not pop twice (the second goBack would act on the tabs).
    const done = useRef(false);
    const onSelect = useCallback((abbrev) => {
        if (done.current) return;
        done.current = true;
        if (abbrev !== team) setTeam(abbrev);
        if (navigation.canGoBack()) navigation.goBack();
    }, [team, setTeam, navigation]);

    return (
        <Screen>
            <Header
                title="Favourite team"
                subtitle="Your team drives the My Team tab"
                left={<BackButton onPress={() => navigation.goBack()}/>}
            />
            <TeamPicker selected={team} onSelect={onSelect} bottomInset={insets.bottom}/>
        </Screen>
    );
}
