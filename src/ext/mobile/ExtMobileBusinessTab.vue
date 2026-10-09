<template>
    <f7-link class="link" href="/ext/sell" :aria-label="tt('Sell')" v-if="teamAvailable">
        <f7-icon f7="cart" aria-hidden="true"></f7-icon>
        <span class="tabbar-label">{{ tt('Sell') }}</span>
    </f7-link>

    <ext-mobile-terms-gate />
</template>

<script setup lang="ts">
import ExtMobileTermsGate from './ExtMobileTermsGate.vue';

import { onMounted } from 'vue';
import { f7ready } from 'framework7-vue';

import { useExtI18n } from '@/ext/shared/i18n.ts';
import { useBusiness } from '@/ext/shared/business.ts';
import { useBusinessFeatures } from '@/ext/shared/features.ts';
import { takeReopenSell } from './sale.ts';

// Tab of the mobile home page's bottom bar, shown only to people who use the business features. It opens the Sell
// screen, from which customers, inventory, reports and the team are one tap away. The home page also carries the
// Terms gate, so people who only use the phone are asked too.
const { tt } = useExtI18n();
const { ensureLoaded } = useBusiness();
const { teamAvailable, loadFeatureSetting } = useBusinessFeatures();

onMounted(() => {
    // back to selling after switching business (the app restarted on the home page)
    if (takeReopenSell()) {
        f7ready(f7 => f7.views.main?.router.navigate('/ext/sell'));
    }

    ensureLoaded().catch(() => {
        // without the list the tab follows the feature setting alone
    });

    loadFeatureSetting().catch(() => {
        // the tab then follows the last known answer
    });
});
</script>
