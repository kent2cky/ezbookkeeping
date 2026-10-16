<template>
    <f7-page class="ext-sales-page" ptr @ptr:refresh="refresh">
        <f7-navbar :title="tt('Recent sales')" :back-link="tt('Back')"></f7-navbar>

        <f7-list strong inset dividers media-list class="margin-top" v-if="sales.length > 0">
            <f7-list-item link="#" :key="sale.id" v-for="sale in sales"
                          :title="customerName(sale.customerId)"
                          :subtitle="formatTime(sale.time)"
                          :text="byLine(sale)"
                          @click="openActions(sale)">
                <template #after>
                    <div class="ext-sale-after">
                        <span class="ext-sale-total" :class="{ 'ext-sale-voided': sale.voided }">{{ money(sale) }}</span>
                        <f7-badge color="red" v-if="sale.voided">{{ tt('Voided') }}</f7-badge>
                        <f7-badge color="orange" v-else-if="sale.outstanding > 0">{{ tt('Owes {amount}', { amount: moneyOf(sale, sale.outstanding) }) }}</f7-badge>
                        <f7-badge color="green" v-else>{{ tt('Paid') }}</f7-badge>
                    </div>
                </template>
            </f7-list-item>
        </f7-list>

        <f7-block class="text-align-center" v-else-if="loaded">
            <p>{{ tt('No sales yet.') }}</p>
            <f7-button tonal round href="/ext/sell">{{ tt('Sell') }}</f7-button>
        </f7-block>

        <f7-block class="text-align-center" v-else>
            <f7-preloader></f7-preloader>
        </f7-block>

        <f7-actions :opened="!!selected" @actions:closed="selected = null">
            <f7-actions-group>
                <f7-actions-label v-if="selected">{{ tt('Sale') }} #{{ selected.id }} · {{ money(selected) }}</f7-actions-label>
                <f7-actions-button @click="showReceiptOf(selected)">{{ tt('Receipt') }}</f7-actions-button>
                <f7-actions-button color="red" @click="confirmVoid(selected)" v-if="canManage && selected && !selected.voided">{{ tt('Void sale') }}</f7-actions-button>
            </f7-actions-group>
            <f7-actions-group>
                <f7-actions-button bold>{{ tt('Cancel') }}</f7-actions-button>
            </f7-actions-group>
        </f7-actions>

        <ext-mobile-receipt-popup :receipt="receipt" v-model:show="showReceipt" />
    </f7-page>
</template>

<script setup lang="ts">
import ExtMobileReceiptPopup from './ExtMobileReceiptPopup.vue';

import { ref, onMounted } from 'vue';

import { useAccountsStore } from '@/stores/account.ts';
import { useUserStore } from '@/stores/user.ts';
import { parseBigDecimal } from '@/lib/numeral.ts';
import { parseDateTimeFromUnixTime } from '@/lib/datetime.ts';

import { useExtI18n } from '@/ext/shared/i18n.ts';
import api from '@/ext/shared/api.ts';
import { useBusiness } from '@/ext/shared/business.ts';
import { usePeople } from '@/ext/shared/people.ts';
import { useReceipts } from '@/ext/shared/useReceipts.ts';
import type { CustomerInfo, SaleInfo } from '@/ext/shared/types.ts';

import { useSale } from './sale.ts';
import { confirmAction, showError, showToast } from './ui.ts';

// The latest sales of the business, with their receipts. Owners and managers can void a sale here, which puts the
// stock back and reverses the money (the server does both).
const { tt, formatAmountToLocalizedNumeralsWithCurrency, formatDateTimeToLongDateTime } = useExtI18n();
const accountsStore = useAccountsStore();
const userStore = useUserStore();
const { canManage, ensureLoaded } = useBusiness();
const { load: loadPeople, nameOf } = usePeople();
const { receipt, show: showReceipt, openSale } = useReceipts();
const { refreshAfterSale } = useSale();

const sales = ref<SaleInfo[]>([]);
const customers = ref<CustomerInfo[]>([]);
const loaded = ref<boolean>(false);
const selected = ref<SaleInfo | null>(null);

// a sale is booked in the currency of the account that received the money (or the owed-money account)
function moneyOf(sale: SaleInfo, minorUnits: number): string {
    const account = accountsStore.allAccountsMap[sale.paymentAccountId] ?? accountsStore.allAccountsMap[sale.receivableAccountId];
    return formatAmountToLocalizedNumeralsWithCurrency(parseBigDecimal(minorUnits), account?.currency ?? userStore.currentUserDefaultCurrency);
}

function money(sale: SaleInfo): string {
    return moneyOf(sale, sale.total);
}

function formatTime(unixTime: number): string {
    return formatDateTimeToLongDateTime(parseDateTimeFromUnixTime(unixTime));
}

function customerName(id: string): string {
    return id === '0' ? tt('Walk-in customer') : (customers.value.find(c => c.id === id)?.name ?? '…');
}

function byLine(sale: SaleInfo): string {
    const name = nameOf(sale.actorUid);
    return name ? tt('Recorded by {name}', { name }) : '';
}

function openActions(sale: SaleInfo): void {
    selected.value = sale;
}

async function showReceiptOf(sale: SaleInfo | null): Promise<void> {
    if (!sale) {
        return;
    }

    try {
        await openSale(sale);
    } catch (error) {
        showError(error);
    }
}

function confirmVoid(sale: SaleInfo | null): void {
    if (!sale) {
        return;
    }

    confirmAction(tt('Void sale'), tt('Void sale #{id}? The stock goes back and the money is reversed.', { id: sale.id }),
        tt('Void'), tt('Cancel'), async () => {
            try {
                await api.voidSale(sale.id);
                showToast(tt('Sale #{id} voided', { id: sale.id }));
                await Promise.all([load(), refreshAfterSale(), accountsStore.loadAllAccounts({ force: true })]);
            } catch (error) {
                showError(error);
            }
        });
}

async function load(): Promise<void> {
    await ensureLoaded();
    [sales.value, customers.value] = await Promise.all([api.listSales(), api.listCustomers(), loadPeople(), accountsStore.loadAllAccounts({ force: false })]);
    loaded.value = true;
}

async function refresh(done?: () => void): Promise<void> {
    try {
        await load();
    } catch (error) {
        showError(error);
    } finally {
        done?.();
    }
}

onMounted(() => refresh());
</script>

<style>
.ext-sale-after {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
}

.ext-sale-total {
    font-weight: 600;
    color: var(--f7-text-color);
}

.ext-sale-voided {
    text-decoration: line-through;
    opacity: 0.6;
}
</style>
