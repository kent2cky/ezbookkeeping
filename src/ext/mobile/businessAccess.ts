import { ref, computed } from 'vue';
import axios from 'axios';

import type { ApiResponse } from '@/core/api.ts';
import { getCurrentUserInfo } from '@/lib/userstate.ts';

import type { BusinessInfo, MySettings } from '@/ext/types.ts';

// Decides whether the mobile app shows the Business tab, with the same rule as the desktop app (src/ext/features.ts):
// the business features are switched on, or the person works in somebody else's business; the team is also reachable
// with an invitation to answer. It asks the server directly instead of importing features.ts and business.ts, because
// code used by both apps must live in src/ext/shared (see scripts/check-bundle.py) and those modules are desktop code.
//
// The last answer is kept per person so the tab does not pop in while the home page loads.
const CACHE_KEY = 'ebk_ext_mobile_access';
const SELECTION_KEY = 'ebk_ext_business'; // written by the desktop business switcher (src/ext/business.ts)

interface Access {
    readonly available: boolean;
    readonly teamAvailable: boolean;
    readonly canManage: boolean;
}

const NONE: Access = { available: false, teamAvailable: false, canManage: false };

function currentUsername(): string {
    return getCurrentUserInfo()?.username ?? '';
}

function readStored<T>(key: string): T | undefined {
    try {
        return JSON.parse(localStorage.getItem(key) ?? 'null') ?? undefined;
    } catch {
        return undefined;
    }
}

function readCache(): Access {
    const username = currentUsername();
    return (username && readStored<Record<string, Access>>(CACHE_KEY)?.[username]) || NONE;
}

function writeCache(value: Access): void {
    try {
        const stored = readStored<Record<string, Access>>(CACHE_KEY) ?? {};
        stored[currentUsername()] = value;
        localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
    } catch {
        // the copy is only a convenience
    }
}

/** The business the person picked in the desktop app, '' meaning their own. */
function selectedBusiness(): string {
    const stored = readStored<{ user?: string, business?: string }>(SELECTION_KEY);
    return stored?.user && stored.user === currentUsername() ? (stored.business ?? '') : '';
}

async function get<T>(path: string): Promise<T> {
    const response = await axios.get<ApiResponse<T>>('v1/ext/' + path);
    return response.data.result;
}

const access = ref<Access>(readCache());
let loadedFor = '';

/** Asks the server once per person; later calls return at once. Failures keep the last known answer. */
async function loadAccess(): Promise<void> {
    const username = currentUsername();

    if (!username || loadedFor === username) {
        return;
    }

    try {
        const [settings, businesses] = await Promise.all([
            get<MySettings>('me/settings.json'),
            get<BusinessInfo[]>('me/businesses.json')
        ]);

        const worksForSomeoneElse = businesses.some(b => b.status === 'active');
        const available = settings.businessFeatures || worksForSomeoneElse;
        const selected = selectedBusiness();
        const role = businesses.find(b => b.ownerUid === selected && b.status === 'active')?.role ?? 'owner';

        access.value = {
            available,
            teamAvailable: available || businesses.some(b => b.status === 'pending'),
            canManage: role === 'owner' || role === 'manager'
        };

        writeCache(access.value);
        loadedFor = username;
    } catch {
        // the tab then follows the last known answer
    }
}

export function useMobileBusinessAccess() {
    if (loadedFor !== currentUsername()) {
        access.value = readCache(); // a different person may have logged in since this module was loaded
    }

    return {
        /** Sales, customers and inventory can be used. */
        available: computed<boolean>(() => access.value.available),
        /** The Business tab is shown: with the features, or with an invitation to answer. */
        teamAvailable: computed<boolean>(() => access.value.teamAvailable),
        /** Reports are for owners and managers. */
        canManage: computed<boolean>(() => access.value.canManage),
        loadAccess
    };
}
