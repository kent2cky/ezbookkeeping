<template>
    <f7-page class="ext-locations-page">
        <f7-navbar :back-link="tt('Back')">
            <f7-nav-title :title="tt('Locations')"></f7-nav-title>
            <f7-nav-right v-if="canManage">
                <f7-link icon-f7="plus" :aria-label="tt('Add location')" @click="add"></f7-link>
            </f7-nav-right>
        </f7-navbar>

        <f7-block class="ext-muted">
            {{ tt('Shops, stores or warehouses where you keep stock. With one location you never need to choose.') }}
        </f7-block>

        <f7-list strong inset dividers v-if="locations.length > 0">
            <f7-list-item :link="canManage ? '#' : undefined" :key="location.id" v-for="location in locations"
                          :title="location.name" :after="location.isDefault ? tt('Default') : ''"
                          @click="canManage && (selected = location)"></f7-list-item>
        </f7-list>

        <f7-actions :opened="!!selected" @actions:closed="selected = null">
            <f7-actions-group>
                <f7-actions-label v-if="selected">{{ selected.name }}</f7-actions-label>
                <f7-actions-button @click="rename(selected)">{{ tt('Rename') }}</f7-actions-button>
                <f7-actions-button color="red" @click="remove(selected)">{{ tt('Delete') }}</f7-actions-button>
            </f7-actions-group>
            <f7-actions-group>
                <f7-actions-button bold>{{ tt('Cancel') }}</f7-actions-button>
            </f7-actions-group>
        </f7-actions>
    </f7-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

import { useExtI18n } from '@/ext/shared/i18n.ts';
import api from '@/ext/shared/api.ts';
import { useBusiness } from '@/ext/shared/business.ts';
import type { LocationInfo } from '@/ext/shared/types.ts';

import { useInventory } from './inventory.ts';
import { confirmAction, promptText, showError, showToast } from './ui.ts';

// Where stock is kept. Adding, renaming and deleting are for owners and managers; the server refuses to delete a
// location that still holds stock, or the last one.
const { tt } = useExtI18n();
const { canManage } = useBusiness();
const { locations, load, reloadAfterChange } = useInventory();

const selected = ref<LocationInfo | null>(null);

async function run(action: () => Promise<unknown>, message: string): Promise<void> {
    try {
        await action();
        showToast(message);
        await reloadAfterChange();
    } catch (error) {
        showError(error);
    }
}

function add(): void {
    promptText(tt('Add location'), tt('Name of the shop, store or warehouse'), '', tt('Add'), tt('Cancel'), name => {
        if (name) {
            run(() => api.addLocation(name), tt('Location added'));
        }
    });
}

function rename(location: LocationInfo | null): void {
    if (!location) {
        return;
    }

    promptText(tt('Rename'), '', location.name, tt('Save'), tt('Cancel'), name => {
        if (name && name !== location.name) {
            run(() => api.renameLocation(location.id, name), tt('Location renamed'));
        }
    });
}

function remove(location: LocationInfo | null): void {
    if (!location) {
        return;
    }

    confirmAction(tt('Delete'), tt('Delete {name}? Only an empty location can be deleted.', { name: location.name }), tt('Delete'), tt('Cancel'),
        () => run(() => api.deleteLocation(location.id), tt('Location deleted')));
}

onMounted(() => {
    load().catch(showError);
});
</script>
