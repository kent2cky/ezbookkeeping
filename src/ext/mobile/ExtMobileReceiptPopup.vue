<template>
    <f7-popup class="ext-receipt-popup" :opened="show" @popup:closed="emit('update:show', false)">
        <f7-page>
            <f7-navbar :title="heading || tt('Receipt')">
                <f7-nav-right>
                    <f7-link popup-close>{{ tt('Done') }}</f7-link>
                </f7-nav-right>
            </f7-navbar>

            <template v-if="receipt">
                <f7-block class="no-margin-bottom">
                    <f7-segmented strong tag="p">
                        <f7-button :active="paper === 'narrow'" @click="paper = 'narrow'">{{ tt('Small receipt (80 mm)') }}</f7-button>
                        <f7-button :active="paper === 'a4'" @click="paper = 'a4'">{{ tt('Full page (A4)') }}</f7-button>
                    </f7-segmented>
                </f7-block>

                <div ref="paperHolder" class="ext-mobile-receipt-stage">
                    <ext-receipt-paper :receipt="receipt" :paper="paper" />
                </div>

                <f7-block>
                    <f7-button large fill @click="share" v-if="shareable">{{ tt('Share receipt') }}</f7-button>
                    <f7-button large :fill="!shareable" :class="{ 'margin-top': shareable }" @click="copy">{{ tt('Copy as text') }}</f7-button>
                    <f7-button large class="margin-top" @click="print">{{ tt('Print or save as PDF') }}</f7-button>
                </f7-block>
            </template>
        </f7-page>
    </f7-popup>
</template>

<script setup lang="ts">
import ExtReceiptPaper from '@/ext/shared/ExtReceiptPaper.vue';

import { ref, watch, useTemplateRef } from 'vue';

import { useExtI18n } from '@/ext/shared/i18n.ts';
import { receiptToText, type Receipt } from '@/ext/shared/receipt.ts';
import {
    type ReceiptPaper,
    canShareText,
    copyText,
    printReceiptElement,
    readReceiptPaper,
    receiptTextWidth,
    saveReceiptPaper,
    shareText
} from '@/ext/shared/receiptOutput.ts';
import { showToast } from './ui.ts';

// A sale or repayment receipt on the phone. Sharing hands the text version to WhatsApp, SMS or email.
const props = defineProps<{
    show: boolean;
    receipt: Receipt | null;
    heading?: string; // for example "Sale #12 recorded" right after a sale
}>();

const emit = defineEmits<{
    (e: 'update:show', value: boolean): void;
}>();

const { tt } = useExtI18n();
const paperHolder = useTemplateRef<HTMLElement>('paperHolder');

const paper = ref<ReceiptPaper>(readReceiptPaper());
const shareable = canShareText();

watch(paper, saveReceiptPaper);

function text(): string {
    return props.receipt ? receiptToText(props.receipt, receiptTextWidth(paper.value)) : '';
}

async function share(): Promise<void> {
    if (props.receipt) {
        await shareText(`${props.receipt.title} ${props.receipt.number}`, text());
    }
}

async function copy(): Promise<void> {
    if (await copyText(text())) {
        showToast(tt('Receipt copied. Paste it into a message.'));
    } else {
        showToast(tt('Could not copy. Use Print and choose Save as PDF instead.'));
    }
}

function print(): void {
    const element = paperHolder.value?.querySelector<HTMLElement>('.ext-receipt-paper');

    if (element) {
        printReceiptElement(element, paper.value);
    }
}
</script>

<style>
.ext-mobile-receipt-stage {
    display: flex;
    justify-content: center;
    padding: 12px 16px;
    overflow-x: auto;
}
</style>
