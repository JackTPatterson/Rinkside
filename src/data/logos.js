// Bundled logos (fast, offline). Teams without a bundled logo fall back to the NHL CDN SVG.
export const LOCAL_LOGOS = {
    ANA: require('../../assets/ANA_light.png'),
    ARI: require('../../assets/ARI_light.png'),
    BOS: require('../../assets/BOS_light.png'),
    BUF: require('../../assets/BUF_light.png'),
    CGY: require('../../assets/CGY_light.png'),
    CAR: require('../../assets/CAR_light.png'),
    CHI: require('../../assets/CHI_light.png'),
    COL: require('../../assets/COL_light.png'),
    CBJ: require('../../assets/CBJ_light.png'),
    DAL: require('../../assets/DAL_light.png'),
    DET: require('../../assets/DET_light.png'),
    EDM: require('../../assets/EDM_light.png'),
    FLA: require('../../assets/FLA_light.png'),
    LAK: require('../../assets/LAK_light.png'),
    MIN: require('../../assets/MIN_light.png'),
    MTL: require('../../assets/MTL_light.png'),
    NSH: require('../../assets/NSH_light.png'),
    NJD: require('../../assets/NJD_light.png'),
    NYI: require('../../assets/NYI_light.png'),
    NYR: require('../../assets/NYR_light.png'),
    OTT: require('../../assets/OTT_light.png'),
    PHI: require('../../assets/PHI_light.png'),
    PIT: require('../../assets/PIT_light.png'),
    STL: require('../../assets/STL_light.png'),
    SJS: require('../../assets/SJS_light.png'),
    SEA: require('../../assets/SEA_light.png'),
    TBL: require('../../assets/TBL_light.png'),
    TOR: require('../../assets/TOR_light.png'),
    VAN: require('../../assets/VAN_light.png'),
    VGK: require('../../assets/VGK_light.png'),
    WSH: require('../../assets/WSH_light.png'),
    WPG: require('../../assets/WPG_light.png'),
};

export function remoteLogoUrl(abbrev, dark = false) {
    return `https://assets.nhle.com/logos/nhl/svg/${abbrev}_${dark ? 'dark' : 'light'}.svg`;
}
