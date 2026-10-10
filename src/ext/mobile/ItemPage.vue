<template>
    <f7-page class="ext-item-page" ptr @ptr:refresh="refresh">
        <f7-navbar :back-link="tt('Back')">
            <f7-nav-title :title="item?.name ?? tt('Item')"></f7-nav-title>
            <f7-nav-right v-if="canManage && item">
                <f7-link icon-f7="ellipsis_circle" :aria-label="tt('More')" @click="showActions = true"></f7-link>
            </f7-nav-right>
        </f7-navbar>

        <template v-if="item">
            <f7-block class="ext-balance">
                <template v-if="item.trackStock">
                    <div class="ext-balance-label">{{ tt('In stock') }}</div>
                    <div class="ext-balance-amount" :class="{ 'ext-stock-out': isOut(item), 'ext-stock-low': isLow(item) }">{{ qtyLabel(stockOf(item)) }}</div>
                    <f7-badge color="red" v-if="isOut(item)">{{ tt('Out of stock') }}</f7-badge>
                    <f7-badge color="orange" v-else-if="isLow(item)">{{ tt('Running low') }}</f7-badge>
                </template>
                <div class="ext-balance-label" v-else>{{ tt('Stock is not tracked for this item.') }}</div>
            </f7-block>

            <f7-block class="ext-customer-actions" v-if="canManage && item.trackStock">
                <f7-button large fill @click="openStock('receive')">{{ tt('Receive stock') }}</f7-button>
                <div class="ext-action-row">
                    <f7-button tonal @click="openStock('adjust')">{{ tt('Adjust') }}</f7-button>
                    <f7-button tonal @click="openStock('transfer')" v-if="locations.length > 1">{{ tt('Transfer') }}</f7-button>
                </div>
            </f7-block>

            <template v-if="item.trackStock && locations.length > 1">
                <f7-block-title>{{ tt('By location') }}</f7-block-title>
                <f7-list strong inset dividers>
                    <f7-list-item :key="location.id" v-for="location in locations"
                                  :title="location.name" :after="qtyLabel(stockOf(item, location.id))"></f7-list-item>
                </f7-list>
            </template>

            <f7-block-title>{{ tt('Details') }}</f7-block-title>
            <f7-list strong inset dividers>
                <f7-list-item :title="tt('SKU')" :after="item.sku"></f7-list-item>
                <f7-list-item :title="tt('Sale price')" :after="money(item.salePrice) + (item.unit ? ' / ' + item.unit : '')"></f7-list-item>
                <f7-list-item :title="tt('Cost price')" :after="money(item.costPrice)" v-if="canManage"></f7-list-item>
                <f7-list-item :title="tt('Reorder level')" :after="qtyLabel(item.reorderLevel)" v-if="item.trackStock && item.reorderLevel > 0"></f7-list-item>
            </f7-list>

            <template v-if="canManage && item.trackStock">
                <f7-block-title>{{ tt('Stock history') }}</f7-block-title>
                <f7-list strong inset dividers media-list v-if="movements.length > 0">
                    <f7-list-item :key="movement.id" v-for="movement in movements"
                                  :title="reasonLabel(movement.reason)"
                                  :subtitle="formatTime(movement.time)"
                                  :text="movementText(movement)">
                        <template #after>
                            <span :class="movement.qtyChange >= 0 ? 'ext-change-in' : 'ext-change-out'">{{ signed(movement.qtyChange) }}</span>
                        </template>
                    </f7-list-item>
                </f7-list>
                <f7-block class="ext-muted" v-else-if="loadedHistory">{{ tt('Nothing yet.') }}</f7-block>
                <f7-block v-if="moreHistory">
                    <f7-button tonal :disabled="loadingMore" @click="loadMore">{{ tt('Show more') }}</f7-button>
                </f7-block>
            </template>
        </template>

        <f7-block class="text-align-center" v-else-if="loaded">
            <p>{{ tt('This item no longer exists.') }}</p>
        </f7-block>

        <f7-block class="text-align-center" v-else>
            <f7-preloader></f7-preloader>
        </f7-block>

        <f7-actions :opened="showActions" @actions:closed="showActions = false">
            <f7-actions-group>
                <f7-actions-button @click="showEdit = true">{{ tt('Edit item') }}</f7-actions-button>
                <f7-actions-button color="red" @click="confirmDelete">{{ tt('Delete item') }}</f7-actions-button>
            </f7-actions-group>
            <f7-actions-group>
                <f7-actions-button bold>{{ tt('Cancel') }}</f7-actions-button>
            </f7-actions-group>
        </f7-actions>

        <ext-mobile-stock-popup :mode="stockMode" :item="item ?? null" :currency="currency" v-model:show="showStock" @saved="onStockSaved" v-if="canManage" />
        <ext-mobile-item-popup :item="item ?? null" :currency="currency" :locations="locations" v-model:show="showEdit" @saved="onEdited" v-if="canManage" />
    </f7-page>
</template>

<script setup lang="ts">
import ExtMobileStockPopup, { type StockMode } from './ExtMobileStockPopup.vue';
import ExtMobileItemPopup from './ExtMobileItemPopup.vue';

import { ref, computed, onMounted } from 'vue';
import type { Router } from 'framework7/types';

import { parseBigDecimal } from '@/lib/numeral.ts';
import { parseDateTimeFromUnixTime } from '@/lib/datetime.ts';

import { useExtI18n } from '@/ext/shared/i18n.ts';
import api from '@/ext/shared/api.ts';
import { useBusiness } from '@/ext/shared/business.ts';
import { useBusinessAccounts } from '@/ext/shared/accounts.ts';
import { usePeople } from '@/ext/shared/people.ts';
import { formatQty } from '@/ext/shared/qty.ts';
import type { ItemInfo, StockMovement } from '@/ext/shared/types.ts';

import { useInventory } from './inventory.ts';
import { confirmAction, showError, showToast } from './ui.ts';

// One item: how much is in stock (in total and per location), the buttons to receive, adjust and transfer stock, and
// the stock history. Owners and managers change things; staff see stock and the sale price only.
const props = defineProps<{
    f7route: Router.Route;
    f7router: Router.Router;
}>();

const HISTORY_PAGE = 50; // what the server sends at a time

const { tt, formatAmountToLocalizedNumeralsWithCurrency, formatDateTimeToLongDateTime } = useExtI18n();
const { canManage } = useBusiness();
const { locations, loaded, load, reloadAfterChange, find, stockOf, isOut, isLow } = useInventory();
const { currency, load: loadAccounts } = useBusinessAccounts(ref(''));
const { load: loadPeople, nameOf } = usePeople();

const itemId = String(props.f7route.query['id'] ?? '');

const movements = ref<StockMovement[]>([]);
const loadedHistory = ref<boolean>(false);
const moreHistory = ref<boolean>(false);
const loadingMore = ref<boolean>(false);
const showActions = ref<boolean>(false);
const showStock = ref<boolean>(false);
const showEdit = ref<boolean>(false);
const stockMode = ref<StockMode>('receive');

const item = computed<ItemInfo | undefined>(() => find(itemId));

function money(minorUnits: number): string {
    return formatAmountToLocalizedNumeralsWithCurrency(parseBigDecimal(minorUnits), currency.value);
}

function qtyLabel(value: number): string {
    return `${formatQty(value)}${item.value?.unit ? ' ' + item.value.unit : ''}`;
}

function signed(value: number): string {
    return value > 0 ? `+${formatQty(value)}` : formatQty(value);
}

function formatTime(unixTime: number): string {
    return formatDateTimeToLongDateTime(parseDateTimeFromUnixTime(unixTime));
}

// matches StockReason in pkg/ext/models
function reasonLabel(reason: number): string {
    switch (reason) {
        case 1: return tt('Opening stock');
        case 2: return tt('Purchase');
        case 3: return tt('Sale');
        case 4: return tt('Adjustment');
        case 5: return tt('Transferred out');
        case 6: return tt('Transferred in');
        case 7: return tt('Sale voided');
        default: return String(reason);
    }
}

function movementText(movement: StockMovement): string {
    const name = nameOf(movement.actorUid);
    const location = locations.value.length > 1 ? locations.value.find(l => l.id === movement.locationId)?.name : '';
    return [location, name ? tt('by {name}', { name }) : '', movement.note].filter(Boolean).join(' · ');
}

function openStock(mode: StockMode): void {
    stockMode.value = mode;
    showStock.value = true;
}

async function loadHistory(): Promise<void> {
    if (!canManage.value) {
        return; // the stock history is for owners and managers
    }

    const page = await api.listStockMovements(itemId);
    movements.value = page;
    moreHistory.value = page.length >= HISTORY_PAGE;
    loadedHistory.value = true;
}

async function loadMore(): Promise<void> {
    const last = movements.value[movements.value.length - 1];

    if (!last) {
        return;
    }

    loadingMore.value = true;

    try {
        const page = await api.listStockMovements(itemId, last.id);
        movements.value = [...movements.value, ...page];
        moreHistory.value = page.length >= HISTORY_PAGE;
    } catch (error) {
        showError(error);
    } finally {
        loadingMore.value = false;
    }
}

async function onStockSaved(): Promise<void> {
    showToast(tt('Stock updated'));

    try {
        await Promise.all([reloadAfterChange(), loadHistory()]);
    } catch (error) {
        showError(error);
    }
}

async function onEdited(): Promise<void> {
    showToast(tt('Item saved'));

    try {
        await reloadAfterChange();
    } catch (error) {
        showError(error);
    }
}

function confirmDelete(): void {
    if (!item.value) {
        return;
    }

    confirmAction(tt('Delete item'), tt('ext.confirmDeleteItem', { name: item.value.name }), tt('Delete'), tt('Cancel'), async () => {
        try {
            await api.deleteItem(itemId);
            showToast(tt('Item deleted'));
            await reloadAfterChange();
            props.f7router.back();
        } catch (error) {
            showError(error);
        }
    });
}

async function refresh(done?: () => void): Promise<void> {
    try {
        await Promise.all([load(), loadAccounts(), loadPeople()]);
        await loadHistory();
    } catch (error) {
        showError(error);
    } finally {
        done?.();
    }
}

onMounted(() => refresh());
</script>

<style>
.ext-stock-out {
    color: var(--f7-color-red);
}

.ext-balance-amount.ext-stock-low {
    color: var(--f7-color-orange);
}

.ext-change-in {
    color: var(--f7-color-green);
    font-weight: 600;
}

.ext-change-out {
    color: var(--f7-color-red);
    font-weight: 600;
}
</style>
