import Constants from 'expo-constants';
import {openBrowserAsync} from 'expo-web-browser';
import {Linking} from 'react-native';

export const APP_VERSION = Constants.expoConfig?.version ?? null;

export const DEVELOPER = {name: 'Jack Patterson', email: 'jtpatt03@gmail.com'};

export const LINKS = {
    nhl: 'https://www.nhl.com',
    nhlApi: 'https://api-web.nhle.com',
    moneypuck: 'https://moneypuck.com',
    moneypuckData: 'https://moneypuck.com/data.htm',
};

export const MONEYPUCK_LOGO = 'https://peter-tanner.com/moneypuck/logos/moneypucklogo.png';

/** Opens a URL in the in-app browser, falling back to the system handler. */
export function openLink(url) {
    return openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => {}));
}

export function emailDeveloper() {
    return Linking.openURL(`mailto:${DEVELOPER.email}?subject=Rinkside`).catch(() => {});
}
