<template>
    <f7-page>
        <f7-navbar :title="tt('Business')" :back-link="tt('Back')"></f7-navbar>

        <f7-list strong inset dividers class="margin-top" v-if="available">
            <f7-list-item link="/ext/sell" :title="tt('Sell')">
                <template #media><f7-icon f7="cart"></f7-icon></template>
            </f7-list-item>
            <f7-list-item link="/ext/sales" :title="tt('Recent sales')">
                <template #media><f7-icon f7="clock"></f7-icon></template>
            </f7-list-item>
            <f7-list-item link="/ext/customers" :title="tt('Customers')">
                <template #media><f7-icon f7="person_2"></f7-icon></template>
            </f7-list-item>
            <f7-list-item link="/ext/inventory" :title="tt('Inventory')">
                <template #media><f7-icon f7="cube_box"></f7-icon></template>
            </f7-list-item>
            <f7-list-item link="/ext/reports" :title="tt('Reports')" v-if="canManage">
                <template #media><f7-icon f7="chart_bar"></f7-icon></template>
            </f7-list-item>
        </f7-list>

        <f7-list strong inset dividers :class="{ 'margin-top': !available }">
            <f7-list-item link="/ext/team" :title="tt('Team')" v-if="teamAvailable">
                <template #media><f7-icon f7="person_3"></f7-icon></template>
                <template #after>
                    <f7-badge color="red" v-if="invitations.length > 0">{{ invitations.length }}</f7-badge>
                </template>
            </f7-list-item>
            <f7-list-item link="/ext/settings" :title="tt('Business Features')">
                <template #media><f7-icon f7="building_2"></f7-icon></template>
            </f7-list-item>
        </f7-list>
    </f7-page>
</template>

<script setup lang="ts">
import { useExtI18n } from '@/ext/shared/i18n.ts';
import { useBusiness } from '@/ext/shared/business.ts';
import { useBusinessFeatures } from '@/ext/shared/features.ts';

// Everything business in one list, opened from the Sell screen's menu
const { tt } = useExtI18n();
const { canManage, invitations } = useBusiness();
const { available, teamAvailable } = useBusinessFeatures();
</script>
