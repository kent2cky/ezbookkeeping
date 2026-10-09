import { ref } from 'vue';

import { getCurrentUserInfo } from '@/lib/userstate.ts';

import api from '@/ext/shared/api.ts';
import { useBusiness } from '@/ext/shared/business.ts';
import type { CustomerInfo } from '@/ext/shared/types.ts';

// The customer list shared by the Customers screen and a customer's own screen, so a repayment or an edit on one shows
// on the other without another trip to the server.
const customers = ref<CustomerInfo[]>([]);
const loaded = ref<boolean>(false);
let owner = '';

export function useCustomers() {
    const { ensureLoaded } = useBusiness();
    const username = getCurrentUserInfo()?.username ?? '';

    if (owner !== username) {
        owner = username; // a different person logged in: nothing of the previous list may show
        customers.value = [];
        loaded.value = false;
    }

    async function load(): Promise<void> {
        await ensureLoaded();
        customers.value = await api.listCustomers();
        loaded.value = true;
    }

    function find(id: string): CustomerInfo | undefined {
        return customers.value.find(c => c.id === id);
    }

    return { customers, loaded, load, find };
}
