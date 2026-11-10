import React, {useCallback, useEffect, useState} from 'react';
import {Switch} from 'react-native';
import {Flash} from '../../components/icons';
import {tap} from '../../components/ui';
import {useAppTheme} from '../../theme';
import {widgetModules} from '../../widgets';
import {getLiveActivityEnabled, setLiveActivityEnabled, syncLiveActivity} from '../../widgets/liveActivity';
import {SettingsRow} from './SettingsRow';

/** Switch for the game Live Activity. Renders nothing where widgets aren't available (Expo Go, Android, web). */
export default function LiveActivityRow() {
    const {colors} = useAppTheme();
    const modules = widgetModules();
    const [on, setOn] = useState(true);

    useEffect(() => {
        let alive = true;
        getLiveActivityEnabled().then((v) => alive && setOn(v));
        return () => {
            alive = false;
        };
    }, []);

    const toggle = useCallback((next) => {
        tap();
        setOn(next);
        setLiveActivityEnabled(next);
        // Switching off takes effect now, not at the next 30 s poll.
        if (!next) syncLiveActivity(modules?.gameActivity, null, false);
    }, [modules]);

    if (!modules) return null;
    return (
        <SettingsRow
            icon={Flash}
            title="Game Live Activity"
            subtitle="Show your team's live score on the Lock Screen and Dynamic Island during games."
            right={<Switch value={on} onValueChange={toggle} trackColor={{true: colors.accent}} accessibilityLabel="Game Live Activity"/>}
        />
    );
}
