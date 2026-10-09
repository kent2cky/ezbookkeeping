<template>
    <f7-popup class="ext-repayment-popup" :opened="show" @popup:open="onOpen" @popup:closed="emit('update:show', false)">
        <f7-page>
            <f7-navbar>
                <f7-nav-left>
                    <f7-link popup-close icon-f7="xmark" :aria-label="tt('Close')"></f7-link>
                </f7-nav-left>
                <f7-nav-title :title="tt('Record repayment')" :subtitle="customer?.name"></f7-nav-title>
            </f7-navbar>

            <template v-if="customer">
                <f7-block class="ext-repay-owed">
                    {{ tt('{name} owes {amount}', { name: customer.name, amount: money(customer.outstanding) }) }}
                </f7-block>

                <f7-list strong inset dividers>
                    <f7-list-item link="#" class="ext-repay-amount" :title="tt('Amount received')" :after="money(amount)"
                                  :footer="problems.amount" @click="showPad = true"></f7-list-item>
                    <f7-list-item link="#" :title="tt('Apply to')" :after="optionTitle(saleOptions, saleId)"
                                  @click="showSales = true" v-if="openSales.length > 1">
                        <list-item-selection-popup value-type="item" key-field="value" value-field="value" title-field="title"
                                                   :title="tt('Apply to')" :items="saleOptions"
                                                   v-model:show="showSales" v-model="saleId">
                        </list-item-selection-popup>
                    </f7-list-item>
                </f7-list>

                <f7-block-title>{{ tt('Booking') }}</f7-block-title>
                <f7-list strong inset dividers>
                    <f7-list-item link="#" :title="tt('Money goes into')" :after="optionTitle(paymentAccountOptions, paymentAccountId)"
                                  :footer="problems.payment" @click="showPaymentAccounts = true">
                        <list-item-selection-popup value-type="item" key-field="value" value-field="value" title-field="title"
                                                   :title="tt('Money goes into')" :items="paymentAccountOptions"
                                                   v-model:show="showPaymentAccounts" v-model="paymentAccountId">
                        </list-item-selection-popup>
                    </f7-list-item>
                    <f7-list-item link="#" :title="tt('Owed-money account')" :after="optionTitle(receivableAccountOptions, receivableAccountId)"
                                  :footer="problems.receivable" @click="showReceivableAccounts = true">
                        <list-item-selection-popup value-type="item" key-field="value" value-field="value" title-field="title"
                                                   :title="tt('Owed-money account')" :items="receivableAccountOptions"
                                                   v-model:show="showReceivableAccounts" v-model="receivableAccountId">
                        </list-item-selection-popup>
                    </f7-list-item>
                    <f7-list-item link="#" :title="tt('Transfer category')" :after="optionTitle(transferCategoryOptions, categoryId)"
                                  :footer="problems.category" @click="showCategories = true">
                        <list-item-selection-popup value-type="item" key-field="value" value-field="value" title-field="title"
                                                   :title="tt('Transfer category')" :enable-filter="true"
                                                   :filter-placeholder="tt('Transfer category')" :filter-no-items-text="tt('No results')"
                                                   :items="transferCategoryOptions"
                                                   v-model:show="showCategories" v-model="categoryId">
                        </list-item-selection-popup>
                    </f7-list-item>
                    <f7-list-input type="text" clear-button :placeholder="tt('Note (optional)')"
                                   :value="note" @input="note = $event.target.value"></f7-list-input>
                </f7-list>

                <f7-block class="ext-checkout-help" v-if="!loading && transferCategoryOptions.length < 1">
                    <p>{{ tt('You have no transfer categories yet. A repayment is recorded as a transfer and needs one.') }}</p>
                    <f7-button tonal popup-close href="/category/all">{{ tt('Add a category') }}</f7-button>
                </f7-block>

                <f7-block>
                    <f7-button large fill :disabled="saving || loading" @click="save">
                        <f7-preloader size="20" color="white" v-if="saving"></f7-preloader>
                        <span v-else>{{ tt('Record repayment') }} · {{ money(amount) }}</span>
                    </f7-button>
                </f7-block>

                <number-pad-sheet :min-value="0" :max-value="maxAmount" :currency="currency" :hint="tt('Amount received')"
                                  v-model:show="showPad" v-model="amount"></number-pad-sheet>
            </template>
        </f7-page>
    </f7-popup>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';

import { parseBigDecimal } from '@/lib/numeral.ts';
import { parseDateTimeFromUnixTime } from '@/lib/datetime.ts';

import { useExtI18n } from '@/ext/shared/i18n.ts';
import api from '@/ext/shared/api.ts';
import { useBusiness } from '@/ext/shared/business.ts';
import { useBusinessAccounts, type PickerOption } from '@/ext/shared/accounts.ts';
import { loadFormDefaults, saveFormDefaults } from '@/ext/shared/defaults.ts';
import type { CustomerInfo, RepaymentInfo, SaleInfo } from '@/ext/shared/types.ts';

import { showError, showToast } from './ui.ts';

// Money received from a customer who owes. It is booked as a transfer from the owed-money account to where the money
// arrived, and paid off the oldest sales first unless one sale is chosen (the server does the allocation). Accounts
// and category are remembered per business, shared with the desktop dialog.
const props = defineProps<{
    show: boolean;
    customer: CustomerInfo | null;
}>();

const emit = defineEmits<{
    (e: 'update:show', value: boolean): void;
    (e: 'saved', repayment: RepaymentInfo): void;
}>();

const { tt, formatAmountToLocalizedNumeralsWithCurrency, formatDateTimeToLongDate } = useExtI18n();
const { current } = useBusiness();

const loading = ref<boolean>(false);
const saving = ref<boolean>(false);
const openSales = ref<SaleInfo[]>([]);
const saleId = ref<string>('0');
const amount = ref<number>(0);
const paymentAccountId = ref<string>('');
const receivableAccountId = ref<string>('');
const categoryId = ref<string>('');
const note = ref<string>('');
const showProblems = ref<boolean>(false);
const showPad = ref<boolean>(false);
const showSales = ref<boolean>(false);
const showPaymentAccounts = ref<boolean>(false);
const showReceivableAccounts = ref<boolean>(false);
const showCategories = ref<boolean>(false);

const {
    paymentAccounts, receivableAccounts, compatibleReceivables,
    paymentAccountOptions, receivableAccountOptions, transferCategoryOptions, currency, load: loadAccounts
} = useBusinessAccounts(paymentAccountId);

function money(minorUnits: number): string {
    return formatAmountToLocalizedNumeralsWithCurrency(parseBigDecimal(minorUnits), currency.value);
}

function optionTitle(options: PickerOption[], value: string): string {
    return options.find(o => o.value === value)?.title ?? tt('Choose');
}

const saleOptions = computed<PickerOption[]>(() => [
    { title: tt('Oldest sales first'), value: '0' },
    ...openSales.value.map(sale => ({
        title: tt('Sale #{id} on {date}: owes {amount}', { id: sale.id, date: formatDateTimeToLongDate(parseDateTimeFromUnixTime(sale.time)), amount: money(sale.outstanding) }),
        value: sale.id
    }))
]);

// the most that can be received now: everything the customer owes, or what is left on the chosen sale
const maxAmount = computed<number>(() => {
    if (saleId.value !== '0') {
        return openSales.value.find(s => s.id === saleId.value)?.outstanding ?? 0;
    }

    return props.customer?.outstanding ?? 0;
});

watch(saleId, () => {
    amount.value = maxAmount.value;
});

watch(compatibleReceivables, accounts => {
    if (!accounts.some(a => a.id === receivableAccountId.value)) {
        receivableAccountId.value = accounts[0]?.id ?? '';
    }
});

const problemList = computed(() => ({
    amount: amount.value <= 0 ? tt('Enter the amount received')
        : (amount.value > maxAmount.value ? tt('That is more than is owed: {amount}', { amount: money(maxAmount.value) }) : ''),
    payment: paymentAccountId.value ? '' : tt('Choose where the money goes'),
    receivable: compatibleReceivables.value.some(a => a.id === receivableAccountId.value) ? '' : tt('Choose the owed-money account'),
    category: categoryId.value ? '' : tt('Choose a transfer category')
}));

const problems = reactive({ amount: '', payment: '', receivable: '', category: '' });

watch([problemList, showProblems], () => {
    problems.amount = showProblems.value ? problemList.value.amount : '';
    problems.payment = showProblems.value ? problemList.value.payment : '';
    problems.receivable = showProblems.value ? problemList.value.receivable : '';
    problems.category = showProblems.value ? problemList.value.category : '';
}, { deep: true });

function businessKey(): string {
    return current.value?.ownerUid ?? 'own';
}

async function onOpen(): Promise<void> {
    if (!props.customer) {
        return;
    }

    showProblems.value = false;
    saleId.value = '0';
    amount.value = props.customer.outstanding; // usually the whole debt is paid off
    note.value = '';
    loading.value = true;

    try {
        [openSales.value] = await Promise.all([api.listSales({ customerId: props.customer.id, onlyOpen: true }), loadAccounts()]);

        const saved = loadFormDefaults(businessKey());
        paymentAccountId.value = paymentAccounts.value.some(a => a.id === saved.payment) ? saved.payment! : (paymentAccounts.value[0]?.id ?? '');
        receivableAccountId.value = receivableAccounts.value.some(a => a.id === saved.receivable) ? saved.receivable! : (compatibleReceivables.value[0]?.id ?? '');
        categoryId.value = transferCategoryOptions.value.some(c => c.value === saved.transfer) ? saved.transfer! : (transferCategoryOptions.value[0]?.value ?? '');
    } catch (error) {
        showError(error);
    } finally {
        loading.value = false;
    }
}

async function save(): Promise<void> {
    if (!props.customer) {
        return;
    }

    showProblems.value = true;

    if (Object.values(problemList.value).some(Boolean)) {
        showToast(tt('Check the highlighted fields'));
        return;
    }

    saving.value = true;

    try {
        const repayment = await api.addRepayment({
            customerId: props.customer.id,
            amount: amount.value,
            saleId: saleId.value,
            time: Math.floor(Date.now() / 1000),
            utcOffset: -new Date().getTimezoneOffset(),
            paymentAccountId: paymentAccountId.value,
            receivableAccountId: receivableAccountId.value,
            categoryId: categoryId.value,
            note: note.value.trim()
        });

        saveFormDefaults(businessKey(), { payment: paymentAccountId.value, receivable: receivableAccountId.value, transfer: categoryId.value });
        showProblems.value = false;
        emit('update:show', false);
        emit('saved', repayment);
        loadAccounts(true).catch(() => {
            // only the balances shown elsewhere are stale until the next refresh
        });
    } catch (error) {
        showError(error);
    } finally {
        saving.value = false;
    }
}
</script>

<style>
.ext-repay-owed {
    font-size: 1.1em;
    font-weight: 600;
    color: var(--f7-color-orange);
}

.ext-repay-amount .item-title,
.ext-repay-amount .item-after {
    font-size: 1.2em;
    font-weight: 700;
    color: var(--f7-text-color);
}

.ext-repayment-popup .item-footer {
    color: var(--f7-color-red);
}
</style>
