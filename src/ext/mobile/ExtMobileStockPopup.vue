<template>
    <f7-popup class="ext-stock-popup" :opened="show" @popup:open="onOpen" @popup:closed="emit('update:show', false)">
        <f7-page>
            <f7-navbar>
                <f7-nav-left>
                    <f7-link popup-close icon-f7="xmark" :aria-label="tt('Close')"></f7-link>
                </f7-nav-left>
                <f7-nav-title :title="title" :subtitle="item?.name"></f7-nav-title>
            </f7-navbar>

            <template v-if="item">
                <f7-block class="no-margin-bottom" v-if="mode === 'adjust'">
                    <f7-segmented strong>
                        <f7-button :active="direction === 'add'" @click="direction = 'add'">{{ tt('Add stock') }}</f7-button>
                        <f7-button :active="direction === 'remove'" @click="direction = 'remove'">{{ tt('Remove stock') }}</f7-button>
                    </f7-segmented>
                </f7-block>

                <f7-list strong inset dividers form>
                    <f7-list-input type="text" inputmode="decimal" class="ext-qty-input"
                                   :label="quantityLabel" :placeholder="'0'"
                                   :error-message="problems.qty" :error-message-force="!!problems.qty"
                                   :value="qtyText" @input="qtyText = $event.target.value"></f7-list-input>
                </f7-list>

                <f7-list strong inset dividers>
                    <f7-list-item link="#" :title="mode === 'transfer' ? tt('From') : tt('Location')" :after="locationName(locationId)"
                                  @click="showFrom = true" v-if="locations.length > 1">
                        <list-item-selection-popup value-type="item" key-field="id" value-field="id" title-field="name"
                                                   :title="mode === 'transfer' ? tt('From') : tt('Location')" :items="locations"
                                                   v-model:show="showFrom" v-model="locationId">
                        </list-item-selection-popup>
                    </f7-list-item>
                    <f7-list-item link="#" class="ext-problem" :title="tt('To')" :after="locationName(toLocationId)" :footer="problems.to"
                                  @click="showTo = true" v-if="mode === 'transfer'">
                        <list-item-selection-popup value-type="item" key-field="id" value-field="id" title-field="name"
                                                   :title="tt('To')" :items="destinations"
                                                   v-model:show="showTo" v-model="toLocationId">
                        </list-item-selection-popup>
                    </f7-list-item>
                    <f7-list-item :title="tt('In stock here now')" :after="qtyLabel(currentStock)"></f7-list-item>
                    <f7-list-item class="ext-stock-after" :title="tt('Stock here after')" :after="qtyLabel(stockAfter)" v-if="change !== null"></f7-list-item>
                </f7-list>

                <f7-list strong inset dividers v-if="mode === 'receive'">
                    <f7-list-item link="#" :title="tt('Cost per unit')" :after="money(unitCost)" @click="showPad = true"></f7-list-item>
                    <f7-list-item :title="tt('This is opening stock')" :footer="tt('Stock you already had, not a new purchase.')">
                        <template #after>
                            <f7-toggle :checked="opening" @toggle:change="opening = $event"></f7-toggle>
                        </template>
                    </f7-list-item>
                </f7-list>

                <f7-list strong inset dividers form>
                    <f7-list-input type="text" clear-button :placeholder="notePlaceholder"
                                   :value="note" @input="note = $event.target.value"></f7-list-input>
                </f7-list>

                <f7-block>
                    <f7-button large fill :disabled="saving" @click="save">
                        <f7-preloader size="20" color="white" v-if="saving"></f7-preloader>
                        <span v-else>{{ title }}</span>
                    </f7-button>
                </f7-block>

                <number-pad-sheet :min-value="0" :max-value="99999999999" :currency="currency" :hint="tt('Cost per unit')"
                                  v-model:show="showPad" v-model="unitCost" v-if="mode === 'receive'"></number-pad-sheet>
            </template>
        </f7-page>
    </f7-popup>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

import { parseBigDecimal } from '@/lib/numeral.ts';

import { useExtI18n } from '@/ext/shared/i18n.ts';
import api from '@/ext/shared/api.ts';
import { formatQty, parseQty } from '@/ext/shared/qty.ts';
import type { ItemInfo, LocationInfo } from '@/ext/shared/types.ts';

import { useInventory } from './inventory.ts';
import { showError } from './ui.ts';

export type StockMode = 'receive' | 'adjust' | 'transfer';

// Receiving, adjusting and transferring stock of one item. Adjusting is "add" or "remove" rather than a signed number,
// and the stock after the change is shown before saving. The server checks again that stock never goes below zero.
const props = defineProps<{
    show: boolean;
    mode: StockMode;
    item: ItemInfo | null;
    currency: string;
}>();

const emit = defineEmits<{
    (e: 'update:show', value: boolean): void;
    (e: 'saved'): void;
}>();

const { tt, formatAmountToLocalizedNumeralsWithCurrency } = useExtI18n();
const { locations, stockOf } = useInventory();

const qtyText = ref<string>('');
const direction = ref<'add' | 'remove'>('remove');
const locationId = ref<string>('');
const toLocationId = ref<string>('');
const unitCost = ref<number>(0);
const opening = ref<boolean>(false);
const note = ref<string>('');
const saving = ref<boolean>(false);
const showProblems = ref<boolean>(false);
const showFrom = ref<boolean>(false);
const showTo = ref<boolean>(false);
const showPad = ref<boolean>(false);

const title = computed<string>(() => {
    switch (props.mode) {
        case 'receive': return tt('Receive stock');
        case 'adjust': return tt('Adjust stock');
        default: return tt('Transfer stock');
    }
});

const quantityLabel = computed<string>(() => {
    if (props.mode === 'adjust') {
        return direction.value === 'add' ? tt('How many to add') : tt('How many to remove');
    }

    return props.mode === 'receive' ? tt('How many received') : tt('How many to move');
});

const notePlaceholder = computed<string>(() => props.mode === 'adjust' ? tt('Reason, for example damaged (optional)') : tt('Note (optional)'));

const destinations = computed<LocationInfo[]>(() => locations.value.filter(l => l.id !== locationId.value));

const qty = computed<number | null>(() => {
    const value = parseQty(qtyText.value);
    return value !== null && value > 0 ? value : null;
});

const currentStock = computed<number>(() => props.item ? stockOf(props.item, locationId.value) : 0);

/** The change at the (from) location, or null while no valid quantity is entered. */
const change = computed<number | null>(() => {
    if (qty.value === null) {
        return null;
    }

    if (props.mode === 'receive' || (props.mode === 'adjust' && direction.value === 'add')) {
        return qty.value;
    }

    return -qty.value;
});

const stockAfter = computed<number>(() => currentStock.value + (change.value ?? 0));

const problemList = computed(() => ({
    qty: qty.value === null ? tt('Enter a number such as 5 or 2.5')
        : (stockAfter.value < 0 ? tt('Only {available} in stock here', { available: formatQty(currentStock.value) }) : ''),
    to: props.mode === 'transfer' && (!toLocationId.value || toLocationId.value === locationId.value) ? tt('Choose where it goes') : ''
}));

const problems = computed(() => showProblems.value ? problemList.value : { qty: '', to: '' });

function money(minorUnits: number): string {
    return formatAmountToLocalizedNumeralsWithCurrency(parseBigDecimal(minorUnits), props.currency);
}

function qtyLabel(value: number): string {
    return `${formatQty(value)}${props.item?.unit ? ' ' + props.item.unit : ''}`;
}

function locationName(id: string): string {
    return locations.value.find(l => l.id === id)?.name ?? tt('Choose');
}

function onOpen(): void {
    const defaultLocation = locations.value.find(l => l.isDefault) ?? locations.value[0];
    locationId.value = defaultLocation?.id ?? '';
    toLocationId.value = locations.value.find(l => l.id !== locationId.value)?.id ?? '';
    qtyText.value = '';
    direction.value = 'remove'; // adjustments are mostly breakage, loss and counting errors
    unitCost.value = props.item?.costPrice ?? 0;
    opening.value = false;
    note.value = '';
    showProblems.value = false;
}

async function save(): Promise<void> {
    if (!props.item) {
        return;
    }

    showProblems.value = true;

    if (Object.values(problemList.value).some(Boolean) || qty.value === null || change.value === null) {
        return;
    }

    saving.value = true;

    try {
        const location = locationId.value || '0';

        if (props.mode === 'receive') {
            await api.receiveStock({ itemId: props.item.id, locationId: location, qty: qty.value, unitCost: unitCost.value, note: note.value.trim(), opening: opening.value });
        } else if (props.mode === 'adjust') {
            await api.adjustStock({ itemId: props.item.id, locationId: location, qty: change.value, note: note.value.trim() });
        } else {
            await api.transferStock({ itemId: props.item.id, fromLocationId: location, toLocationId: toLocationId.value, qty: qty.value, note: note.value.trim() });
        }

        emit('saved');
        emit('update:show', false);
    } catch (error) {
        showError(error);
    } finally {
        saving.value = false;
    }
}
</script>

<style>
.ext-qty-input input {
    font-size: 1.5em;
    font-weight: 600;
}

.ext-stock-after .item-title,
.ext-stock-after .item-after {
    font-weight: 700;
    color: var(--f7-text-color);
}

.ext-stock-popup .ext-problem .item-footer {
    color: var(--f7-color-red);
}
</style>
