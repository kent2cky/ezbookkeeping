<template>
    <f7-page class="ext-inventory-page" with-subnavbar ptr @ptr:refresh="refresh">
        <f7-navbar :back-link="tt('Back')">
            <f7-nav-title :title="tt('Inventory')"></f7-nav-title>
            <f7-nav-right>
                <f7-link icon-f7="barcode_viewfinder" :aria-label="tt('Find by barcode')" @click="showScanner = true" v-if="scanning"></f7-link>
                <f7-link icon-f7="plus" :aria-label="tt('Add item')" @click="addItem('')" v-if="canManage"></f7-link>
            </f7-nav-right>
            <f7-subnavbar :inner="false">
                <f7-searchbar custom-searchs :disable-button="false"
                              :value="search" :placeholder="tt('Search by name or SKU')"
                              @input="search = $event.target.value"
                              @click:clear="search = ''"></f7-searchbar>
            </f7-subnavbar>
        </f7-navbar>

        <f7-block class="ext-stock-summary" v-if="loaded && items.length > 0">
            <span class="ext-summary-out" v-if="outCount > 0">{{ tt('{count} out of stock', { count: outCount }) }}</span>
            <span class="ext-summary-low" v-if="lowCount > 0">{{ tt('{count} running low', { count: lowCount }) }}</span>
            <span v-if="outCount < 1 && lowCount < 1">{{ tt('Everything is in stock.') }}</span>
        </f7-block>

        <f7-block class="no-margin-vertical" v-if="items.length > 0">
            <f7-segmented strong>
                <f7-button :active="!onlyAttention" @click="onlyAttention = false">{{ tt('All') }}</f7-button>
                <f7-button :active="onlyAttention" @click="onlyAttention = true">{{ tt('Low stock') }}</f7-button>
            </f7-segmented>
        </f7-block>

        <f7-list strong inset dividers class="margin-top-half" v-if="locations.length > 1 && items.length > 0">
            <f7-list-item link="#" :title="tt('Location')" :after="locationLabel" @click="showLocationFilter = true">
                <list-item-selection-popup value-type="item" key-field="value" value-field="value" title-field="title"
                                           :title="tt('Location')" :items="locationOptions"
                                           v-model:show="showLocationFilter" v-model="locationFilter">
                </list-item-selection-popup>
            </f7-list-item>
        </f7-list>

        <f7-list strong inset dividers media-list class="ext-item-list" v-if="visibleItems.length > 0">
            <f7-list-item :key="item.id" v-for="item in visibleItems"
                          :link="`/ext/item?id=${item.id}`"
                          :title="item.name"
                          :subtitle="`${item.sku} · ${money(item.salePrice)}`">
                <template #after>
                    <span class="ext-untracked" v-if="!item.trackStock">{{ tt('Not tracked') }}</span>
                    <f7-badge color="red" v-else-if="isOut(item, locationFilter)">{{ tt('Out') }}</f7-badge>
                    <span class="ext-stock-qty" :class="{ 'ext-stock-low': isLow(item, locationFilter) }" v-else>{{ qtyLabel(item) }}</span>
                </template>
            </f7-list-item>
        </f7-list>

        <f7-block class="text-align-center" v-else-if="loaded">
            <p v-if="items.length < 1">{{ tt('No items yet.') }}</p>
            <p v-else-if="onlyAttention">{{ tt('Nothing is running low.') }}</p>
            <p v-else>{{ tt('No items match your search.') }}</p>
            <f7-button tonal round @click="addItem('')" v-if="items.length < 1 && canManage">{{ tt('Add item') }}</f7-button>
        </f7-block>

        <f7-block class="text-align-center" v-else>
            <f7-preloader></f7-preloader>
        </f7-block>

        <f7-list strong inset dividers v-if="canManage && loaded">
            <f7-list-item link="/ext/locations" :title="tt('Locations')" :after="String(locations.length)">
                <template #media><f7-icon f7="building_2"></f7-icon></template>
            </f7-list-item>
        </f7-list>

        <ext-mobile-item-popup :item="null" :preset-sku="presetSku" :currency="currency" :locations="locations"
                               v-model:show="showAdd" @saved="onAdded" v-if="canManage" />
        <ext-mobile-barcode-scanner single v-model:show="showScanner" @detected="onScanned" v-if="scanning" />
    </f7-page>
</template>

<script setup lang="ts">
import ExtMobileItemPopup from './ExtMobileItemPopup.vue';
import ExtMobileBarcodeScanner from './ExtMobileBarcodeScanner.vue';

import { ref, computed, onMounted } from 'vue';
import type { Router } from 'framework7/types';

import { parseBigDecimal } from '@/lib/numeral.ts';

import { useExtI18n } from '@/ext/shared/i18n.ts';
import { useBusiness } from '@/ext/shared/business.ts';
import { useBusinessAccounts } from '@/ext/shared/accounts.ts';
import { formatQty } from '@/ext/shared/qty.ts';
import type { ItemInfo } from '@/ext/shared/types.ts';

import { useInventory } from './inventory.ts';
import { canScanBarcodes, sameCode } from './barcode.ts';
import { confirmAction, showError, showToast } from './ui.ts';

// What the business stocks, with what needs attention (out of stock, then running low) first. Everybody can look;
// adding items, changing stock and locations are for owners and managers (the server enforces it too).
const props = defineProps<{
    f7router: Router.Router;
}>();

const { tt, formatAmountToLocalizedNumeralsWithCurrency } = useExtI18n();
const { canManage } = useBusiness();
const { items, locations, loaded, load, reloadAfterChange, stockOf, isOut, isLow } = useInventory();
const { currency, load: loadAccounts } = useBusinessAccounts(ref(''));

const scanning = canScanBarcodes();

const search = ref<string>('');
const onlyAttention = ref<boolean>(false);
const locationFilter = ref<string>(''); // '' is every location
const showLocationFilter = ref<boolean>(false);
const showAdd = ref<boolean>(false);
const showScanner = ref<boolean>(false);
const presetSku = ref<string>('');

const locationOptions = computed(() => [
    { title: tt('All locations'), value: '' },
    ...locations.value.map(l => ({ title: l.name, value: l.id }))
]);

const locationLabel = computed<string>(() => locationOptions.value.find(o => o.value === locationFilter.value)?.title ?? '');

const outCount = computed<number>(() => items.value.filter(i => isOut(i, locationFilter.value)).length);
const lowCount = computed<number>(() => items.value.filter(i => isLow(i, locationFilter.value)).length);

function attentionRank(item: ItemInfo): number {
    if (isOut(item, locationFilter.value)) {
        return 0;
    }

    return isLow(item, locationFilter.value) ? 1 : 2;
}

const visibleItems = computed<ItemInfo[]>(() => {
    const needle = search.value.trim().toLowerCase();

    return items.value
        .filter(item => (!needle || item.name.toLowerCase().includes(needle) || item.sku.toLowerCase().includes(needle))
            && (!onlyAttention.value || attentionRank(item) < 2))
        .sort((a, b) => attentionRank(a) - attentionRank(b) || a.name.localeCompare(b.name));
});

function money(minorUnits: number): string {
    return formatAmountToLocalizedNumeralsWithCurrency(parseBigDecimal(minorUnits), currency.value);
}

function qtyLabel(item: ItemInfo): string {
    return `${formatQty(stockOf(item, locationFilter.value))}${item.unit ? ' ' + item.unit : ''}`;
}

function addItem(sku: string): void {
    presetSku.value = sku;
    showAdd.value = true;
}

// A scanned code opens its item; an unknown code can become a new item straight away
function onScanned(code: string): void {
    const item = items.value.find(i => i.sku && sameCode(i.sku, code));

    if (item) {
        props.f7router.navigate(`/ext/item?id=${item.id}`);
    } else if (canManage.value) {
        confirmAction(tt('New code'), tt('No item has the code {code}. Add it as a new item?', { code }), tt('Add item'), tt('Cancel'), () => addItem(code));
    } else {
        showToast(tt('No item has the code {code}', { code }));
    }
}

async function onAdded(item: ItemInfo): Promise<void> {
    showToast(tt('Item saved'));
    await reloadAfterChange();
    props.f7router.navigate(`/ext/item?id=${item.id}`);
}

async function refresh(done?: () => void): Promise<void> {
    try {
        await Promise.all([load(), loadAccounts()]);

        if (locationFilter.value && !locations.value.some(l => l.id === locationFilter.value)) {
            locationFilter.value = '';
        }
    } catch (error) {
        showError(error);
    } finally {
        done?.();
    }
}

onMounted(() => refresh());
</script>

<style>
.ext-stock-summary {
    display: flex;
    gap: 16px;
    margin-top: 12px;
    margin-bottom: 12px;
    font-weight: 600;
}

.ext-summary-out {
    color: var(--f7-color-red);
}

.ext-summary-low {
    color: var(--f7-color-orange);
}

.ext-item-list .item-title {
    font-weight: 600;
}

.ext-stock-qty {
    font-weight: 600;
    color: var(--f7-text-color);
}

.ext-stock-qty.ext-stock-low {
    color: var(--f7-color-orange);
}

.ext-untracked {
    opacity: 0.6;
}
</style>
