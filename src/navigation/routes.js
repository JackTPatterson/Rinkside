// Route names shared by every screen. Detail screens live on the root stack so any tab can open them.
export const ROUTES = {
    onboarding: 'Onboarding',
    tabs: 'Tabs',
    // tabs
    home: 'Home',
    scores: 'Scores',
    standings: 'Standings',
    players: 'Players',
    settings: 'Settings',
    // root-stack detail screens
    game: 'Game', //     params: {gameId, game?}  game = score-feed object for instant first paint
    recap: 'Recap', //   params: {gameId, home, away}
    player: 'Player', // params: {playerId, name?}
    team: 'Team', //     params: {abbrev}         a team's page (same screen as Home, any team)
    favoriteTeam: 'FavoriteTeam',
    about: 'About',
    methodology: 'Methodology',
    video: 'Video', //   params: {videoId, title?, webUrl?}  in-app NHL video player (full-screen modal)
};
