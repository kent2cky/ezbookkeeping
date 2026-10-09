import type { Router } from 'framework7/types';

import { isUserLogined, isUserUnlocked } from '@/lib/userstate.ts';

import BusinessPage from './BusinessPage.vue';

// Same rule as the mobile app's own pages: be logged in and unlocked
function checkLogin({ router, resolve, reject }: { router: Router.Router, resolve: () => void, reject: () => void }): void {
    if (!isUserLogined() || !isUserUnlocked()) {
        reject();
        router.navigate(isUserLogined() ? '/unlock' : '/login', {
            clearPreviousHistory: true,
            browserHistory: false
        });
        return;
    }

    resolve();
}

/** Pages of the ext module in the mobile app, spread into the routes of src/router/mobile.ts (one line). */
export const extMobileRoutes: Router.RouteParameters[] = [
    {
        path: '/ext/business',
        async({ resolve }) {
            resolve({ component: BusinessPage });
        },
        beforeEnter: [checkLogin]
    }
];
