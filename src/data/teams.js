// Team metadata. `primary` is used for light mode / header backgrounds, `dark` is a
// brand colour that stays readable on a near-black background.
// Colours are chosen from each team's brand palette so no two teams look alike in either mode
// (every pair differs by CIEDE2000 ≥ 4.4); some teams use a secondary brand colour for that reason.
const TEAMS = [
    {abbrev: 'ANA', name: 'Anaheim Ducks', primary: '#F47A38', dark: '#FF8D4A', conference: 'Western', division: 'Pacific'},
    {abbrev: 'BOS', name: 'Boston Bruins', primary: '#E6A300', dark: '#FFDB47', conference: 'Eastern', division: 'Atlantic'},
    {abbrev: 'BUF', name: 'Buffalo Sabres', primary: '#002072', dark: '#8A90F6', conference: 'Eastern', division: 'Atlantic'},
    {abbrev: 'CGY', name: 'Calgary Flames', primary: '#C19318', dark: '#F1BE48', conference: 'Western', division: 'Pacific'},
    {abbrev: 'CAR', name: 'Carolina Hurricanes', primary: '#CC0000', dark: '#E32A14', conference: 'Eastern', division: 'Metropolitan'},
    {abbrev: 'CHI', name: 'Chicago Blackhawks', primary: '#CF0A2C', dark: '#F94349', conference: 'Western', division: 'Central'},
    {abbrev: 'COL', name: 'Colorado Avalanche', primary: '#6F263D', dark: '#AE5F74', conference: 'Western', division: 'Central'},
    {abbrev: 'CBJ', name: 'Columbus Blue Jackets', primary: '#002654', dark: '#8898D2', conference: 'Eastern', division: 'Metropolitan'},
    {abbrev: 'DAL', name: 'Dallas Stars', primary: '#006847', dark: '#419772', conference: 'Western', division: 'Central'},
    {abbrev: 'DET', name: 'Detroit Red Wings', primary: '#9B0002', dark: '#E12D33', conference: 'Eastern', division: 'Atlantic'},
    {abbrev: 'EDM', name: 'Edmonton Oilers', primary: '#E43200', dark: '#FF611C', conference: 'Western', division: 'Pacific'},
    {abbrev: 'FLA', name: 'Florida Panthers', primary: '#A38247', dark: '#E1BD7F', conference: 'Eastern', division: 'Atlantic'},
    {abbrev: 'LAK', name: 'Los Angeles Kings', primary: '#A2AAAD', dark: '#757575', conference: 'Western', division: 'Pacific'},
    {abbrev: 'MIN', name: 'Minnesota Wild', primary: '#154734', dark: '#4E806A', conference: 'Western', division: 'Central'},
    {abbrev: 'MTL', name: 'Montréal Canadiens', primary: '#7E000B', dark: '#FD6967', conference: 'Eastern', division: 'Atlantic'},
    {abbrev: 'NSH', name: 'Nashville Predators', primary: '#FFB81C', dark: '#FFB81C', conference: 'Western', division: 'Central'},
    {abbrev: 'NJD', name: 'New Jersey Devils', primary: '#E83438', dark: '#898989', conference: 'Eastern', division: 'Metropolitan'},
    {abbrev: 'NYI', name: 'New York Islanders', primary: '#00539B', dark: '#4275C1', conference: 'Eastern', division: 'Metropolitan'},
    {abbrev: 'NYR', name: 'New York Rangers', primary: '#0038A8', dark: '#5E69E3', conference: 'Eastern', division: 'Metropolitan'},
    {abbrev: 'OTT', name: 'Ottawa Senators', primary: '#8A6931', dark: '#CBA468', conference: 'Eastern', division: 'Atlantic'},
    {abbrev: 'PHI', name: 'Philadelphia Flyers', primary: '#F74902', dark: '#F74902', conference: 'Eastern', division: 'Metropolitan'},
    {abbrev: 'PIT', name: 'Pittsburgh Penguins', primary: '#181818', dark: '#9B9B9B', conference: 'Eastern', division: 'Metropolitan'},
    {abbrev: 'SJS', name: 'San Jose Sharks', primary: '#006D75', dark: '#288189', conference: 'Western', division: 'Pacific'},
    {abbrev: 'SEA', name: 'Seattle Kraken', primary: '#03192B', dark: '#7789A1', conference: 'Western', division: 'Pacific'},
    {abbrev: 'STL', name: 'St. Louis Blues', primary: '#FFCB34', dark: '#797FE5', conference: 'Western', division: 'Central'},
    {abbrev: 'TBL', name: 'Tampa Bay Lightning', primary: '#23397C', dark: '#6672BD', conference: 'Eastern', division: 'Atlantic'},
    {abbrev: 'TOR', name: 'Toronto Maple Leafs', primary: '#00144C', dark: '#7C81CA', conference: 'Eastern', division: 'Atlantic'},
    {abbrev: 'UTA', name: 'Utah Mammoth', primary: '#69B3E7', dark: '#69B3E7', conference: 'Western', division: 'Central'},
    {abbrev: 'VAN', name: 'Vancouver Canucks', primary: '#00843D', dark: '#08873F', conference: 'Western', division: 'Pacific'},
    {abbrev: 'VGK', name: 'Vegas Golden Knights', primary: '#B4975A', dark: '#B4975A', conference: 'Western', division: 'Pacific'},
    {abbrev: 'WSH', name: 'Washington Capitals', primary: '#AF001D', dark: '#5F7FD0', conference: 'Eastern', division: 'Metropolitan'},
    {abbrev: 'WPG', name: 'Winnipeg Jets', primary: '#00173A', dark: '#6775A1', conference: 'Western', division: 'Central'},
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
