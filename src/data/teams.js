// Team metadata. `primary` is used for light mode / header backgrounds, `dark` is a
// brand colour that stays readable on a near-black background.
const TEAMS = [
    {abbrev: 'ANA', name: 'Anaheim Ducks', primary: '#F47A38', dark: '#F47A38', conference: 'Western', division: 'Pacific'},
    {abbrev: 'BOS', name: 'Boston Bruins', primary: '#FFB81C', dark: '#FFB81C', conference: 'Eastern', division: 'Atlantic'},
    {abbrev: 'BUF', name: 'Buffalo Sabres', primary: '#002654', dark: '#FCB514', conference: 'Eastern', division: 'Atlantic'},
    {abbrev: 'CGY', name: 'Calgary Flames', primary: '#C8102E', dark: '#E8344E', conference: 'Western', division: 'Pacific'},
    {abbrev: 'CAR', name: 'Carolina Hurricanes', primary: '#CC0000', dark: '#E8343A', conference: 'Eastern', division: 'Metropolitan'},
    {abbrev: 'CHI', name: 'Chicago Blackhawks', primary: '#CF0A2C', dark: '#E8344E', conference: 'Western', division: 'Central'},
    {abbrev: 'COL', name: 'Colorado Avalanche', primary: '#6F263D', dark: '#7FA9D9', conference: 'Western', division: 'Central'},
    {abbrev: 'CBJ', name: 'Columbus Blue Jackets', primary: '#002654', dark: '#E8344E', conference: 'Eastern', division: 'Metropolitan'},
    {abbrev: 'DAL', name: 'Dallas Stars', primary: '#006847', dark: '#20B26B', conference: 'Western', division: 'Central'},
    {abbrev: 'DET', name: 'Detroit Red Wings', primary: '#CE1126', dark: '#E8344E', conference: 'Eastern', division: 'Atlantic'},
    {abbrev: 'EDM', name: 'Edmonton Oilers', primary: '#041E42', dark: '#FF4C00', conference: 'Western', division: 'Pacific'},
    {abbrev: 'FLA', name: 'Florida Panthers', primary: '#041E42', dark: '#E8344E', conference: 'Eastern', division: 'Atlantic'},
    {abbrev: 'LAK', name: 'Los Angeles Kings', primary: '#111111', dark: '#C4CBD0', conference: 'Western', division: 'Pacific'},
    {abbrev: 'MIN', name: 'Minnesota Wild', primary: '#154734', dark: '#EAAA00', conference: 'Western', division: 'Central'},
    {abbrev: 'MTL', name: 'Montréal Canadiens', primary: '#AF1E2D', dark: '#E0384A', conference: 'Eastern', division: 'Atlantic'},
    {abbrev: 'NSH', name: 'Nashville Predators', primary: '#FFB81C', dark: '#FFB81C', conference: 'Western', division: 'Central'},
    {abbrev: 'NJD', name: 'New Jersey Devils', primary: '#CE1126', dark: '#E8344E', conference: 'Eastern', division: 'Metropolitan'},
    {abbrev: 'NYI', name: 'New York Islanders', primary: '#00539B', dark: '#F47D30', conference: 'Eastern', division: 'Metropolitan'},
    {abbrev: 'NYR', name: 'New York Rangers', primary: '#0038A8', dark: '#5C8DF5', conference: 'Eastern', division: 'Metropolitan'},
    {abbrev: 'OTT', name: 'Ottawa Senators', primary: '#C52032', dark: '#E8344E', conference: 'Eastern', division: 'Atlantic'},
    {abbrev: 'PHI', name: 'Philadelphia Flyers', primary: '#F74902', dark: '#F74902', conference: 'Eastern', division: 'Metropolitan'},
    {abbrev: 'PIT', name: 'Pittsburgh Penguins', primary: '#000000', dark: '#FCB514', conference: 'Eastern', division: 'Metropolitan'},
    {abbrev: 'SJS', name: 'San Jose Sharks', primary: '#006D75', dark: '#00A3AD', conference: 'Western', division: 'Pacific'},
    {abbrev: 'SEA', name: 'Seattle Kraken', primary: '#001628', dark: '#68A2B9', conference: 'Western', division: 'Pacific'},
    {abbrev: 'STL', name: 'St. Louis Blues', primary: '#002F87', dark: '#FCB514', conference: 'Western', division: 'Central'},
    {abbrev: 'TBL', name: 'Tampa Bay Lightning', primary: '#002868', dark: '#5C8DF5', conference: 'Eastern', division: 'Atlantic'},
    {abbrev: 'TOR', name: 'Toronto Maple Leafs', primary: '#00205B', dark: '#5C8DF5', conference: 'Eastern', division: 'Atlantic'},
    {abbrev: 'UTA', name: 'Utah Mammoth', primary: '#0B0B0B', dark: '#69B3E7', conference: 'Western', division: 'Central'},
    {abbrev: 'VAN', name: 'Vancouver Canucks', primary: '#00205B', dark: '#20B26B', conference: 'Western', division: 'Pacific'},
    {abbrev: 'VGK', name: 'Vegas Golden Knights', primary: '#B4975A', dark: '#B4975A', conference: 'Western', division: 'Pacific'},
    {abbrev: 'WSH', name: 'Washington Capitals', primary: '#C8102E', dark: '#E8344E', conference: 'Eastern', division: 'Metropolitan'},
    {abbrev: 'WPG', name: 'Winnipeg Jets', primary: '#041E42', dark: '#7FA9D9', conference: 'Western', division: 'Central'},
];

// Franchises that relocated / rebranded. Old favourites are migrated, old games still render.
export const LEGACY_TEAMS = {
    ARI: {abbrev: 'ARI', name: 'Arizona Coyotes', primary: '#8C2633', dark: '#C8475A', replacedBy: 'UTA'},
};

export const TEAM_BY_ABBREV = Object.fromEntries(
    [...TEAMS, ...Object.values(LEGACY_TEAMS)].map((t) => [t.abbrev, t]),
);

export function getTeam(abbrev) {
    return TEAM_BY_ABBREV[abbrev] ?? null;
}

export function migrateTeamAbbrev(abbrev) {
    return LEGACY_TEAMS[abbrev]?.replacedBy ?? abbrev;
}

export default TEAMS;
