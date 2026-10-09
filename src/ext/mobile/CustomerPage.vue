<template>
    <f7-page class="ext-customer-page" ptr @ptr:refresh="refresh">
        <f7-navbar :back-link="tt('Back')">
            <f7-nav-title :title="customer?.name ?? tt('Customer')"></f7-nav-title>
            <f7-nav-right v-if="canManage && customer">
                <f7-link icon-f7="ellipsis_circle" :aria-label="tt('More')" @click="showActions = true"></f7-link>
            </f7-nav-right>
        </f7-navbar>

        <template v-if="customer">
            <f7-block class="ext-balance">
                <div class="ext-balance-label">{{ tt('Currently owes') }}</div>
                <div class="ext-balance-amount" :class="{ 'ext-balance-owed': customer.outstanding > 0 }">{{ money(customer.outstanding) }}</div>
            </f7-block>

            <f7-block class="ext-customer-actions">
                <f7-button large fill @click="showRepayment = true" v-if="customer.outstanding > 0">{{ tt('Record repayment') }}</f7-button>
                <div class="ext-action-row">
                    <f7-button tonal @click="sendReminder" v-if="customer.outstanding > 0">{{ tt('Send reminder') }}</f7-button>
                    <f7-button tonal external :href="`tel:${customer.phone}`" v-if="customer.phone">{{ tt('Call') }}</f7-button>
                    <f7-button tonal @click="sellTo">{{ tt('New sale') }}</f7-button>
                </div>
            </f7-block>

            <f7-list strong inset dividers v-if="customer.phone || customer.email">
                <f7-list-item external :link="`tel:${customer.phone}`" :title="customer.phone" :header="tt('Phone')" v-if="customer.phone"></f7-list-item>
                <f7-list-item external :link="`mailto:${customer.email}`" :title="customer.email" :header="tt('Email')" v-if="customer.email"></f7-list-item>
            </f7-list>

            <f7-block-title>{{ tt('Unpaid sales') }}</f7-block-title>
            <f7-list strong inset dividers media-list v-if="openSales.length > 0">
                <f7-list-item link="#" :key="sale.id" v-for="sale in openSales"
                              :title="tt('Sale #{id}', { id: sale.id })"
                              :subtitle="formatTime(sale.time)"
                              :text="tt('Total {total}, paid {paid}', { total: money(sale.total), paid: money(sale.paid) })"
                              @click="showSaleReceipt(sale)">
                    <template #after><span class="ext-owes">{{ money(sale.outstanding) }}</span></template>
                </f7-list-item>
            </f7-list>
            <f7-block class="ext-muted" v-else-if="loadedDetail">{{ tt('Nothing is owed.') }}</f7-block>

            <f7-block-title>{{ tt('Repayments received') }}</f7-block-title>
            <f7-list strong inset dividers media-list v-if="repayments.length > 0">
                <f7-list-item link="#" :key="repayment.id" v-for="repayment in repayments"
                              :title="money(repayment.amount)"
                              :subtitle="formatTime(repayment.time)"
                              :text="repaymentText(repayment)"
                              @click="showRepaymentReceipt(repayment)">
                </f7-list-item>
            </f7-list>
            <f7-block class="ext-muted" v-else-if="loadedDetail">{{ tt('No repayments yet.') }}</f7-block>
        </template>

        <f7-block class="text-align-center" v-else-if="loaded">
            <p>{{ tt('This customer no longer exists.') }}</p>
        </f7-block>

        <f7-block class="text-align-center" v-else>
            <f7-preloader></f7-preloader>
        </f7-block>

        <f7-actions :opened="showActions" @actions:closed="showActions = false">
            <f7-actions-group>
                <f7-actions-button @click="showEdit = true">{{ tt('Edit customer') }}</f7-actions-button>
                <f7-actions-button color="red" @click="confirmDelete">{{ tt('Delete customer') }}</f7-actions-button>
            </f7-actions-group>
            <f7-actions-group>
                <f7-actions-button bold>{{ tt('Cancel') }}</f7-actions-button>
            </f7-actions-group>
        </f7-actions>

        <ext-mobile-repayment-popup :customer="customer ?? null" v-model:show="showRepayment" @saved="onRepaymentSaved" />
        <ext-mobile-customer-sheet :customer="customer" v-model:show="showEdit" @saved="onEdited" />
        <ext-mobile-receipt-popup :receipt="receipt" :heading="receiptHeading" v-model:show="showReceipt" />
    </f7-page>
</template>

<script setup lang="ts">
import ExtMobileRepaymentPopup from './ExtMobileRepaymentPopup.vue';
import ExtMobileCustomerSheet from './ExtMobileCustomerSheet.vue';
import ExtMobileReceiptPopup from './ExtMobileReceiptPopup.vue';

import { ref, computed, onMounted } from 'vue';
import type { Router } from 'framework7/types';

import { parseBigDecimal } from '@/lib/numeral.ts';
import { parseDateTimeFromUnixTime } from '@/lib/datetime.ts';

import { useExtI18n } from '@/ext/shared/i18n.ts';
import api from '@/ext/shared/api.ts';
import { useBusiness } from '@/ext/shared/business.ts';
import { useBusinessAccounts } from '@/ext/shared/accounts.ts';
import { usePeople } from '@/ext/shared/people.ts';
import { useReceipts } from '@/ext/shared/useReceipts.ts';
import { copyText, shareText } from '@/ext/shared/receiptOutput.ts';
import type { CustomerInfo, RepaymentInfo, SaleInfo } from '@/ext/shared/types.ts';

import { useCustomers } from './customers.ts';
import { useSale } from './sale.ts';
import { confirmAction, showError, showToast } from './ui.ts';

// One customer: what they owe, the buttons for getting paid (record a repayment, send a reminder, call), and the
// sales and repayments behind the balance, each with its receipt. Owners and managers can edit or delete.
const props = defineProps<{
    f7route: Router.Route;
    f7router: Router.Router;
}>();

const { tt, formatAmountToLocalizedNumeralsWithCurrency, formatDateTimeToLongDateTime } = useExtI18n();
const { current, canManage } = useBusiness();
const { loaded, load: loadCustomers, find } = useCustomers();
const { currency, load: loadAccounts } = useBusinessAccounts(ref(''));
const { load: loadPeople, nameOf } = usePeople();
const { receipt, show: showReceipt, openSale, openRepayment } = useReceipts();
const sale = useSale();

const customerId = String(props.f7route.query['id'] ?? '');

const openSales = ref<SaleInfo[]>([]);
const repayments = ref<RepaymentInfo[]>([]);
const loadedDetail = ref<boolean>(false);
const showActions = ref<boolean>(false);
const showRepayment = ref<boolean>(false);
const showEdit = ref<boolean>(false);
const receiptHeading = ref<string>('');

const customer = computed<CustomerInfo | undefined>(() => find(customerId));

function money(minorUnits: number): string {
    return formatAmountToLocalizedNumeralsWithCurrency(parseBigDecimal(minorUnits), currency.value);
}

function formatTime(unixTime: number): string {
    return formatDateTimeToLongDateTime(parseDateTimeFromUnixTime(unixTime));
}

function repaymentText(repayment: RepaymentInfo): string {
    const name = nameOf(repayment.actorUid);
    const parts = [name ? tt('Received by {name}', { name }) : '', repayment.note].filter(Boolean);
    return parts.join(' · ');
}

// A polite message the person can send on WhatsApp or SMS through the phone's share sheet
async function sendReminder(): Promise<void> {
    if (!customer.value) {
        return;
    }

    const text = tt('Hello {name}, this is a friendly reminder from {business} that {amount} is still owed. Thank you!', {
        name: customer.value.name,
        business: current.value?.name ?? '',
        amount: money(customer.value.outstanding)
    });

    if (!await shareText(tt('Reminder'), text)) {
        if (await copyText(text)) {
            showToast(tt('Reminder copied. Paste it into a message.'));
        }
    }
}

// Start a sale with this customer already chosen
function sellTo(): void {
    sale.customerId.value = customerId;
    props.f7router.navigate('/ext/sell');
}

async function showSaleReceipt(item: SaleInfo): Promise<void> {
    receiptHeading.value = '';

    try {
        await openSale(item);
    } catch (error) {
        showError(error);
    }
}

async function showRepaymentReceipt(repayment: RepaymentInfo, heading: string = ''): Promise<void> {
    receiptHeading.value = heading;

    try {
        await openRepayment(repayment);
    } catch (error) {
        showError(error);
    }
}

async function onRepaymentSaved(repayment: RepaymentInfo): Promise<void> {
    await refresh();
    sale.refreshAfterSale().catch(() => {
        // the Sell screen shows the old balance until it reloads
    });
    await showRepaymentReceipt(repayment, tt('Repayment recorded'));
}

async function onEdited(): Promise<void> {
    showToast(tt('Customer saved'));
    await refresh();
}

function confirmDelete(): void {
    if (!customer.value) {
        return;
    }

    confirmAction(tt('Delete customer'), tt('ext.confirmDeleteCustomer', { name: customer.value.name }), tt('Delete'), tt('Cancel'), async () => {
        try {
            await api.deleteCustomer(customerId);
            showToast(tt('Customer deleted'));
            await loadCustomers();
            props.f7router.back();
        } catch (error) {
            showError(error);
        }
    });
}

async function refresh(done?: () => void): Promise<void> {
    try {
        await Promise.all([loadCustomers(), loadAccounts(), loadPeople()]);
        [openSales.value, repayments.value] = await Promise.all([
            api.listSales({ customerId, onlyOpen: true }),
            api.listRepayments(customerId)
        ]);
        loadedDetail.value = true;
    } catch (error) {
        showError(error);
    } finally {
        done?.();
    }
}

onMounted(() => refresh());
</script>

<style>
.ext-balance {
    text-align: center;
    margin-top: 20px;
    margin-bottom: 8px;
}

.ext-balance-label {
    opacity: 0.7;
}

.ext-balance-amount {
    font-size: 2em;
    font-weight: 700;
}

.ext-balance-owed {
    color: var(--f7-color-orange);
}

.ext-customer-actions .ext-action-row {
    display: flex;
    gap: 8px;
    margin-top: 10px;
}

.ext-customer-actions .ext-action-row .button {
    flex: 1 1 0;
}

.ext-muted {
    opacity: 0.6;
}
</style>
