// Lets Node import the app's Metro-style modules unchanged:
//  - extensionless / directory imports ('../../analytics', './client') resolve to .js / index.js
//  - '@react-native-async-storage/async-storage' maps to an in-memory no-op shim
// Must be imported before any app module is loaded (the main script uses dynamic import()).
import {registerHooks} from 'node:module';

const SHIMS = {
    '@react-native-async-storage/async-storage': new URL('./async-storage-shim.mjs', import.meta.url).href,
};

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (SHIMS[specifier]) return {url: SHIMS[specifier], shortCircuit: true};
        try {
            return nextResolve(specifier, context);
        } catch (e) {
            const relative = specifier.startsWith('.') || specifier.startsWith('/');
            if (!relative || !['ERR_MODULE_NOT_FOUND', 'ERR_UNSUPPORTED_DIR_IMPORT'].includes(e?.code)) throw e;
            for (const candidate of [`${specifier}.js`, `${specifier}/index.js`]) {
                try {
                    return nextResolve(candidate, context);
                } catch {
                    // try the next candidate
                }
            }
            throw e;
        }
    },
});
