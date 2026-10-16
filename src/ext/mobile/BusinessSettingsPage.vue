<template>
    <f7-page class="ext-business-settings-page">
        <f7-navbar :title="tt('Business Features')" :back-link="tt('Back')"></f7-navbar>

        <f7-block class="ext-muted margin-top">
            {{ tt('Turn on inventory, sales and customers if you run a business. They stay hidden otherwise.') }}
        </f7-block>

        <f7-list strong inset dividers>
            <f7-list-item :title="tt('Enable inventory, sales and customers')">
                <template #after>
                    <f7-toggle :checked="available" :disabled="worksForSomeoneElse || saving" @toggle:change="change"></f7-toggle>
                </template>
            </f7-list-item>
        </f7-list>
        <f7-block-footer v-if="worksForSomeoneElse">
            {{ tt('These features are on because you were invited to work in a business. They stay on while you are a member.') }}
        </f7-block-footer>

        <f7-block-title>{{ tt('When enabled you get:') }}</f7-block-title>
        <f7-list strong inset dividers>
            <f7-list-item :title="tt('Sell')" :footer="tt('Sales: a cart that records the sale in your accounts, also on credit')"></f7-list-item>
            <f7-list-item :title="tt('Customers')" :footer="tt('Customers: who owes you money, and repayments')"></f7-list-item>
            <f7-list-item :title="tt('Inventory')" :footer="tt('Inventory: items, stock levels and several locations')"></f7-list-item>
            <f7-list-item :title="tt('Team')" :footer="tt('Team: invite managers and staff to work in your business')"></f7-list-item>
        </f7-list>
        <f7-block-footer>{{ tt('This setting is saved to your account, so it applies on all your devices.') }}</f7-block-footer>

        <template v-if="available">
            <f7-block-title>{{ tt('Receipt details') }}</f7-block-title>
            <f7-list strong inset dividers form>
                <f7-list-input type="text" clear-button :label="tt('Business name on receipts')" :placeholder="tt('Leave empty to use your own name.')"
                               :value="profile.receiptName" @input="profile.receiptName = $event.target.value"></f7-list-input>
                <f7-list-input type="text" clear-button :label="tt('Address')" :placeholder="tt('Address')"
                               :value="profile.address" @input="profile.address = $event.target.value"></f7-list-input>
                <f7-list-input type="tel" clear-button :label="tt('Phone')" :placeholder="tt('Phone')"
                               :value="profile.phone" @input="profile.phone = $event.target.value"></f7-list-input>
                <f7-list-input type="text" clear-button :label="tt('Message at the bottom')" :placeholder="tt('For example: Thank you for your business')"
                               :value="profile.footer" @input="profile.footer = $event.target.value"></f7-list-input>
            </f7-list>
            <f7-block-footer>{{ tt('This is printed at the top and bottom of your receipts.') }}</f7-block-footer>
            <f7-block>
                <f7-button large fill :disabled="savingProfile" @click="saveProfile">{{ tt('Save receipt details') }}</f7-button>
            </f7-block>
        </template>

        <f7-block-title>{{ tt('Export your business data') }}</f7-block-title>
        <f7-block>
            <p>{{ tt('The download is a ZIP file with your items, stock, locations, customers, sales, repayments, team and activity, as spreadsheet files, plus a short guide.') }}</p>
            <p class="ext-muted">{{ tt('Only the owner of a business can download its data.') }}</p>
            <f7-button large tonal :disabled="exporting" @click="exportData">
                <f7-preloader size="20" v-if="exporting"></f7-preloader>
                <span v-else>{{ tt('Share or save my business data') }}</span>
            </f7-button>
        </f7-block>
    </f7-page>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue';

import { useExtI18n } from '@/ext/shared/i18n.ts';
import api from '@/ext/shared/api.ts';
import { shareOrSaveFile } from '@/ext/shared/csv.ts';
import { useBusiness } from '@/ext/shared/business.ts';
import { useBusinessFeatures } from '@/ext/shared/features.ts';

import { showError, showToast } from './ui.ts';

// The mobile twin of the desktop Business Features settings: the switch (kept on the server, so it follows the person
// to every device), the details printed on receipts, and the export of the business records.
const { tt } = useExtI18n();
const { ensureLoaded } = useBusiness();
const { available, worksForSomeoneElse, loadFeatureSetting, setEnabled } = useBusinessFeatures();

const saving = ref<boolean>(false);
const savingProfile = ref<boolean>(false);
const exporting = ref<boolean>(false);
const profile = reactive({ receiptName: '', address: '', phone: '', footer: '' });

async function change(value: boolean): Promise<void> {
    if (value === available.value) {
        return;
    }

    saving.value = true;

    try {
        await setEnabled(value);
        showToast(value ? tt('Business features are on') : tt('Business features are off'));
    } catch (error) {
        showError(error);
    } finally {
        saving.value = false;
    }
}

// receipt details belong to the person's own business
async function loadProfile(): Promise<void> {
    try {
        const saved = await api.getMyBusinessProfile();
        profile.receiptName = saved.receiptName;
        profile.address = saved.address;
        profile.phone = saved.phone;
        profile.footer = saved.footer;
    } catch (error) {
        showError(error);
    }
}

async function saveProfile(): Promise<void> {
    savingProfile.value = true;

    try {
        await api.updateMyBusinessProfile({
            receiptName: profile.receiptName.trim(),
            address: profile.address.trim(),
            phone: profile.phone.trim(),
            footer: profile.footer.trim()
        });
        showToast(tt('Receipt details saved'));
    } catch (error) {
        showError(error);
    } finally {
        savingProfile.value = false;
    }
}

async function exportData(): Promise<void> {
    exporting.value = true;

    try {
        const { blob, fileName } = await api.downloadBusinessExport();

        if (await shareOrSaveFile(fileName, blob) === 'saved') {
            showToast(tt('Your data was downloaded'));
        }
    } catch (error) {
        showError(error);
    } finally {
        exporting.value = false;
    }
}

watch(available, isAvailable => {
    if (isAvailable) {
        loadProfile();
    }
});

onMounted(() => {
    ensureLoaded().catch(() => {
        // the switch still works without the list of businesses
    });

    loadFeatureSetting().catch(showError);

    if (available.value) {
        loadProfile();
    }
});
</script>
