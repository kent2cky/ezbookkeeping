<template>
    <v-dialog width="520" scrollable :model-value="show" @update:model-value="close">
        <v-card v-if="receipt">
            <v-card-text class="pa-0">
                <div class="d-flex align-center flex-wrap ga-3 pa-4 pb-2">
                    <v-btn-toggle density="compact" mandatory color="primary" variant="outlined" divided v-model="paper">
                        <v-btn value="narrow" size="small">{{ tt('Small receipt (80 mm)') }}</v-btn>
                        <v-btn value="a4" size="small">{{ tt('Full page (A4)') }}</v-btn>
                    </v-btn-toggle>
                </div>

                <div ref="paperHolder" class="pa-4 pt-2 ext-receipt-stage">
                    <ext-receipt-paper :receipt="receipt" :paper="paper" />
                </div>
            </v-card-text>
            <v-card-actions>
                <v-btn variant="text" @click="copyText">{{ tt('Copy as text') }}</v-btn>
                <v-spacer />
                <v-btn variant="text" @click="close(false)">{{ tt('Close') }}</v-btn>
                <v-btn color="primary" @click="print">{{ tt('Print') }}</v-btn>
            </v-card-actions>
        </v-card>
        <ext-snack-bar ref="snackbar" />
    </v-dialog>
</template>

<script setup lang="ts">
import ExtSnackBar from '@/ext/components/ExtSnackBar.vue';
import ExtReceiptPaper from '@/ext/shared/ExtReceiptPaper.vue';

import { ref, watch, useTemplateRef } from 'vue';

import { useExtI18n } from '@/ext/shared/i18n.ts';

import { receiptToText, type Receipt } from '@/ext/shared/receipt.ts';
import {
    type ReceiptPaper,
    copyText as copyToClipboard,
    printReceiptElement,
    readReceiptPaper,
    receiptTextWidth,
    saveReceiptPaper
} from '@/ext/shared/receiptOutput.ts';

type SnackBarType = InstanceType<typeof ExtSnackBar>;

const props = defineProps<{
    show: boolean;
    receipt: Receipt | null;
}>();

const emit = defineEmits<{
    (e: 'update:show', value: boolean): void;
}>();

const { tt } = useExtI18n();

const paperHolder = useTemplateRef<HTMLElement>('paperHolder');
const snackbar = useTemplateRef<SnackBarType>('snackbar');

const paper = ref<ReceiptPaper>(readReceiptPaper());

watch(paper, saveReceiptPaper);

function close(value: boolean = false): void {
    emit('update:show', value);
}

// "Save as PDF" is in the same browser dialog
function print(): void {
    const element = paperHolder.value?.querySelector<HTMLElement>('.ext-receipt-paper');

    if (element) {
        printReceiptElement(element, paper.value);
    }
}

// Plain text for WhatsApp, SMS or email
async function copyText(): Promise<void> {
    if (!props.receipt) {
        return;
    }

    if (await copyToClipboard(receiptToText(props.receipt, receiptTextWidth(paper.value)))) {
        snackbar.value?.showMessage(tt('Receipt copied. Paste it into a message.'));
    } else {
        snackbar.value?.showError(tt('Could not copy. Use Print and choose Save as PDF instead.'));
    }
}

defineExpose({ print });
</script>

<style>
.ext-receipt-stage {
    background: rgba(0, 0, 0, 0.04);
    display: flex;
    justify-content: center;
    overflow-x: auto;
}
</style>
