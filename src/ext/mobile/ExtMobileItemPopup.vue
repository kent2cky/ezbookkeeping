<template>
    <f7-popup class="ext-item-popup" :opened="show" @popup:open="onOpen" @popup:closed="emit('update:show', false)">
        <f7-page>
            <f7-navbar>
                <f7-nav-left>
                    <f7-link popup-close icon-f7="xmark" :aria-label="tt('Close')"></f7-link>
                </f7-nav-left>
                <f7-nav-title :title="item ? tt('Edit item') : tt('Add item')"></f7-nav-title>
            </f7-navbar>

            <f7-list strong inset dividers form class="margin-top">
                <f7-list-input type="text" clear-button :label="tt('Name')" :placeholder="tt('Name')"
                               :error-message="problems.name" :error-message-force="!!problems.name"
                               :value="name" @input="name = $event.target.value"></f7-list-input>
                <f7-list-input type="text" clear-button :label="tt('SKU or barcode')" :placeholder="tt('SKU')"
                               :error-message="problems.sku" :error-message-force="!!problems.sku"
                               :value="sku" @input="sku = $event.target.value"></f7-list-input>
                <f7-list-button class="ext-scan-sku" @click="showScanner = true" v-if="scanning">{{ tt('Scan barcode') }}</f7-list-button>
                <f7-list-input type="text" clear-button :label="tt('Unit (pcs, kg, ...)')" :placeholder="tt('pcs')"
                               :value="unit" @input="unit = $event.target.value"></f7-list-input>
            </f7-list>

            <f7-list strong inset dividers>
                <f7-list-item link="#" class="ext-price-row" :title="tt('Sale price')" :after="money(salePrice)" @click="openPad('sale')"></f7-list-item>
                <f7-list-item link="#" :title="tt('Cost price')" :after="money(costPrice)" @click="openPad('cost')"></f7-list-item>
            </f7-list>

            <f7-list strong inset dividers form>
                <f7-list-item :title="tt('Track stock')" :footer="trackStock ? '' : tt('Turn off for services and things you do not count.')">
                    <template #after>
                        <f7-toggle :checked="trackStock" @toggle:change="trackStock = $event"></f7-toggle>
                    </template>
                </f7-list-item>
                <f7-list-input type="text" inputmode="decimal" :label="tt('Reorder level')" :placeholder="'0'"
                               :info="tt('Shown as low stock at or below this quantity.')"
                               :error-message="problems.reorder" :error-message-force="!!problems.reorder"
                               :value="reorderText" @input="reorderText = $event.target.value" v-if="trackStock"></f7-list-input>
                <f7-list-input type="text" inputmode="decimal" :label="tt('Opening stock (optional)')" :placeholder="'0'"
                               :info="openingInfo"
                               :error-message="problems.opening" :error-message-force="!!problems.opening"
                               :value="openingText" @input="openingText = $event.target.value" v-if="trackStock && !item"></f7-list-input>
            </f7-list>

            <f7-block>
                <f7-button large fill :disabled="saving" @click="save">
                    <f7-preloader size="20" color="white" v-if="saving"></f7-preloader>
                    <span v-else>{{ tt('Save item') }}</span>
                </f7-button>
            </f7-block>

            <number-pad-sheet :min-value="0" :max-value="99999999999" :currency="currency"
                              :hint="padTarget === 'sale' ? tt('Sale price') : tt('Cost price')"
                              v-model:show="showPad" v-model="padValue"></number-pad-sheet>
            <ext-mobile-barcode-scanner single v-model:show="showScanner" @detected="code => sku = code" v-if="scanning" />
        </f7-page>
    </f7-popup>
</template>

<script setup lang="ts">
import ExtMobileBarcodeScanner from './ExtMobileBarcodeScanner.vue';

import { ref, computed } from 'vue';

import { parseBigDecimal } from '@/lib/numeral.ts';

import { useExtI18n } from '@/ext/shared/i18n.ts';
import api from '@/ext/shared/api.ts';
import { formatQty, parseQty } from '@/ext/shared/qty.ts';
import type { ItemInfo, LocationInfo } from '@/ext/shared/types.ts';

import { canScanBarcodes } from './barcode.ts';
import { showError } from './ui.ts';

// Adding or changing an item. Prices are per whole unit, on the number pad. The code can be scanned from the product,
// so the Sell screen's scanner finds it later. A new item can be given its opening stock in the same step.
const props = defineProps<{
    show: boolean;
    item: ItemInfo | null; // set to edit, empty to add
    currency: string;
    locations: LocationInfo[];
    presetSku?: string; // a code scanned on the Inventory screen that no item has yet
}>();

const emit = defineEmits<{
    (e: 'update:show', value: boolean): void;
    (e: 'saved', item: ItemInfo): void;
}>();

const { tt, formatAmountToLocalizedNumeralsWithCurrency } = useExtI18n();
const scanning = canScanBarcodes();

const name = ref<string>('');
const sku = ref<string>('');
const unit = ref<string>('');
const salePrice = ref<number>(0);
const costPrice = ref<number>(0);
const trackStock = ref<boolean>(true);
const reorderText = ref<string>('');
const openingText = ref<string>('');
const saving = ref<boolean>(false);
const showProblems = ref<boolean>(false);
const showScanner = ref<boolean>(false);
const showPad = ref<boolean>(false);
const padTarget = ref<'sale' | 'cost'>('sale');

const defaultLocation = computed<LocationInfo | undefined>(() => props.locations.find(l => l.isDefault) ?? props.locations[0]);

const openingInfo = computed<string>(() => props.locations.length > 1 && defaultLocation.value
    ? tt('What you have now, at {location}.', { location: defaultLocation.value.name })
    : tt('What you have now.'));

const padValue = computed<number>({
    get: () => padTarget.value === 'sale' ? salePrice.value : costPrice.value,
    set: value => {
        if (padTarget.value === 'sale') {
            salePrice.value = value;
        } else {
            costPrice.value = value;
        }
    }
});

function money(minorUnits: number): string {
    return formatAmountToLocalizedNumeralsWithCurrency(parseBigDecimal(minorUnits), props.currency);
}

function openPad(target: 'sale' | 'cost'): void {
    padTarget.value = target;
    showPad.value = true;
}

/** An empty box means 0; otherwise a plain number such as 5 or 2.5. */
function quantityOf(text: string): number | null {
    return text.trim() ? parseQty(text) : 0;
}

const problemList = computed(() => ({
    name: name.value.trim() ? '' : tt('Name is required'),
    sku: sku.value.trim() ? '' : tt('SKU is required'),
    reorder: trackStock.value && quantityOf(reorderText.value) === null ? tt('Enter a number such as 5 or 2.5') : '',
    opening: trackStock.value && !props.item && quantityOf(openingText.value) === null ? tt('Enter a number such as 5 or 2.5') : ''
}));

const problems = computed(() => showProblems.value ? problemList.value : { name: '', sku: '', reorder: '', opening: '' });

function onOpen(): void {
    showProblems.value = false;
    name.value = props.item?.name ?? '';
    sku.value = props.item?.sku ?? props.presetSku ?? '';
    unit.value = props.item?.unit ?? '';
    salePrice.value = props.item?.salePrice ?? 0;
    costPrice.value = props.item?.costPrice ?? 0;
    trackStock.value = props.item?.trackStock ?? true;
    reorderText.value = props.item && props.item.reorderLevel > 0 ? formatQty(props.item.reorderLevel) : '';
    openingText.value = '';
}

async function save(): Promise<void> {
    showProblems.value = true;

    if (Object.values(problemList.value).some(Boolean)) {
        return;
    }

    saving.value = true;

    try {
        const request = {
            sku: sku.value.trim(),
            name: name.value.trim(),
            unit: unit.value.trim(),
            costPrice: costPrice.value,
            salePrice: salePrice.value,
            reorderLevel: trackStock.value ? (quantityOf(reorderText.value) ?? 0) : 0,
            trackStock: trackStock.value
        };

        const saved = props.item
            ? await api.modifyItem({ ...request, id: props.item.id })
            : await api.addItem(request);

        const opening = trackStock.value && !props.item ? (quantityOf(openingText.value) ?? 0) : 0;

        if (opening > 0) {
            try {
                await api.receiveStock({ itemId: saved.id, locationId: defaultLocation.value?.id ?? '0', qty: opening, unitCost: costPrice.value, note: '', opening: true });
            } catch (error) {
                showError(error); // the item exists; its stock can be received from its own screen
            }
        }

        emit('saved', saved);
        emit('update:show', false);
    } catch (error) {
        showError(error);
    } finally {
        saving.value = false;
    }
}
</script>

<style>
.ext-price-row .item-after {
    font-weight: 600;
    color: var(--f7-text-color);
}
</style>
