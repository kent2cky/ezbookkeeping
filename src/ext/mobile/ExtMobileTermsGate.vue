<template>
    <f7-popup class="ext-terms-gate" :opened="needsAcceptance" :close-by-backdrop-click="false" :close-on-escape="false" :swipe-to-close="false">
        <f7-page>
            <f7-navbar :title="tt('Terms of Service and Privacy Policy')"></f7-navbar>

            <f7-block>
                <p>{{ tt('Please read and accept our terms to carry on. We ask again whenever they change.') }}</p>
            </f7-block>

            <f7-list strong inset dividers>
                <f7-list-item external target="_blank" :link="LEGAL_TERMS_URL" :title="tt('Terms of Service')"></f7-list-item>
                <f7-list-item external target="_blank" :link="LEGAL_PRIVACY_URL" :title="tt('Privacy Policy')"></f7-list-item>
            </f7-list>

            <f7-list strong inset>
                <f7-list-item checkbox :disabled="saving" :checked="agreed" @change="agreed = $event.target.checked"
                              :title="tt('I have read and agree to the Terms of Service and the Privacy Policy')"></f7-list-item>
            </f7-list>

            <f7-block class="text-color-red" v-if="problem">{{ problem }}</f7-block>

            <f7-block>
                <f7-button large fill :disabled="!agreed || saving || loggingOut" @click="accept">{{ tt('Agree and continue') }}</f7-button>
                <f7-button large class="margin-top" :disabled="saving || loggingOut" @click="declineAndLogOut">{{ tt('I do not agree, log me out') }}</f7-button>
            </f7-block>
        </f7-page>
    </f7-popup>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

import { useExtI18n } from '@/ext/shared/i18n.ts';
import { useRootStore } from '@/stores/index.ts';
import { useSettingsStore } from '@/stores/setting.ts';

import { describeError } from '@/ext/shared/api.ts';
import { LEGAL_TERMS_URL, LEGAL_PRIVACY_URL } from '@/ext/shared/legalVersion.ts';
import { useTerms } from '@/ext/shared/terms.ts';

// The mobile twin of ExtTermsGate.vue: everyone must accept the current Terms and Privacy Policy, also people who only
// ever use the phone. Shown on the home page; it cannot be closed without answering.
const { tt } = useExtI18n();
const rootStore = useRootStore();
const settingsStore = useSettingsStore();
const { needsAcceptance, load, accept: acceptTerms } = useTerms();

const agreed = ref<boolean>(false);
const saving = ref<boolean>(false);
const loggingOut = ref<boolean>(false);
const problem = ref<string>('');

async function accept(): Promise<void> {
    saving.value = true;
    problem.value = '';

    try {
        await acceptTerms();
        agreed.value = false;
    } catch (error) {
        problem.value = describeError(error);
    } finally {
        saving.value = false;
    }
}

// Declining means not using the service: log out, then reload so the app starts at the login screen
async function declineAndLogOut(): Promise<void> {
    loggingOut.value = true;

    try {
        await rootStore.logout();
        settingsStore.clearAppSettings();
        window.location.reload();
    } catch (error) {
        problem.value = describeError(error);
        loggingOut.value = false;
    }
}

onMounted(() => {
    load().catch(() => {
        // if the answer cannot be fetched the app is not blocked; it asks again next time
    });
});
</script>

<style>
/* the whole sentence must be readable before agreeing to it */
.ext-terms-gate .item-checkbox .item-title {
    white-space: normal;
}
</style>
