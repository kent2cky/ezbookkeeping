<template>
    <div class="ext-mobile-return d-flex align-center px-2 py-1" v-if="fromMobileApp">
        <v-btn size="small" variant="text" color="primary" :prepend-icon="mdiArrowLeft" @click="backToMobileApp">
            {{ tt('Back to the app') }}
        </v-btn>
    </div>

    <div class="ext-business-banner d-flex align-center flex-wrap ga-2 px-4 py-2" role="status" v-if="workingForSomeoneElse && current">
        <v-icon :icon="mdiAlertOutline" size="22" />
        <span class="font-weight-medium">
            {{ tt('ext.banner', { name: current.name, role: roleLabel(current.role) }) }}
        </span>
        <v-spacer />
        <v-btn size="small" variant="flat" color="white" @click="backToOwn" v-if="own">
            {{ tt('Switch back to my business') }}
        </v-btn>
    </div>

    <ext-terms-gate />
</template>

<script setup lang="ts">
import ExtTermsGate from '@/ext/components/ExtTermsGate.vue';

import { useExtI18n } from '@/ext/shared/i18n.ts';
import { installBusinessHeader, switchBusiness, useBusiness } from '@/ext/shared/business.ts';
import { cameFromMobileApp, backToMobileApp } from '@/ext/shared/mobileBridge.ts';

import { mdiAlertOutline, mdiArrowLeft } from '@mdi/js';

const { tt, roleLabel } = useExtI18n();
const { own, current, workingForSomeoneElse, ensureLoaded } = useBusiness();

// the business screens are opened from the mobile app (installed app on a phone); this is the way back to it
const fromMobileApp = cameFromMobileApp();

installBusinessHeader();
ensureLoaded().catch(() => {
    // without the list there is nothing to show; the app keeps working on the person's own business
});

function backToOwn(): void {
    if (own.value) {
        switchBusiness(own.value.ownerUid);
    }
}
</script>

<style scoped>
.ext-business-banner {
    position: sticky;
    top: 0;
    z-index: 1200;
    background: rgb(var(--v-theme-warning));
    color: rgb(var(--v-theme-on-warning));
}
.ext-mobile-return {
    background: rgb(var(--v-theme-surface));
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
