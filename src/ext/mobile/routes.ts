import type { Router } from 'framework7/types';

import { isUserLogined, isUserUnlocked } from '@/lib/userstate.ts';

import { installBusinessHeader } from '@/ext/shared/business.ts';

import SellPage from './SellPage.vue';
import SalesHistoryPage from './SalesHistoryPage.vue';
import BusinessPage from './BusinessPage.vue';
import CustomersPage from './CustomersPage.vue';
import CustomerPage from './CustomerPage.vue';

// Every request of the mobile app carries the business being worked in, as in the desktop app, so staff and managers
// see their employer's books here too. This file is loaded with the mobile router, before the app makes any request.
installBusinessHeader();

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

function page(path: string, component: unknown): Router.RouteParameters {
    return {
        path,
        async({ resolve }) {
            resolve({ component });
        },
        beforeEnter: [checkLogin]
    };
}

/** Pages of the ext module in the mobile app, spread into the routes of src/router/mobile.ts (one line). */
export const extMobileRoutes: Router.RouteParameters[] = [
    page('/ext/sell', SellPage),
    page('/ext/sales', SalesHistoryPage),
    page('/ext/customers', CustomersPage),
    page('/ext/customer', CustomerPage),
    page('/ext/business', BusinessPage)
];
