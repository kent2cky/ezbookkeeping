<template>
    <template v-if="available">
        <!-- the prominent button of the top menu; the other business screens are in the sidebar of the business pages -->
        <router-link class="d-inline-flex align-center" to="/ext/sales">
            <v-btn class="sell-button ms-2" color="primary" density="comfortable" variant="flat"
                :aria-label="tt('Sell')" :icon="true">
                <v-icon :icon="mdiCartPlus" size="22" />
                <v-tooltip activator="parent">{{ tt('Sell') }}</v-tooltip>
            </v-btn>
        </router-link>
    </template>

    <!-- always visible for people who belong to other businesses, so nobody forgets which one they are in -->
    <v-chip class="ms-3" size="small" label :color="workingForSomeoneElse ? 'warning' : undefined"
        :prepend-icon="mdiStorefrontOutline" v-if="current && working.length > 1">
        {{ tt('ext.chip', { name: current.name, role: roleLabel(current.role) }) }}
    </v-chip>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

import { useExtI18n } from '@/ext/shared/i18n.ts';
import { installBusinessHeader, useBusiness } from '@/ext/shared/business.ts';
import { useBusinessFeatures } from '@/ext/shared/features.ts';

import { mdiCartPlus, mdiStorefrontOutline } from '@mdi/js';

const { tt, roleLabel } = useExtI18n();
const { working, current, workingForSomeoneElse, ensureLoaded } = useBusiness();
const { available, loadFeatureSetting } = useBusinessFeatures();

installBusinessHeader();

onMounted(() => {
    ensureLoaded().catch(() => {
        // the app still works on the person's own business if the list cannot be loaded
    });

    loadFeatureSetting().catch(() => {
        // the menus then follow the last known answer
    });
});
</script>

<style>
.sell-button.v-btn {
    --v-btn-height: 32px;
    width: 38px;
    min-width: 38px;
    border-radius: 10px;
}
</style>
