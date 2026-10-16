// Where to watch, from the NHL feeds' `tvBroadcasts`: [{network, market: 'N' | 'H' | 'A', countryCode}].

const COUNTRY = {US: 'United States', CA: 'Canada'};

/** The viewer's country from the device locale ("en-CA" → "CA"); US when unknown. */
export function viewerCountry() {
    try {
        const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
        const region = locale.split(/[-_]/).find((p, i) => i > 0 && /^[A-Z]{2}$/.test(p));
        return region === 'CA' ? 'CA' : 'US';
    } catch {
        return 'US';
    }
}

const uniq = (list) => [...new Set(list)];
const sorted = (list) => [...(list ?? [])].filter((b) => b?.network).sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0));

/**
 * Full where-to-watch list, grouped: national channels per country (viewer's country first), then
 * each team's local channels. [{key, title, networks: string[]}].
 */
export function watchGroups(broadcasts, {home, away}, country = viewerCountry()) {
    const list = sorted(broadcasts);
    const countries = uniq(list.filter((b) => b.market === 'N').map((b) => b.countryCode))
        .sort((a, b) => (a === country ? -1 : b === country ? 1 : 0));
    const groups = countries.map((c) => ({
        key: `N-${c}`,
        title: `National · ${COUNTRY[c] ?? c}`,
        networks: uniq(list.filter((b) => b.market === 'N' && b.countryCode === c).map((b) => b.network)),
    }));
    for (const [market, abbrev] of [['H', home], ['A', away]]) {
        const networks = uniq(list.filter((b) => b.market === market).map((b) => b.network));
        if (networks.length) groups.push({key: market, title: `${abbrev} local`, networks});
    }
    return groups;
}
