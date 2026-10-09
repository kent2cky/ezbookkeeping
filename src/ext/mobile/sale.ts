import { ref, computed } from 'vue';

import { getCurrentUserInfo } from '@/lib/userstate.ts';

import api from '@/ext/shared/api.ts';
import { useBusiness } from '@/ext/shared/business.ts';
import { computeTotals, lineTotal, type PayMode } from '@/ext/shared/money.ts';
import { QTY_SCALE } from '@/ext/shared/qty.ts';
import type { CustomerInfo, ItemInfo, LocationInfo, StockLevel } from '@/ext/shared/types.ts';

// The sale being rung up on the phone: what is for sale, the cart and how it is paid. The state lives in this module,
// so the cart survives a look at the recent sales and back. Quantities are scaled by 1000 (see qty.ts) and money is
// in minor units; the arithmetic is the same as on the desktop Sales page and the server (money.ts).

export interface CartLine {
    readonly itemId: string;
    readonly item: ItemInfo;
    readonly qty: number;
    readonly unitPrice: number;
    readonly priceOverridden: boolean;
    readonly total: number;
    readonly problem: 'none' | 'zero' | 'stock';
}

interface CartEntry {
    itemId: string;
    qty: number;
    priceOverride: number | null;
}

const items = ref<ItemInfo[]>([]);
const locations = ref<LocationInfo[]>([]);
const levels = ref<StockLevel[]>([]);
const customers = ref<CustomerInfo[]>([]);
const loading = ref<boolean>(false);
const loaded = ref<boolean>(false);

const entries = ref<CartEntry[]>([]);
const locationId = ref<string>('');
const payMode = ref<PayMode>('full');
const partialPaid = ref<number>(0);
const discount = ref<number>(0);
const customerId = ref<string>('');
const note = ref<string>('');
const paymentAccountId = ref<string>(''); // also decides the currency prices are shown in
const receivableAccountId = ref<string>('');
const categoryId = ref<string>('');

let stateOwner = ''; // the person this cart belongs to

const REOPEN_SELL_KEY = 'ebk_ext_reopen_sell';

/** Asks the app to open the Sell screen once after it restarts (used when switching business). */
export function reopenSellAfterStart(): void {
    try {
        sessionStorage.setItem(REOPEN_SELL_KEY, '1');
    } catch {
        // the person then lands on the home page and taps Sell themselves
    }
}

/** True once after reopenSellAfterStart(). */
export function takeReopenSell(): boolean {
    try {
        const asked = sessionStorage.getItem(REOPEN_SELL_KEY) === '1';
        sessionStorage.removeItem(REOPEN_SELL_KEY);
        return asked;
    } catch {
        return false;
    }
}

function currentUsername(): string {
    return getCurrentUserInfo()?.username ?? '';
}

function clearCart(): void {
    entries.value = [];
    payMode.value = 'full';
    partialPaid.value = 0;
    discount.value = 0;
    customerId.value = '';
    note.value = '';
}

export function useSale() {
    const { canManage, ensureLoaded } = useBusiness();

    if (stateOwner !== currentUsername()) {
        // somebody else logged in on this phone: nothing of the previous person's sale may show
        stateOwner = currentUsername();
        items.value = [];
        locations.value = [];
        levels.value = [];
        customers.value = [];
        loaded.value = false;
        locationId.value = '';
        paymentAccountId.value = '';
        receivableAccountId.value = '';
        categoryId.value = '';
        clearCart();
    }

    /** Stock on hand at the selling location. */
    function stockOf(item: ItemInfo): number {
        return levels.value.filter(l => l.itemId === item.id && l.locationId === locationId.value).reduce((sum, l) => sum + l.qty, 0);
    }

    function inCart(itemId: string): number {
        return entries.value.find(e => e.itemId === itemId)?.qty ?? 0;
    }

    /** What can still be added to the cart. Items that do not track stock are never limited. */
    function leftOf(item: ItemInfo): number {
        return item.trackStock ? stockOf(item) - inCart(item.id) : Number.MAX_SAFE_INTEGER;
    }

    const cart = computed<CartLine[]>(() => entries.value.flatMap(entry => {
        const item = items.value.find(i => i.id === entry.itemId);

        if (!item) {
            return [];
        }

        const unitPrice = entry.priceOverride ?? item.salePrice;
        let problem: CartLine['problem'] = 'none';

        if (entry.qty <= 0) {
            problem = 'zero';
        } else if (item.trackStock && entry.qty > stockOf(item)) {
            problem = 'stock';
        }

        return [{
            itemId: item.id, item, qty: entry.qty, unitPrice, priceOverridden: entry.priceOverride !== null,
            total: entry.qty > 0 ? lineTotal(entry.qty, unitPrice) : 0, problem
        }];
    }));

    const itemCount = computed<number>(() => entries.value.length);

    const totals = computed(() => computeTotals(cart.value.map(l => l.total), canManage.value ? discount.value : 0, payMode.value, partialPaid.value));

    const cartValid = computed<boolean>(() => cart.value.length > 0 && cart.value.every(l => l.problem === 'none') && totals.value.total > 0);

    /** Adds one more of the item (or the given quantity). Returns false when the stock here does not allow it. */
    function add(item: ItemInfo, qty: number = QTY_SCALE): boolean {
        if (item.trackStock && leftOf(item) < qty) {
            return false;
        }

        const existing = entries.value.find(e => e.itemId === item.id);

        if (existing) {
            existing.qty += qty;
        } else {
            entries.value.push({ itemId: item.id, qty, priceOverride: null });
        }

        return true;
    }

    function setQty(itemId: string, qty: number): void {
        const entry = entries.value.find(e => e.itemId === itemId);

        if (entry) {
            entry.qty = Math.max(qty, 0);
        }
    }

    /** One more or one less; going below one removes the line. */
    function step(itemId: string, delta: 1 | -1): void {
        const entry = entries.value.find(e => e.itemId === itemId);

        if (!entry) {
            return;
        }

        const next = entry.qty + delta * QTY_SCALE;

        if (next <= 0) {
            remove(itemId);
        } else {
            entry.qty = next;
        }
    }

    function setPrice(itemId: string, price: number): void {
        const entry = entries.value.find(e => e.itemId === itemId);
        const item = items.value.find(i => i.id === itemId);

        if (entry && item) {
            entry.priceOverride = price === item.salePrice ? null : price;
        }
    }

    function remove(itemId: string): void {
        entries.value = entries.value.filter(e => e.itemId !== itemId);
    }

    async function load(force: boolean = false): Promise<void> {
        if (loading.value || (loaded.value && !force)) {
            return;
        }

        loading.value = true;

        try {
            await ensureLoaded();
            [items.value, locations.value, levels.value, customers.value] = await Promise.all([
                api.listItems(), api.listLocations(), api.getStockLevels(), api.listCustomers()
            ]);

            if (!locations.value.some(l => l.id === locationId.value)) {
                locationId.value = (locations.value.find(l => l.isDefault) ?? locations.value[0])?.id ?? '';
            }

            // items deleted meanwhile drop out of the cart
            entries.value = entries.value.filter(e => items.value.some(i => i.id === e.itemId));
            loaded.value = true;
        } finally {
            loading.value = false;
        }
    }

    /** After a sale: stock and what customers owe have changed. */
    async function refreshAfterSale(): Promise<void> {
        [levels.value, customers.value] = await Promise.all([api.getStockLevels(), api.listCustomers()]);
    }

    function addCustomer(customer: CustomerInfo): void {
        customers.value = [...customers.value, customer];
        customerId.value = customer.id;
    }

    return {
        items, locations, customers, loading, loaded,
        locationId, payMode, partialPaid, discount, customerId, note, paymentAccountId, receivableAccountId, categoryId,
        cart, itemCount, totals, cartValid, canManage,
        stockOf, inCart, leftOf, add, setQty, step, setPrice, remove, clearCart, load, refreshAfterSale, addCustomer
    };
}
