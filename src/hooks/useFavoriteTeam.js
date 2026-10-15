import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {getTeam, migrateTeamAbbrev} from '../data/teams';

const KEY = 'team';
const Ctx = createContext(null);

export function FavoriteTeamProvider({children}) {
    const [team, setTeamState] = useState(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem(KEY)
            .then((v) => {
                if (!v) return;
                const migrated = migrateTeamAbbrev(v);
                if (migrated !== v) AsyncStorage.setItem(KEY, migrated).catch(() => {});
                if (getTeam(migrated)) setTeamState(migrated);
            })
            .catch(() => {})
            .finally(() => setReady(true));
    }, []);

    const setTeam = useCallback((abbrev) => {
        setTeamState(abbrev);
        AsyncStorage.setItem(KEY, abbrev).catch(() => {});
    }, []);

    const value = useMemo(() => ({team, setTeam, ready}), [team, setTeam, ready]);
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** {team: 'NYI' | null, setTeam(abbrev), ready} */
export function useFavoriteTeam() {
    return useContext(Ctx);
}
