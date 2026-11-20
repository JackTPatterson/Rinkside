// Deep links opened from widgets and Live Activities: rinkside://game/<id>, rinkside://standings.
// Pure so it can be unit-tested; App.js turns the result into a navigation call.

/** {type: 'game', gameId: number} | {type: 'standings'} | null */
export function parseWidgetUrl(url) {
    const m = /^rinkside:\/\/(?:\/)?([a-z]+)(?:\/(\d+))?\/?(?:[?#].*)?$/i.exec(String(url ?? '').trim());
    if (!m) return null;
    const [, host, id] = m;
    if (host.toLowerCase() === 'game' && id) return {type: 'game', gameId: Number(id)};
    if (host.toLowerCase() === 'standings') return {type: 'standings'};
    return null;
}
