<template>
    <f7-block-title class="margin-top">{{ tt('Business') }}</f7-block-title>
    <f7-list strong inset dividers>
        <f7-list-item link="#" :title="tt('Business Features')" @click="openBusinessScreen('/settings/business')">
            <template #media><f7-icon f7="building_2"></f7-icon></template>
        </f7-list-item>
    </f7-list>
</template>

<script setup lang="ts">
import { useExtI18n } from '@/ext/shared/i18n.ts';
import { openBusinessScreen } from '@/ext/shared/mobileBridge.ts';

// Shown in the mobile app's Settings: where the business features are switched on. Once they are, the home page's
// Business tab (ExtMobileBusinessTab.vue) leads to sales, customers, inventory, reports and the team.
const { tt } = useExtI18n();
</script>
