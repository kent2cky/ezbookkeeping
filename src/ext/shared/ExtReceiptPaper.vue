<template>
    <div class="ext-receipt-paper" :class="paper === 'a4' ? 'ext-receipt-a4' : 'ext-receipt-narrow'">
        <div class="ext-receipt-void" v-if="receipt.voided">{{ tt('VOID') }}</div>

        <div class="ext-receipt-center">
            <div class="ext-receipt-business">{{ receipt.business.name }}</div>
            <div v-if="receipt.business.address">{{ receipt.business.address }}</div>
            <div v-if="receipt.business.phone">{{ receipt.business.phone }}</div>
        </div>

        <hr />
        <div class="ext-receipt-row ext-receipt-strong">
            <span>{{ receipt.title }}</span>
            <span>{{ receipt.number }}</span>
        </div>
        <div>{{ receipt.date }}</div>
        <div class="ext-receipt-row" :key="fact.label" v-for="fact in receipt.facts">
            <span>{{ fact.label }}</span>
            <span class="ext-receipt-value">{{ fact.value }}</span>
        </div>

        <template v-if="receipt.lines.length > 0">
            <hr />
            <div class="ext-receipt-line" :key="index" v-for="(line, index) in receipt.lines">
                <div>{{ line.name }}</div>
                <div class="ext-receipt-row ext-receipt-muted">
                    <span>{{ line.detail }}</span>
                    <span class="ext-receipt-value">{{ line.total }}</span>
                </div>
            </div>
        </template>

        <hr />
        <div class="ext-receipt-row" :class="{ 'ext-receipt-strong': row.strong }" :key="row.label" v-for="row in receipt.totals">
            <span>{{ row.label }}</span>
            <span class="ext-receipt-value">{{ row.value }}</span>
        </div>

        <template v-if="receipt.notes.length > 0">
            <hr />
            <div class="ext-receipt-muted" :key="note" v-for="note in receipt.notes">{{ note }}</div>
        </template>

        <template v-if="receipt.business.footer">
            <hr />
            <div class="ext-receipt-center">{{ receipt.business.footer }}</div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { useExtI18n } from './i18n.ts';
import type { Receipt } from './receipt.ts';
import type { ReceiptPaper } from './receiptOutput.ts';

// The receipt as it is printed, in plain HTML so both the desktop and the mobile app can show and print it
defineProps<{
    receipt: Receipt;
    paper: ReceiptPaper;
}>();

const { tt } = useExtI18n();
</script>

<style>
.ext-receipt-paper {
    position: relative;
    background: #fff;
    color: #000;
    font-family: 'Courier New', Courier, monospace;
    font-size: 13px;
    line-height: 1.4;
    padding: 12px;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.25);
    box-sizing: border-box;
}

.ext-receipt-narrow { width: 80mm; max-width: 100%; }
.ext-receipt-a4 { width: 100%; max-width: 190mm; font-size: 15px; padding: 24px; }
.ext-receipt-paper hr { border: 0; border-top: 1px dashed #000; margin: 8px 0; }
.ext-receipt-center { text-align: center; }
.ext-receipt-business { font-weight: bold; font-size: 1.2em; }
.ext-receipt-row { display: flex; justify-content: space-between; gap: 12px; }
.ext-receipt-value { text-align: right; white-space: nowrap; }
.ext-receipt-strong { font-weight: bold; }
.ext-receipt-muted { opacity: 0.8; }
.ext-receipt-line { margin-bottom: 4px; }

.ext-receipt-void {
    position: absolute;
    top: 38%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-18deg);
    font-size: 3em;
    font-weight: bold;
    letter-spacing: 0.2em;
    color: rgba(200, 0, 0, 0.35);
    border: 0.12em solid rgba(200, 0, 0, 0.35);
    padding: 0 0.3em;
    pointer-events: none;
}
</style>
