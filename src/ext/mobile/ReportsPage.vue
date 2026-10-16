<template>
    <f7-page class="ext-reports-page" ptr @ptr:refresh="refresh">
        <f7-navbar :title="tt('Reports')" :back-link="tt('Back')"></f7-navbar>

        <f7-block class="text-align-center" v-if="!canManage">
            <p>{{ tt('Reports are for managers and the owner.') }}</p>
        </f7-block>

        <template v-else>
            <f7-block class="margin-top no-margin-bottom">
                <f7-segmented strong>
                    <f7-button :active="tab === 'stock'" @click="tab = 'stock'">{{ tt('Stock value') }}</f7-button>
                    <f7-button :active="tab === 'low'" @click="tab = 'low'">{{ tt('Low stock') }}<span v-if="lowStock.length > 0"> ({{ lowStock.length }})</span></f7-button>
                    <f7-button :active="tab === 'receivables'" @click="tab = 'receivables'">{{ tt('Who owes') }}</f7-button>
                </f7-segmented>
            </f7-block>

            <f7-list strong inset dividers v-if="tab !== 'receivables' && locations.length > 1">
                <f7-list-item link="#" :title="tt('Location')" :after="locationLabel" @click="showLocations = true">
                    <list-item-selection-popup value-type="item" key-field="value" value-field="value" title-field="title"
                                               :title="tt('Location')" :items="locationOptions"
                                               v-model:show="showLocations" v-model="locationFilter">
                    </list-item-selection-popup>
                </f7-list-item>
            </f7-list>

            <f7-block class="text-align-center" v-if="loading">
                <f7-preloader></f7-preloader>
            </f7-block>

            <!-- what the stock is worth -->
            <template v-else-if="tab === 'stock' && stockValue">
                <div class="ext-figures">
                    <div class="ext-figure">
                        <div class="ext-figure-label">{{ tt('At cost') }}</div>
                        <div class="ext-figure-value">{{ money(stockValue.totalCostValue) }}</div>
                    </div>
                    <div class="ext-figure">
                        <div class="ext-figure-label">{{ tt('At selling price') }}</div>
                        <div class="ext-figure-value">{{ money(stockValue.totalRetailValue) }}</div>
                    </div>
                    <div class="ext-figure ext-figure-wide">
                        <div class="ext-figure-label">{{ tt('Profit if all of it sells') }}</div>
                        <div class="ext-figure-value ext-figure-good">{{ money(stockValue.totalRetailValue - stockValue.totalCostValue) }}</div>
                    </div>
                </div>
                <f7-list strong inset dividers media-list v-if="stockValue.rows.length > 0">
                    <f7-list-item :key="row.item.id" v-for="row in stockValue.rows"
                                  :link="`/ext/item?id=${row.item.id}`"
                                  :title="row.item.name"
                                  :subtitle="tt('{qty} in stock', { qty: qtyLabel(row.qty, row.item.unit) })"
                                  :text="tt('At cost {cost}', { cost: money(row.costValue) })">
                        <template #after><span class="ext-figure-cell">{{ money(row.retailValue) }}</span></template>
                    </f7-list-item>
                </f7-list>
                <f7-block class="ext-muted" v-else>{{ tt('There is no stock on hand.') }}</f7-block>
            </template>

            <!-- what to reorder -->
            <template v-else-if="tab === 'low'">
                <f7-list strong inset dividers media-list v-if="lowStock.length > 0">
                    <f7-list-item :key="row.item.id" v-for="row in lowStock"
                                  :link="`/ext/item?id=${row.item.id}`"
                                  :title="row.item.name"
                                  :subtitle="tt('{qty} in stock, reorder at {level}', { qty: qtyLabel(row.qty, row.item.unit), level: formatQty(row.item.reorderLevel) })">
                        <template #after>
                            <f7-badge color="red" v-if="row.qty <= 0">{{ tt('Out') }}</f7-badge>
                            <span class="ext-short" v-else>{{ tt('Short by {qty}', { qty: formatQty(row.shortfall) }) }}</span>
                        </template>
                    </f7-list-item>
                </f7-list>
                <f7-block class="ext-muted" v-else>{{ tt('Nothing is running low.') }}</f7-block>
            </template>

            <!-- who owes what, by how old the debt is -->
            <template v-else-if="tab === 'receivables' && receivables">
                <div class="ext-figures">
                    <div class="ext-figure ext-figure-wide">
                        <div class="ext-figure-label">{{ tt('Total owed to you') }}</div>
                        <div class="ext-figure-value" :class="{ 'ext-figure-warn': receivables.totalOutstanding > 0 }">{{ money(receivables.totalOutstanding) }}</div>
                    </div>
                </div>
                <f7-list strong inset dividers v-if="receivables.totalOutstanding > 0">
                    <f7-list-item :key="bucket.label" v-for="bucket in buckets" :title="bucket.label">
                        <template #after>
                            <span :class="{ 'ext-overdue': bucket.warn && bucket.value > 0 }">{{ money(bucket.value) }}</span>
                        </template>
                    </f7-list-item>
                </f7-list>
                <f7-block-footer v-if="receivables.totalOutstanding > 0">{{ tt('Debts are aged from the date of each sale.') }}</f7-block-footer>
                <f7-list strong inset dividers media-list v-if="receivables.rows.length > 0">
                    <f7-list-item :key="row.customer.id" v-for="row in receivables.rows"
                                  :link="`/ext/customer?id=${row.customer.id}`"
                                  :title="row.customer.name"
                                  :subtitle="tt('Oldest unpaid sale {date}', { date: formatDate(row.oldestSaleTime) })"
                                  :text="tt('{count} unpaid sales', { count: row.openSales })">
                        <template #after>
                            <span class="ext-owes" :class="{ 'ext-overdue': row.days61To90 + row.over90 > 0 }">{{ money(row.outstanding) }}</span>
                        </template>
                    </f7-list-item>
                </f7-list>
                <f7-block class="ext-muted" v-else>{{ tt('Nobody owes you anything right now.') }}</f7-block>
            </template>

            <f7-block v-if="!loading">
                <f7-button tonal large :disabled="sharing" @click="share">{{ tt('Share as spreadsheet') }}</f7-button>
            </f7-block>
        </template>
    </f7-page>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';

import { parseBigDecimal } from '@/lib/numeral.ts';
import { parseDateTimeFromUnixTime } from '@/lib/datetime.ts';

import { useExtI18n } from '@/ext/shared/i18n.ts';
import api from '@/ext/shared/api.ts';
import { useBusiness } from '@/ext/shared/business.ts';
import { useBusinessAccounts } from '@/ext/shared/accounts.ts';
import { csvBlob, shareOrSaveFile } from '@/ext/shared/csv.ts';
import { formatQty } from '@/ext/shared/qty.ts';
import type { LocationInfo, LowStockRow, ReceivablesReport, StockValueReport } from '@/ext/shared/types.ts';

import { showError, showToast } from './ui.ts';

// The three business reports of the desktop Reports page, for owners and managers: what the stock is worth, what to
// reorder, and who owes what by age. Each can be shared as a spreadsheet (the same CSV as the desktop download).
type ReportTab = 'stock' | 'low' | 'receivables';

const { tt, formatAmountToLocalizedNumeralsWithCurrency, formatDateTimeToLongDate } = useExtI18n();
const { canManage, ensureLoaded } = useBusiness();
const { currency, load: loadAccounts } = useBusinessAccounts(ref(''));

const tab = ref<ReportTab>('stock');
const loading = ref<boolean>(true);
const sharing = ref<boolean>(false);
const locations = ref<LocationInfo[]>([]);
const locationFilter = ref<string>(''); // '' is every location
const showLocations = ref<boolean>(false);
const stockValue = ref<StockValueReport | null>(null);
const lowStock = ref<LowStockRow[]>([]);
const receivables = ref<ReceivablesReport | null>(null);

const locationOptions = computed(() => [
    { title: tt('All locations'), value: '' },
    ...locations.value.map(l => ({ title: l.name, value: l.id }))
]);

const locationLabel = computed<string>(() => locationOptions.value.find(o => o.value === locationFilter.value)?.title ?? '');

const buckets = computed(() => receivables.value ? [
    { label: tt('Up to 30 days'), value: receivables.value.current, warn: false },
    { label: tt('31 to 60 days'), value: receivables.value.days31To60, warn: false },
    { label: tt('61 to 90 days'), value: receivables.value.days61To90, warn: true },
    { label: tt('Over 90 days'), value: receivables.value.over90, warn: true }
] : []);

function money(minorUnits: number): string {
    return formatAmountToLocalizedNumeralsWithCurrency(parseBigDecimal(minorUnits), currency.value);
}

function qtyLabel(qty: number, unit: string): string {
    return `${formatQty(qty)}${unit ? ' ' + unit : ''}`;
}

function formatDate(unixTime: number): string {
    return formatDateTimeToLongDate(parseDateTimeFromUnixTime(unixTime));
}

async function loadTab(): Promise<void> {
    if (!canManage.value) {
        return;
    }

    loading.value = true;
    const location = locationFilter.value || undefined;

    try {
        if (tab.value === 'stock') {
            stockValue.value = await api.getStockValueReport(location);
        } else if (tab.value === 'low') {
            lowStock.value = await api.getLowStockReport(location);
        } else {
            receivables.value = await api.getReceivablesReport();
        }
    } catch (error) {
        showError(error);
    } finally {
        loading.value = false;
    }
}

// the same columns as the desktop CSV downloads
function rows(): { fileName: string, rows: (string | number)[][] } | null {
    if (tab.value === 'stock' && stockValue.value) {
        return {
            fileName: 'stock-value.csv',
            rows: [
                [tt('SKU'), tt('Item'), tt('In stock'), tt('At cost'), tt('At selling price')],
                ...stockValue.value.rows.map(r => [r.item.sku, r.item.name, formatQty(r.qty), money(r.costValue), money(r.retailValue)]),
                ['', tt('Total'), '', money(stockValue.value.totalCostValue), money(stockValue.value.totalRetailValue)]
            ]
        };
    }

    if (tab.value === 'low') {
        return {
            fileName: 'low-stock.csv',
            rows: [
                [tt('SKU'), tt('Item'), tt('In stock'), tt('Reorder level'), tt('Short by')],
                ...lowStock.value.map(r => [r.item.sku, r.item.name, formatQty(r.qty), formatQty(r.item.reorderLevel), formatQty(r.shortfall)])
            ]
        };
    }

    if (tab.value === 'receivables' && receivables.value) {
        const report = receivables.value;

        return {
            fileName: 'who-owes-what.csv',
            rows: [
                [tt('Customer'), tt('Owes'), tt('Up to 30 days'), tt('31 to 60 days'), tt('61 to 90 days'), tt('Over 90 days'), tt('Oldest unpaid sale')],
                ...report.rows.map(r => [r.customer.name, money(r.outstanding), money(r.current), money(r.days31To60), money(r.days61To90), money(r.over90), formatDate(r.oldestSaleTime)]),
                [tt('Total'), money(report.totalOutstanding), money(report.current), money(report.days31To60), money(report.days61To90), money(report.over90), '']
            ]
        };
    }

    return null;
}

async function share(): Promise<void> {
    const table = rows();

    if (!table) {
        return;
    }

    sharing.value = true;

    try {
        if (await shareOrSaveFile(table.fileName, csvBlob(table.rows)) === 'saved') {
            showToast(tt('Spreadsheet downloaded'));
        }
    } finally {
        sharing.value = false;
    }
}

async function refresh(done?: () => void): Promise<void> {
    try {
        await Promise.all([ensureLoaded(), loadAccounts()]);

        if (canManage.value) {
            locations.value = await api.listLocations();
            // the count on the Low stock tab is wanted before that tab is opened
            lowStock.value = await api.getLowStockReport();
        }

        await loadTab();
    } catch (error) {
        showError(error);
    } finally {
        done?.();
    }
}

watch([tab, locationFilter], loadTab);

onMounted(() => refresh());
</script>

<style>
.ext-figures {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 16px;
}

.ext-figure {
    flex: 1 1 40%;
    background: var(--f7-list-strong-bg-color, var(--f7-list-bg-color));
    border-radius: 16px;
    padding: 12px 14px;
}

.ext-figure-wide {
    flex-basis: 100%;
}

.ext-figure-label {
    opacity: 0.7;
    font-size: 0.9em;
}

.ext-figure-value {
    font-size: 1.35em;
    font-weight: 700;
    margin-top: 2px;
}

.ext-figure-good {
    color: var(--f7-color-green);
}

.ext-figure-warn,
.ext-short {
    color: var(--f7-color-orange);
}

.ext-short {
    font-weight: 600;
}

.ext-figure-cell {
    font-weight: 600;
    color: var(--f7-text-color);
}

.ext-overdue,
.ext-owes.ext-overdue {
    color: var(--f7-color-red);
    font-weight: 600;
}
</style>
