<template>
    <f7-sheet swipe-to-close swipe-handler=".swipe-handler" style="height: auto" :opened="show"
              @sheet:open="onOpen" @sheet:closed="emit('update:show', false)">
        <div class="swipe-handler"></div>
        <f7-page-content class="margin-top no-padding-top">
            <f7-block-title>{{ customer ? tt('Edit customer') : tt('New customer') }}</f7-block-title>
            <f7-list strong inset dividers form>
                <f7-list-input type="text" clear-button :label="tt('Name')" :placeholder="tt('Name')"
                               :value="name" @input="name = $event.target.value"></f7-list-input>
                <f7-list-input type="tel" clear-button :label="tt('Phone (optional)')" :placeholder="tt('Phone')"
                               :value="phone" @input="phone = $event.target.value"></f7-list-input>
                <f7-list-input type="email" clear-button :label="tt('Email (optional)')" :placeholder="tt('Email')"
                               :value="email" @input="email = $event.target.value"></f7-list-input>
            </f7-list>
            <f7-block class="margin-bottom">
                <f7-button large fill :disabled="!name.trim() || saving" @click="save">{{ tt('Save customer') }}</f7-button>
            </f7-block>
        </f7-page-content>
    </f7-sheet>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import { useExtI18n } from '@/ext/shared/i18n.ts';
import api from '@/ext/shared/api.ts';
import type { CustomerInfo } from '@/ext/shared/types.ts';

import { showError } from './ui.ts';

// Adding a customer (in the middle of a sale, or from the Customers screen), or changing one: a name, and a phone
// number or email if they give one
const props = defineProps<{
    show: boolean;
    customer?: CustomerInfo | null; // set to edit, empty to add
}>();

const emit = defineEmits<{
    (e: 'update:show', value: boolean): void;
    (e: 'saved', customer: CustomerInfo): void;
}>();

const { tt } = useExtI18n();

const name = ref<string>('');
const phone = ref<string>('');
const email = ref<string>('');
const saving = ref<boolean>(false);

function onOpen(): void {
    name.value = props.customer?.name ?? '';
    phone.value = props.customer?.phone ?? '';
    email.value = props.customer?.email ?? '';
}

async function save(): Promise<void> {
    saving.value = true;

    try {
        const request = { name: name.value.trim(), phone: phone.value.trim(), email: email.value.trim() };
        const customer = props.customer
            ? await api.modifyCustomer({ ...request, id: props.customer.id, note: props.customer.note })
            : await api.addCustomer(request);

        emit('saved', customer);
        emit('update:show', false);
    } catch (error) {
        showError(error);
    } finally {
        saving.value = false;
    }
}
</script>
