import { ref } from 'vue';

import { getCurrentUserInfo } from '@/lib/userstate.ts';

import api from '@/ext/shared/api.ts';
import { useBusiness } from '@/ext/shared/business.ts';
import type { ItemInfo, LocationInfo, StockLevel } from '@/ext/shared/types.ts';

import { useSale } from './sale.ts';

// Items, locations and stock levels shared by the Inventory screens, so a change on an item's screen shows on the list
// without another trip to the server. Quantities are scaled by 1000 (see qty.ts).
const items = ref<ItemInfo[]>([]);
const locations = ref<LocationInfo[]>([]);
const levels = ref<StockLevel[]>([]);
const loaded = ref<boolean>(false);
let owner = '';

export function useInventory() {
    const { ensureLoaded } = useBusiness();
    const sale = useSale();
    const username = getCurrentUserInfo()?.username ?? '';

    if (owner !== username) {
        owner = username; // a different person logged in: nothing of the previous list may show
        items.value = [];
        locations.value = [];
        levels.value = [];
        loaded.value = false;
    }

    async function load(): Promise<void> {
        await ensureLoaded();
        [items.value, locations.value, levels.value] = await Promise.all([api.listItems(), api.listLocations(), api.getStockLevels()]);
        loaded.value = true;
    }

    /** After items, stock or locations changed: this list, and the Sell screen next time it is shown. */
    async function reloadAfterChange(): Promise<void> {
        await load();
        sale.load(true).catch(() => {
            // the Sell screen loads again when it is opened
        });
    }

    function find(id: string): ItemInfo | undefined {
        return items.value.find(i => i.id === id);
    }

    /** Stock of the item at one location, or everywhere when locationId is empty. */
    function stockOf(item: ItemInfo, locationId: string = ''): number {
        return levels.value
            .filter(l => l.itemId === item.id && (!locationId || l.locationId === locationId))
            .reduce((sum, l) => sum + l.qty, 0);
    }

    function isOut(item: ItemInfo, locationId: string = ''): boolean {
        return item.trackStock && stockOf(item, locationId) <= 0;
    }

    /** At or below the reorder level (and not out). */
    function isLow(item: ItemInfo, locationId: string = ''): boolean {
        return item.trackStock && item.reorderLevel > 0 && !isOut(item, locationId) && stockOf(item, locationId) <= item.reorderLevel;
    }

    return { items, locations, levels, loaded, load, reloadAfterChange, find, stockOf, isOut, isLow };
}
