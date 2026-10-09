<template>
    <f7-block-title class="margin-top">{{ tt('Business') }}</f7-block-title>
    <f7-list strong inset dividers>
        <f7-list-item link="#" :title="tt('Sales')" @click="openBusinessScreen('/ext/sales')">
            <template #media><f7-icon f7="cart"></f7-icon></template>
        </f7-list-item>
        <f7-list-item link="#" :title="tt('Customers')" @click="openBusinessScreen('/ext/customers')">
            <template #media><f7-icon f7="person_2"></f7-icon></template>
        </f7-list-item>
        <f7-list-item link="#" :title="tt('Inventory')" @click="openBusinessScreen('/ext/inventory')">
            <template #media><f7-icon f7="cube_box"></f7-icon></template>
        </f7-list-item>
        <f7-list-item link="#" :title="tt('Reports')" @click="openBusinessScreen('/ext/reports')">
            <template #media><f7-icon f7="chart_bar"></f7-icon></template>
        </f7-list-item>
        <f7-list-item link="#" :title="tt('Team')" @click="openBusinessScreen('/ext/team')">
            <template #media><f7-icon f7="person_3"></f7-icon></template>
        </f7-list-item>
        <f7-list-item link="#" :title="tt('Business Features')" @click="openBusinessScreen('/settings/business')">
            <template #media><f7-icon f7="building_2"></f7-icon></template>
        </f7-list-item>
    </f7-list>
</template>

<script setup lang="ts">
import { useExtI18n } from '@/ext/shared/i18n.ts';
import { openBusinessScreen } from '@/ext/shared/mobileBridge.ts';

// Shown in the mobile app's Settings. The screens open in the desktop app (see mobileBridge.ts); while the business
// features are off, the desktop app sends the person to the Business Features setting where they can be turned on.
const { tt } = useExtI18n();
</script>
