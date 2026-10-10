<template>
    <f7-page class="ext-sell-page" ptr @ptr:refresh="refresh">
        <f7-navbar :back-link="tt('Back')">
            <f7-nav-title :title="tt('Sell')" :subtitle="workingForSomeoneElse && current ? current.name : undefined"></f7-nav-title>
            <f7-nav-right>
                <f7-link icon-f7="barcode_viewfinder" :aria-label="tt('Scan items')" @click="showScanner = true" v-if="scanning"></f7-link>
                <f7-link icon-f7="ellipsis_circle" :aria-label="tt('Business')" href="/ext/business"></f7-link>
            </f7-nav-right>
            <f7-subnavbar :inner="false">
                <f7-searchbar custom-searchs :disable-button="false"
                              :value="search" :placeholder="tt('Search by name or SKU')"
                              @input="search = $event.target.value"
                              @click:clear="search = ''"></f7-searchbar>
            </f7-subnavbar>
        </f7-navbar>

        <div class="ext-shortcuts">
            <f7-button small tonal round href="/ext/sales">{{ tt('Recent sales') }}</f7-button>
            <f7-button small tonal round href="/ext/customers">{{ tt('Customers') }}</f7-button>
            <f7-button small tonal round href="/ext/inventory">{{ tt('Inventory') }}</f7-button>
            <f7-button small tonal round href="/ext/reports" v-if="canManage">{{ tt('Reports') }}</f7-button>
            <f7-button small tonal round href="/ext/team">{{ tt('Team') }}</f7-button>
        </div>

        <f7-list strong inset dividers class="no-margin-top margin-bottom-half" v-if="invitations.length > 0">
            <f7-list-item link="/ext/team" class="ext-invitation-row"
                          :title="tt('{name} invited you to work in their business', { name: invitations[0]?.name ?? '' })"
                          :footer="tt('Accept or decline on the Team screen.')">
                <template #media><f7-icon f7="envelope_badge"></f7-icon></template>
            </f7-list-item>
        </f7-list>

        <f7-list strong inset dividers class="no-margin-top margin-bottom-half" v-if="working.length > 1">
            <f7-list-item link="#" :title="tt('Working in')" :after="businessLabel(current)" @click="showBusinesses = true"></f7-list-item>
        </f7-list>

        <f7-list strong inset dividers class="no-margin-top margin-bottom-half" v-if="locations.length > 1">
            <f7-list-item link="#" :title="tt('Sell from')" :after="locationName" @click="showLocations = true">
                <list-item-selection-popup value-type="item" key-field="id" value-field="id" title-field="name"
                                           :title="tt('Sell from')" :items="locations"
                                           v-model:show="showLocations" v-model="locationId">
                </list-item-selection-popup>
            </f7-list-item>
        </f7-list>

        <f7-list strong inset dividers media-list class="no-margin-top ext-sell-items" v-if="visibleItems.length > 0">
            <f7-list-item link="#" no-chevron
                          :key="item.id" v-for="item in visibleItems"
                          :class="{ 'ext-item-unavailable': item.trackStock && leftOf(item) <= 0 }"
                          :title="item.name"
                          :subtitle="itemSubtitle(item)"
                          @click="tapItem(item)" @taphold="askQuantity(item)">
                <template #after>
                    <span class="ext-item-price">{{ money(item.salePrice) }}</span>
                    <f7-badge color="primary" class="margin-left-half" v-if="inCart(item.id) > 0">{{ formatQty(inCart(item.id)) }}</f7-badge>
                </template>
            </f7-list-item>
        </f7-list>

        <f7-block class="text-align-center" v-else-if="loaded">
            <p v-if="items.length < 1">{{ tt('No items yet. Add items on the Inventory page first.') }}</p>
            <p v-else>{{ tt('No items match your search.') }}</p>
            <f7-button tonal round href="/ext/inventory" v-if="items.length < 1">{{ tt('Inventory') }}</f7-button>
        </f7-block>

        <f7-block class="text-align-center" v-else>
            <f7-preloader></f7-preloader>
        </f7-block>

        <f7-block class="ext-sell-hint text-align-center" v-if="visibleItems.length > 0 && itemCount < 1">
            {{ tt('Tap an item to add it. Hold it to type a quantity.') }}
        </f7-block>

        <f7-toolbar bottom class="ext-charge-bar" v-if="itemCount > 0">
            <f7-link @click="confirmClear">{{ tt('Clear') }}</f7-link>
            <f7-button fill large class="ext-charge-button" @click="showCheckout = true">
                {{ tt('Charge {total}', { total: money(totals.total) }) }}
                <span class="ext-charge-count">· {{ itemCountLabel }}</span>
            </f7-button>
        </f7-toolbar>

        <f7-actions :opened="showBusinesses" @actions:closed="showBusinesses = false">
            <f7-actions-group>
                <f7-actions-label>{{ tt('Working in') }}</f7-actions-label>
                <f7-actions-button :key="business.ownerUid" v-for="business in working"
                                   :bold="current?.ownerUid === business.ownerUid"
                                   @click="chooseBusiness(business)">{{ businessLabel(business) }}</f7-actions-button>
            </f7-actions-group>
            <f7-actions-group>
                <f7-actions-button bold>{{ tt('Cancel') }}</f7-actions-button>
            </f7-actions-group>
        </f7-actions>

        <ext-mobile-checkout-popup v-model:show="showCheckout" @completed="onSaleCompleted" />
        <ext-mobile-receipt-popup :receipt="receipt" :heading="receiptHeading" v-model:show="showReceipt" />
        <ext-mobile-barcode-scanner :last-message="scanMessage" v-model:show="showScanner" @detected="onScanned" v-if="scanning" />
    </f7-page>
</template>

<script setup lang="ts">
import ExtMobileCheckoutPopup from './ExtMobileCheckoutPopup.vue';
import ExtMobileReceiptPopup from './ExtMobileReceiptPopup.vue';
import ExtMobileBarcodeScanner from './ExtMobileBarcodeScanner.vue';

import { ref, computed, onMounted } from 'vue';

import { parseBigDecimal } from '@/lib/numeral.ts';
import { getMobileVersionPath } from '@/lib/version.ts';

import { useExtI18n } from '@/ext/shared/i18n.ts';
import { switchBusiness, useBusiness } from '@/ext/shared/business.ts';
import { useBusinessAccounts } from '@/ext/shared/accounts.ts';
import { useReceipts } from '@/ext/shared/useReceipts.ts';
import { formatQty, parseQty } from '@/ext/shared/qty.ts';
import type { BusinessInfo, ItemInfo, SaleInfo } from '@/ext/shared/types.ts';

import { useSale, reopenSellAfterStart } from './sale.ts';
import { canScanBarcodes, sameCode } from './barcode.ts';
import { confirmAction, promptText, showError, showToast } from './ui.ts';

// The mobile Sell screen: tap items to fill the cart, then Charge. Everything else (who pays, into which account)
// is on the checkout sheet with the last choices remembered, so the usual cash sale is: tap, tap, Charge, Complete.
const { tt, roleLabel, formatAmountToLocalizedNumeralsWithCurrency } = useExtI18n();
const { working, current, invitations, workingForSomeoneElse } = useBusiness();
const {
    items, locations, loaded, locationId, paymentAccountId, totals, itemCount, canManage,
    stockOf, inCart, leftOf, add, clearCart, load, refreshAfterSale
} = useSale();
const { currency, load: loadAccounts } = useBusinessAccounts(paymentAccountId);
const { receipt, show: showReceipt, openSale } = useReceipts();

const scanning = canScanBarcodes();

const search = ref<string>('');
const showLocations = ref<boolean>(false);
const showCheckout = ref<boolean>(false);
const showScanner = ref<boolean>(false);
const showBusinesses = ref<boolean>(false);
const scanMessage = ref<string>('');
const receiptHeading = ref<string>('');

const locationName = computed<string>(() => locations.value.find(l => l.id === locationId.value)?.name ?? '');

const visibleItems = computed<ItemInfo[]>(() => {
    const needle = search.value.trim().toLowerCase();
    return items.value.filter(item => !needle || item.name.toLowerCase().includes(needle) || item.sku.toLowerCase().includes(needle));
});

const itemCountLabel = computed<string>(() => itemCount.value === 1 ? tt('1 item') : tt('{count} items', { count: itemCount.value }));

function money(minorUnits: number): string {
    return formatAmountToLocalizedNumeralsWithCurrency(parseBigDecimal(minorUnits), currency.value);
}

// people who work in somebody else's business choose here where they are selling (the desktop app has the same choice
// in its profile menu)
function businessLabel(business: BusinessInfo | undefined): string {
    if (!business) {
        return '';
    }

    return business.status === 'owner' ? tt('ext.yourOwnBusiness') : `${business.name} · ${roleLabel(business.role)}`;
}

function chooseBusiness(business: BusinessInfo): void {
    if (business.ownerUid !== current.value?.ownerUid) {
        // the app starts afresh so every screen shows the chosen business, and comes back to selling
        reopenSellAfterStart();
        switchBusiness(business.ownerUid, getMobileVersionPath());
    }
}

function itemSubtitle(item: ItemInfo): string {
    const parts: string[] = [];

    if (item.sku) {
        parts.push(item.sku);
    }

    if (item.trackStock) {
        const stock = stockOf(item);
        parts.push(stock > 0 ? tt('{qty} in stock', { qty: `${formatQty(stock)}${item.unit ? ' ' + item.unit : ''}` }) : tt('Out of stock'));
    }

    return parts.join(' · ');
}

function tapItem(item: ItemInfo): void {
    if (!add(item)) {
        showToast(tt('Not enough {name} in stock', { name: item.name }));
    }
}

// Hold an item to type a quantity such as 2.5 (kg, metres...)
function askQuantity(item: ItemInfo): void {
    promptText(item.name, tt('How many?'), '', tt('Add'), tt('Cancel'), text => {
        const qty = parseQty(text);

        if (qty === null || qty <= 0) {
            showToast(tt('Enter a quantity such as 2 or 0.5'));
        } else if (!add(item, qty)) {
            showToast(tt('Only {available} available here', { available: formatQty(leftOf(item)) }));
        }
    }, 'decimal');
}

function onScanned(code: string): void {
    const item = items.value.find(i => i.sku && sameCode(i.sku, code));

    if (!item) {
        scanMessage.value = tt('No item has the code {code}', { code });
    } else if (add(item)) {
        scanMessage.value = tt('Added {name} ({count} in cart)', { name: item.name, count: formatQty(inCart(item.id)) });
    } else {
        scanMessage.value = tt('Not enough {name} in stock', { name: item.name });
    }
}

function confirmClear(): void {
    confirmAction(tt('Clear cart'), tt('Remove everything from the cart?'), tt('Clear'), tt('Cancel'), clearCart);
}

async function onSaleCompleted(sale: SaleInfo): Promise<void> {
    receiptHeading.value = tt('Sale #{id} recorded', { id: sale.id });

    try {
        await Promise.all([refreshAfterSale(), openSale(sale)]);
    } catch (error) {
        showError(error);
    }
}

async function refresh(done?: () => void): Promise<void> {
    try {
        await Promise.all([load(true), loadAccounts(true)]);
    } catch (error) {
        showError(error);
    } finally {
        done?.();
    }
}

onMounted(async () => {
    try {
        await Promise.all([load(), loadAccounts()]);
    } catch (error) {
        showError(error);
    }
});
</script>

<style>
.ext-shortcuts {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 12px 16px;
    scrollbar-width: none;
}

.ext-shortcuts::-webkit-scrollbar {
    display: none;
}

.ext-shortcuts .button {
    flex: 0 0 auto;
    width: auto;
}

.ext-invitation-row .item-title {
    white-space: normal;
    font-weight: 600;
}

.ext-sell-items .item-title {
    font-weight: 600;
}

.ext-item-price {
    font-weight: 600;
    color: var(--f7-text-color);
}

.ext-item-unavailable {
    opacity: 0.5;
}

.ext-sell-hint {
    opacity: 0.6;
    font-size: 0.9em;
}

.ext-charge-bar .toolbar-inner {
    gap: 12px;
    padding: 0 12px;
}

.ext-charge-button {
    flex: 1 1 auto;
    max-width: 75%;
}

.ext-charge-count {
    font-weight: normal;
    opacity: 0.85;
    margin-left: 4px;
}
</style>
