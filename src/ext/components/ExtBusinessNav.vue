<template>
    <li class="nav-section-title">
        <div class="title-wrapper">
            <span class="title-text">{{ tt('Business') }}</span>
        </div>
    </li>
    <li class="nav-link ext-sell-link">
        <v-btn block color="primary" variant="flat" size="large" to="/ext/sales" :prepend-icon="mdiCartPlus">
            {{ tt('Sell') }}
        </v-btn>
    </li>
    <li class="nav-link">
        <router-link to="/ext/customers">
            <v-icon class="nav-item-icon" :icon="mdiAccountCashOutline"/>
            <span class="nav-item-title">{{ tt('Customers') }}</span>
        </router-link>
    </li>
    <li class="nav-link">
        <router-link to="/ext/inventory">
            <v-icon class="nav-item-icon" :icon="mdiPackageVariantClosed"/>
            <span class="nav-item-title">{{ tt('Inventory') }}</span>
        </router-link>
    </li>
    <li class="nav-link" v-if="canManage">
        <router-link to="/ext/reports">
            <v-icon class="nav-item-icon" :icon="mdiChartBoxOutline"/>
            <span class="nav-item-title">{{ tt('Reports') }}</span>
        </router-link>
    </li>
</template>

<script setup lang="ts">
import { useExtI18n } from '@/ext/shared/i18n.ts';
import { useBusiness } from '@/ext/business.ts';

import { mdiAccountCashOutline, mdiCartPlus, mdiChartBoxOutline, mdiPackageVariantClosed } from '@mdi/js';

const { tt } = useExtI18n();
const { canManage } = useBusiness();
</script>

<style>
.ext-sell-link {
    padding-block: 0.5rem;
}
</style>
