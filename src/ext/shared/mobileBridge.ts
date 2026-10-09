import { getDesktopVersionPath, getMobileVersionPath } from '@/lib/version.ts';

// The business screens (sales, customers, inventory, reports, team) exist only in the desktop app, which is laid out
// to work on a phone too. The mobile app, which is what an installed app (PWA) on a phone opens, links to them; this
// marker tells the desktop app that the person came from the mobile app, so it can offer the way back.
const FROM_MOBILE_KEY = 'ebk_ext_from_mobile';

/** Opens a business screen of the desktop app from the mobile app. `path` is a desktop route such as "/ext/sales". */
export function openBusinessScreen(path: string): void {
    try {
        sessionStorage.setItem(FROM_MOBILE_KEY, '1');
    } catch {
        // without storage the desktop app simply does not show the way back
    }

    window.location.assign(getDesktopVersionPath() + path.replace(/^\//, ''));
}

/** Whether the desktop app was opened from the mobile app in this window. */
export function cameFromMobileApp(): boolean {
    try {
        return sessionStorage.getItem(FROM_MOBILE_KEY) === '1';
    } catch {
        return false;
    }
}

/** Returns to the mobile app. */
export function backToMobileApp(): void {
    try {
        sessionStorage.removeItem(FROM_MOBILE_KEY);
    } catch {
        // nothing to clear
    }

    window.location.replace(getMobileVersionPath());
}
