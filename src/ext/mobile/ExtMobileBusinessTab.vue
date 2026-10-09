<template>
    <f7-link class="link" href="/ext/business" :aria-label="tt('Business')" v-if="teamAvailable">
        <f7-icon f7="briefcase" aria-hidden="true"></f7-icon>
        <span class="tabbar-label">{{ tt('Business') }}</span>
    </f7-link>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

import { useExtI18n } from '@/ext/shared/i18n.ts';
import { useMobileBusinessAccess } from './businessAccess.ts';

// Tab of the mobile home page's bottom bar, shown only to people who use the business features
const { tt } = useExtI18n();
const { teamAvailable, loadAccess } = useMobileBusinessAccess();

onMounted(() => {
    loadAccess();
});
</script>
