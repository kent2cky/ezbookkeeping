<template>
    <f7-page @page:afterin="loadAccess">
        <f7-navbar :title="tt('Business')" :back-link="tt('Back')"></f7-navbar>

        <f7-list strong inset dividers class="margin-top" v-if="available">
            <f7-list-item link="#" :title="tt('Sales')" @click="openBusinessScreen('/ext/sales')">
                <template #media><f7-icon f7="cart"></f7-icon></template>
            </f7-list-item>
            <f7-list-item link="#" :title="tt('Customers')" @click="openBusinessScreen('/ext/customers')">
                <template #media><f7-icon f7="person_2"></f7-icon></template>
            </f7-list-item>
            <f7-list-item link="#" :title="tt('Inventory')" @click="openBusinessScreen('/ext/inventory')">
                <template #media><f7-icon f7="cube_box"></f7-icon></template>
            </f7-list-item>
            <f7-list-item link="#" :title="tt('Reports')" @click="openBusinessScreen('/ext/reports')" v-if="canManage">
                <template #media><f7-icon f7="chart_bar"></f7-icon></template>
            </f7-list-item>
        </f7-list>

        <f7-list strong inset dividers :class="{ 'margin-top': !available }">
            <f7-list-item link="#" :title="tt('Team')" @click="openBusinessScreen('/ext/team')" v-if="teamAvailable">
                <template #media><f7-icon f7="person_3"></f7-icon></template>
            </f7-list-item>
            <f7-list-item link="#" :title="tt('Business Features')" @click="openBusinessScreen('/settings/business')">
                <template #media><f7-icon f7="building_2"></f7-icon></template>
            </f7-list-item>
        </f7-list>
    </f7-page>
</template>

<script setup lang="ts">
import { useExtI18n } from '@/ext/shared/i18n.ts';
import { openBusinessScreen } from '@/ext/shared/mobileBridge.ts';
import { useMobileBusinessAccess } from './businessAccess.ts';

// The page behind the Business tab. The screens open in the desktop app, which is laid out for phones too
// (see src/ext/shared/mobileBridge.ts).
const { tt } = useExtI18n();
const { available, teamAvailable, canManage, loadAccess } = useMobileBusinessAccess();
</script>
