<template>
    <f7-page class="ext-customers-page" ptr @ptr:refresh="refresh">
        <f7-navbar :back-link="tt('Back')">
            <f7-nav-title :title="tt('Customers')"></f7-nav-title>
            <f7-nav-right>
                <f7-link icon-f7="plus" :aria-label="tt('Add customer')" @click="showAdd = true"></f7-link>
            </f7-nav-right>
            <f7-subnavbar :inner="false">
                <f7-searchbar custom-searchs :disable-button="false"
                              :value="search" :placeholder="tt('Search by name, phone or email')"
                              @input="search = $event.target.value"
                              @click:clear="search = ''"></f7-searchbar>
            </f7-subnavbar>
        </f7-navbar>

        <f7-block class="ext-owed-summary" v-if="loaded">
            <div class="ext-owed-total" v-if="totalOwed > 0">{{ tt('Customers owe you {amount} in total', { amount: money(totalOwed) }) }}</div>
            <div v-else>{{ tt('Nobody owes you anything right now.') }}</div>
        </f7-block>

        <f7-block class="no-margin-vertical" v-if="customers.length > 0">
            <f7-segmented strong>
                <f7-button :active="!onlyOwing" @click="onlyOwing = false">{{ tt('All') }}</f7-button>
                <f7-button :active="onlyOwing" @click="onlyOwing = true">{{ tt('Owe me') }}</f7-button>
            </f7-segmented>
        </f7-block>

        <f7-list strong inset dividers media-list class="ext-customer-list" v-if="visibleCustomers.length > 0">
            <f7-list-item :key="customer.id" v-for="customer in visibleCustomers"
                          :link="`/ext/customer?id=${customer.id}`"
                          :title="customer.name"
                          :subtitle="customer.phone || customer.email">
                <template #after>
                    <span class="ext-owes" v-if="customer.outstanding > 0">{{ tt('Owes {amount}', { amount: money(customer.outstanding) }) }}</span>
                </template>
            </f7-list-item>
        </f7-list>

        <f7-block class="text-align-center" v-else-if="loaded">
            <p v-if="customers.length < 1">{{ tt('No customers yet.') }}</p>
            <p v-else>{{ tt('No customers match.') }}</p>
            <f7-button tonal round @click="showAdd = true" v-if="customers.length < 1">{{ tt('Add customer') }}</f7-button>
        </f7-block>

        <f7-block class="text-align-center" v-else>
            <f7-preloader></f7-preloader>
        </f7-block>

        <ext-mobile-customer-sheet v-model:show="showAdd" @saved="onAdded" />
    </f7-page>
</template>

<script setup lang="ts">
import ExtMobileCustomerSheet from './ExtMobileCustomerSheet.vue';

import { ref, computed, onMounted } from 'vue';
import type { Router } from 'framework7/types';

import { parseBigDecimal } from '@/lib/numeral.ts';

import { useExtI18n } from '@/ext/shared/i18n.ts';
import { useBusinessAccounts } from '@/ext/shared/accounts.ts';
import type { CustomerInfo } from '@/ext/shared/types.ts';

import { useCustomers } from './customers.ts';
import { showError, showToast } from './ui.ts';

// Who the business sells to, with the people who owe money first. Anyone may add a customer; changing and deleting
// are on the customer's own screen, for owners and managers.
const props = defineProps<{
    f7router: Router.Router;
}>();

const { tt, formatAmountToLocalizedNumeralsWithCurrency } = useExtI18n();
const { customers, loaded, load } = useCustomers();
const { currency, load: loadAccounts } = useBusinessAccounts(ref(''));

const search = ref<string>('');
const onlyOwing = ref<boolean>(false);
const showAdd = ref<boolean>(false);

const totalOwed = computed<number>(() => customers.value.reduce((sum, c) => sum + c.outstanding, 0));

const visibleCustomers = computed<CustomerInfo[]>(() => {
    const needle = search.value.trim().toLowerCase();

    return customers.value
        .filter(c => (!onlyOwing.value || c.outstanding > 0)
            && (!needle || [c.name, c.phone, c.email].some(text => text.toLowerCase().includes(needle))))
        .sort((a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name));
});

function money(minorUnits: number): string {
    return formatAmountToLocalizedNumeralsWithCurrency(parseBigDecimal(minorUnits), currency.value);
}

async function onAdded(customer: CustomerInfo): Promise<void> {
    showToast(tt('Customer saved'));
    await refresh();
    props.f7router.navigate(`/ext/customer?id=${customer.id}`);
}

async function refresh(done?: () => void): Promise<void> {
    try {
        await Promise.all([load(), loadAccounts()]);
    } catch (error) {
        showError(error);
    } finally {
        done?.();
    }
}

onMounted(() => refresh());
</script>

<style>
.ext-owed-summary {
    margin-top: 12px;
    margin-bottom: 12px;
}

.ext-owed-total {
    font-size: 1.15em;
    font-weight: 600;
    color: var(--f7-color-orange);
}

.ext-customer-list .item-title {
    font-weight: 600;
}

</style>
