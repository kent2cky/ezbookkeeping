<template>
    <f7-popup class="ext-checkout-popup" :opened="show" @popup:open="onOpen" @popup:closed="emit('update:show', false)">
        <f7-page>
            <f7-navbar>
                <f7-nav-left>
                    <f7-link popup-close icon-f7="xmark" :aria-label="tt('Close')"></f7-link>
                </f7-nav-left>
                <f7-nav-title :title="tt('Checkout')"></f7-nav-title>
            </f7-navbar>

            <!-- what is being sold -->
            <f7-list strong inset dividers class="ext-checkout-lines">
                <f7-list-item :key="line.itemId" v-for="line in cart">
                    <template #inner>
                        <div class="ext-line">
                            <div class="ext-line-main">
                                <div class="ext-line-name">{{ line.item.name }}</div>
                                <div class="ext-line-detail">
                                    <a href="#" @click.prevent="editPrice(line.itemId)" v-if="canManage">{{ priceLabel(line) }}</a>
                                    <span v-else>{{ priceLabel(line) }}</span>
                                    <span class="ext-line-changed" v-if="line.priceOverridden"> · {{ tt('price changed') }}</span>
                                </div>
                                <div class="ext-line-problem" v-if="line.problem === 'stock'">
                                    {{ tt('Only {available} available here', { available: formatQty(stockOf(line.item)) }) }}
                                </div>
                            </div>
                            <div class="ext-line-side">
                                <div class="ext-line-total">{{ money(line.total) }}</div>
                                <div class="ext-stepper">
                                    <f7-button small round tonal :aria-label="tt('One less')" :disabled="submitting" @click="step(line.itemId, -1)">−</f7-button>
                                    <a href="#" class="ext-stepper-qty" @click.prevent="askQuantity(line.itemId, line.item.name, line.qty)">{{ formatQty(line.qty) }}</a>
                                    <f7-button small round tonal :aria-label="tt('One more')" :disabled="submitting" @click="step(line.itemId, 1)">+</f7-button>
                                </div>
                            </div>
                        </div>
                    </template>
                </f7-list-item>
            </f7-list>

            <!-- totals -->
            <f7-list strong inset dividers>
                <f7-list-item :title="tt('Subtotal')" :after="money(totals.subtotal)" v-if="canManage || totals.discount > 0"></f7-list-item>
                <f7-list-item link="#" :title="tt('Discount')" :after="totals.discount > 0 ? '− ' + money(totals.discount) : tt('None')"
                              @click="openPad('discount')" v-if="canManage"></f7-list-item>
                <f7-list-item class="ext-checkout-total" :title="tt('Total')" :after="money(totals.total)"></f7-list-item>
            </f7-list>

            <!-- how it is paid -->
            <f7-block class="no-margin-vertical">
                <f7-segmented strong>
                    <f7-button :active="payMode === 'full'" :disabled="submitting" @click="payMode = 'full'">{{ tt('Paid in full') }}</f7-button>
                    <f7-button :active="payMode === 'partial'" :disabled="submitting" @click="payMode = 'partial'">{{ tt('Part payment') }}</f7-button>
                    <f7-button :active="payMode === 'credit'" :disabled="submitting" @click="payMode = 'credit'">{{ tt('On credit') }}</f7-button>
                </f7-segmented>
            </f7-block>

            <f7-list strong inset dividers>
                <f7-list-item link="#" :title="tt('Amount paid now')" :after="money(partialPaid)"
                              @click="openPad('paid')" v-if="payMode === 'partial'"></f7-list-item>

                <f7-list-item link="#" :title="totals.credit > 0 ? tt('Customer') : tt('Customer (optional)')"
                              :after="customerLabel" :footer="problems.customer" @click="showCustomers = true">
                    <list-item-selection-popup value-type="item" key-field="value" value-field="value" title-field="title"
                                               :title="tt('Customer')" :enable-filter="true"
                                               :filter-placeholder="tt('Search customers')" :filter-no-items-text="tt('No customers match.')"
                                               :items="customerOptions"
                                               v-model:show="showCustomers" v-model="customerId">
                    </list-item-selection-popup>
                </f7-list-item>
                <f7-list-button :disabled="submitting" @click="showNewCustomer = true">{{ tt('+ New customer') }}</f7-list-button>
            </f7-list>

            <f7-block class="ext-credit-note" v-if="totals.credit > 0">
                {{ tt('{amount} will be recorded as owed by the customer.', { amount: money(totals.credit) }) }}
            </f7-block>

            <!-- where it is booked; remembered from the last sale -->
            <f7-block-title>{{ tt('Booking') }}</f7-block-title>
            <f7-list strong inset dividers>
                <f7-list-item link="#" :title="tt('Money goes into')" :after="optionTitle(paymentAccountOptions, paymentAccountId)"
                              :footer="problems.payment" @click="showPaymentAccounts = true" v-if="totals.paid > 0">
                    <list-item-selection-popup value-type="item" key-field="value" value-field="value" title-field="title"
                                               :title="tt('Money goes into')" :items="paymentAccountOptions"
                                               v-model:show="showPaymentAccounts" v-model="paymentAccountId">
                    </list-item-selection-popup>
                </f7-list-item>
                <f7-list-item link="#" :title="tt('Owed amount is tracked in')" :after="optionTitle(receivableAccountOptions, receivableAccountId)"
                              :footer="problems.receivable" @click="showReceivableAccounts = true" v-if="totals.credit > 0">
                    <list-item-selection-popup value-type="item" key-field="value" value-field="value" title-field="title"
                                               :title="tt('Owed amount is tracked in')" :items="receivableAccountOptions"
                                               v-model:show="showReceivableAccounts" v-model="receivableAccountId">
                    </list-item-selection-popup>
                </f7-list-item>
                <f7-list-item link="#" :title="tt('Income category')" :after="optionTitle(categoryOptions, categoryId)"
                              :footer="problems.category" @click="showCategories = true">
                    <list-item-selection-popup value-type="item" key-field="value" value-field="value" title-field="title"
                                               :title="tt('Income category')" :enable-filter="true"
                                               :filter-placeholder="tt('Income category')" :filter-no-items-text="tt('No results')"
                                               :items="categoryOptions"
                                               v-model:show="showCategories" v-model="categoryId">
                    </list-item-selection-popup>
                </f7-list-item>
                <f7-list-input type="text" clear-button :placeholder="tt('Note (optional)')"
                               :value="note" @input="note = $event.target.value"></f7-list-input>
            </f7-list>

            <f7-block class="ext-checkout-help" v-if="paymentAccounts.length < 1 || categoryOptions.length < 1">
                <p v-if="paymentAccounts.length < 1">{{ tt('Add an account such as Cash first: the money from sales goes into it.') }}</p>
                <p v-if="categoryOptions.length < 1">{{ tt('You have no income categories yet. A sale must be recorded under one, such as "Product sales".') }}</p>
                <f7-button tonal popup-close href="/account/add" v-if="paymentAccounts.length < 1">{{ tt('Add an account') }}</f7-button>
                <f7-button tonal popup-close class="margin-top-half" href="/category/all" v-if="categoryOptions.length < 1">{{ tt('Add a category') }}</f7-button>
            </f7-block>

            <f7-block>
                <f7-button large fill :disabled="!cartValid || submitting" @click="submit">
                    <f7-preloader size="20" color="white" v-if="submitting"></f7-preloader>
                    <span v-else>{{ tt('Complete sale') }} · {{ money(totals.total) }}</span>
                </f7-button>
            </f7-block>

            <number-pad-sheet :min-value="0" :max-value="padMax" :currency="currency" :hint="padHint"
                              v-model:show="showPad" v-model="padValue"></number-pad-sheet>
            <ext-mobile-customer-sheet v-model:show="showNewCustomer" @saved="addCustomer" />
        </f7-page>
    </f7-popup>
</template>

<script setup lang="ts">
import ExtMobileCustomerSheet from './ExtMobileCustomerSheet.vue';

import { ref, reactive, computed, watch } from 'vue';

import { parseBigDecimal } from '@/lib/numeral.ts';

import { useExtI18n } from '@/ext/shared/i18n.ts';
import api from '@/ext/shared/api.ts';
import { useBusiness } from '@/ext/shared/business.ts';
import { useBusinessAccounts, type PickerOption } from '@/ext/shared/accounts.ts';
import { loadFormDefaults, saveFormDefaults } from '@/ext/shared/defaults.ts';
import { formatQty, parseQty } from '@/ext/shared/qty.ts';
import type { SaleInfo } from '@/ext/shared/types.ts';

import { type CartLine, useSale } from './sale.ts';
import { promptText, showError, showToast } from './ui.ts';

// Checkout of the mobile Sell screen. The accounts and category are remembered per business (defaults.ts, shared
// with the desktop Sales page), so a regular cash sale needs only the Complete button.
defineProps<{
    show: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:show', value: boolean): void;
    (e: 'completed', sale: SaleInfo): void;
}>();

const MAX_AMOUNT = 99999999999; // what the app allows for a transaction amount

const { tt, formatAmountToLocalizedNumeralsWithCurrency } = useExtI18n();
const { current } = useBusiness();
const {
    customers, locationId, payMode, partialPaid, discount, customerId, note, paymentAccountId, receivableAccountId, categoryId,
    cart, totals, cartValid, canManage, stockOf, setQty, step, setPrice, clearCart, addCustomer
} = useSale();
const {
    paymentAccounts, receivableAccounts, selectedPaymentAccount, compatibleReceivables,
    paymentAccountOptions, receivableAccountOptions, incomeCategoryOptions: categoryOptions, currency, load: loadAccounts
} = useBusinessAccounts(paymentAccountId);

const submitting = ref<boolean>(false);
const showProblems = ref<boolean>(false);
const showCustomers = ref<boolean>(false);
const showNewCustomer = ref<boolean>(false);
const showPaymentAccounts = ref<boolean>(false);
const showReceivableAccounts = ref<boolean>(false);
const showCategories = ref<boolean>(false);

function money(minorUnits: number): string {
    return formatAmountToLocalizedNumeralsWithCurrency(parseBigDecimal(minorUnits), currency.value);
}

function priceLabel(line: CartLine): string {
    return tt('{price} each', { price: `${money(line.unitPrice)}${line.item.unit ? ' / ' + line.item.unit : ''}` });
}

function optionTitle(options: PickerOption[], value: string): string {
    return options.find(o => o.value === value)?.title ?? tt('Choose');
}

const customerOptions = computed<PickerOption[]>(() => [
    { title: tt('Walk-in customer'), value: '' },
    ...customers.value.map(c => ({ title: c.outstanding > 0 ? `${c.name} · ${tt('owes')} ${money(c.outstanding)}` : c.name, value: c.id }))
]);

const customerLabel = computed<string>(() => customers.value.find(c => c.id === customerId.value)?.name ?? tt('Walk-in customer'));

// ---- the number pad, shared by price, discount and the amount paid now
type PadTarget = { kind: 'price', itemId: string } | { kind: 'discount' } | { kind: 'paid' };

const padTarget = ref<PadTarget>({ kind: 'discount' });
const showPad = ref<boolean>(false);

const padValue = computed<number>({
    get: () => {
        const target = padTarget.value;

        if (target.kind === 'price') {
            return cart.value.find(l => l.itemId === target.itemId)?.unitPrice ?? 0;
        }

        return target.kind === 'discount' ? discount.value : partialPaid.value;
    },
    set: value => {
        const target = padTarget.value;

        if (target.kind === 'price') {
            setPrice(target.itemId, value);
        } else if (target.kind === 'discount') {
            discount.value = value;
        } else {
            partialPaid.value = value;
        }
    }
});

const padHint = computed<string>(() => {
    const target = padTarget.value;

    if (target.kind === 'price') {
        return tt('Price for {name}', { name: cart.value.find(l => l.itemId === target.itemId)?.item.name ?? '' });
    }

    return target.kind === 'discount' ? tt('Discount') : tt('Amount paid now');
});

const padMax = computed<number>(() => padTarget.value.kind === 'price' ? MAX_AMOUNT : totals.value.subtotal);

function openPad(kind: 'discount' | 'paid'): void {
    padTarget.value = { kind };
    showPad.value = true;
}

function editPrice(itemId: string): void {
    padTarget.value = { kind: 'price', itemId };
    showPad.value = true;
}

function askQuantity(itemId: string, name: string, qty: number): void {
    promptText(name, tt('How many?'), formatQty(qty), tt('OK'), tt('Cancel'), text => {
        const value = parseQty(text);

        if (value === null || value <= 0) {
            showToast(tt('Enter a quantity such as 2 or 0.5'));
        } else {
            setQty(itemId, value);
        }
    }, 'decimal');
}

// ---- validation, shown once Complete has been pressed
const problemList = computed(() => ({
    payment: totals.value.paid > 0 && !selectedPaymentAccount.value ? tt('Choose where the money goes') : '',
    customer: totals.value.credit > 0 && !customerId.value ? tt('A sale on credit needs a customer') : '',
    receivable: totals.value.credit > 0 && !compatibleReceivables.value.some(a => a.id === receivableAccountId.value)
        ? (compatibleReceivables.value.length < 1 ? tt('Create an account of type Receivables first') : tt('Choose where the owed amount is tracked'))
        : '',
    category: !categoryId.value ? tt('Choose an income category') : ''
}));

const problems = reactive({ payment: '', customer: '', receivable: '', category: '' });

watch([problemList, showProblems], () => {
    problems.payment = showProblems.value ? problemList.value.payment : '';
    problems.customer = showProblems.value ? problemList.value.customer : '';
    problems.receivable = showProblems.value ? problemList.value.receivable : '';
    problems.category = showProblems.value ? problemList.value.category : '';
}, { deep: true });

// keep the owed-money account valid when the payment account (and so the currency) changes
watch(compatibleReceivables, accounts => {
    if (!accounts.some(a => a.id === receivableAccountId.value)) {
        receivableAccountId.value = accounts[0]?.id ?? '';
    }
});

// ---- remembered choices
function businessKey(): string {
    return current.value?.ownerUid ?? 'own';
}

function applyDefaults(): void {
    const saved = loadFormDefaults(businessKey());

    if (!paymentAccounts.value.some(a => a.id === paymentAccountId.value)) {
        paymentAccountId.value = paymentAccounts.value.some(a => a.id === saved.payment) ? saved.payment! : (paymentAccounts.value[0]?.id ?? '');
    }

    if (!receivableAccounts.value.some(a => a.id === receivableAccountId.value)) {
        receivableAccountId.value = receivableAccounts.value.some(a => a.id === saved.receivable) ? saved.receivable! : (receivableAccounts.value[0]?.id ?? '');
    }

    if (!categoryOptions.value.some(c => c.value === categoryId.value)) {
        categoryId.value = categoryOptions.value.some(c => c.value === saved.category) ? saved.category! : (categoryOptions.value[0]?.value ?? '');
    }
}

async function onOpen(): Promise<void> {
    showProblems.value = false;

    try {
        await loadAccounts();
        applyDefaults();
    } catch (error) {
        showError(error);
    }
}

async function submit(): Promise<void> {
    showProblems.value = true;

    if (!cartValid.value || Object.values(problemList.value).some(Boolean)) {
        showToast(tt('Check the highlighted fields'));
        return;
    }

    submitting.value = true;

    try {
        const sale = await api.createSale({
            locationId: locationId.value || '0',
            customerId: customerId.value || '0',
            time: Math.floor(Date.now() / 1000),
            utcOffset: -new Date().getTimezoneOffset(),
            lines: cart.value.map(l => ({ itemId: l.itemId, qty: l.qty, unitPrice: l.priceOverridden ? l.unitPrice : undefined })),
            discount: totals.value.discount,
            amountPaid: totals.value.paid,
            paymentAccountId: totals.value.paid > 0 ? paymentAccountId.value : '0',
            receivableAccountId: totals.value.credit > 0 ? receivableAccountId.value : '0',
            categoryId: categoryId.value,
            note: note.value.trim()
        });

        saveFormDefaults(businessKey(), { payment: paymentAccountId.value, receivable: receivableAccountId.value, category: categoryId.value });
        clearCart();
        showProblems.value = false;
        emit('update:show', false);
        emit('completed', sale);
        loadAccounts(true).catch(() => {
            // only the balances shown elsewhere are stale until the next refresh
        });
    } catch (error) {
        showError(error);
    } finally {
        submitting.value = false;
    }
}
</script>

<style>
.ext-checkout-lines .item-inner {
    display: block;
    padding-top: 10px;
    padding-bottom: 10px;
}

.ext-line {
    display: flex;
    gap: 12px;
    align-items: flex-start;
}

.ext-line-main {
    flex: 1 1 auto;
    min-width: 0;
}

.ext-line-name {
    font-weight: 600;
}

.ext-line-detail,
.ext-line-problem {
    font-size: 0.85em;
    opacity: 0.75;
    margin-top: 2px;
}

.ext-line-problem {
    color: var(--f7-color-red);
    opacity: 1;
}

.ext-line-changed {
    font-style: italic;
}

.ext-line-side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
}

.ext-line-total {
    font-weight: 600;
}

.ext-stepper {
    display: flex;
    align-items: center;
    gap: 6px;
}

.ext-stepper .button {
    width: 36px;
    height: 32px;
    font-size: 1.2em;
}

.ext-stepper-qty {
    min-width: 36px;
    text-align: center;
    font-weight: 600;
}

.ext-checkout-total .item-title,
.ext-checkout-total .item-after {
    font-size: 1.2em;
    font-weight: 700;
    color: var(--f7-text-color);
}

.ext-checkout-popup .item-footer {
    color: var(--f7-color-red);
}

.ext-credit-note {
    color: var(--f7-color-orange);
    font-weight: 500;
}

.ext-checkout-help {
    opacity: 0.85;
}
</style>
