<template>
    <f7-page class="ext-team-page" ptr @ptr:refresh="refresh">
        <f7-navbar :title="tt('Team')" :back-link="tt('Back')"></f7-navbar>

        <!-- invitations to work in somebody else's business -->
        <template v-if="invitations.length > 0">
            <f7-block-title class="margin-top">{{ tt('Invitations') }}</f7-block-title>
            <f7-list strong inset dividers media-list>
                <f7-list-item :key="invitation.ownerUid" v-for="invitation in invitations"
                              :title="invitation.name" :subtitle="tt('ext.invitedAs', { role: roleLabel(invitation.role) })">
                    <template #footer>
                        <div class="ext-invite-actions">
                            <f7-button fill small :disabled="busy" @click="respond(invitation, true)">{{ tt('Accept') }}</f7-button>
                            <f7-button tonal small :disabled="busy" @click="respond(invitation, false)">{{ tt('Decline') }}</f7-button>
                        </div>
                    </template>
                </f7-list-item>
            </f7-list>
        </template>

        <!-- businesses this person works in -->
        <template v-if="working.length > 1">
            <f7-block-title class="margin-top">{{ tt('Businesses I work in') }}</f7-block-title>
            <f7-list strong inset dividers media-list>
                <f7-list-item link="#" :key="business.ownerUid" v-for="business in working"
                              :title="business.name"
                              :subtitle="business.status === 'owner' ? tt('ext.yourOwnBusiness') : roleLabel(business.role)"
                              @click="selectedBusiness = business">
                    <template #after>
                        <f7-badge color="primary" v-if="isCurrent(business)">{{ tt('Working here') }}</f7-badge>
                    </template>
                </f7-list-item>
            </f7-list>
        </template>

        <!-- my own team -->
        <template v-if="enabled">
            <f7-block-title class="margin-top">{{ tt('My team') }}</f7-block-title>
            <f7-list strong inset dividers form>
                <f7-list-input type="email" clear-button :label="tt('Invite by email')" :placeholder="tt('Email of an existing user')"
                               :value="inviteEmail" @input="inviteEmail = $event.target.value"></f7-list-input>
            </f7-list>
            <f7-block class="no-margin-vertical">
                <f7-segmented strong>
                    <f7-button :active="inviteRole === 'staff'" @click="inviteRole = 'staff'">{{ tt('Staff') }}</f7-button>
                    <f7-button :active="inviteRole === 'manager'" @click="inviteRole = 'manager'">{{ tt('Manager') }}</f7-button>
                </f7-segmented>
                <p class="ext-muted ext-role-hint">{{ inviteRole === 'manager' ? tt('Managers can change prices, stock, items and customers, and see reports.') : tt('Staff can sell, add customers and record repayments.') }}</p>
                <f7-button large fill :disabled="busy || !inviteEmail.trim()" @click="invite">{{ tt('Send invitation') }}</f7-button>
            </f7-block>

            <f7-list strong inset dividers media-list v-if="staff.length > 0">
                <f7-list-item link="#" :key="member.staffUid" v-for="member in staff"
                              :title="member.nickname || member.username" :subtitle="member.email"
                              @click="selectedMember = member">
                    <template #after>
                        <f7-badge color="orange" v-if="member.status === 'pending'">{{ tt('Invited') }}</f7-badge>
                        <span v-else>{{ roleLabel(member.role) }}</span>
                    </template>
                </f7-list-item>
            </f7-list>
            <f7-block class="ext-muted" v-else-if="loaded">{{ tt('Nobody works with you yet. Invite someone who already has an account here.') }}</f7-block>

            <template v-if="staff.length > 0">
                <f7-block-title>{{ tt('Recent activity') }}</f7-block-title>
                <f7-block-footer class="no-margin-top">{{ tt('Changes your managers and staff made in your business.') }}</f7-block-footer>
                <f7-list strong inset dividers media-list v-if="audit.length > 0">
                    <f7-list-item :key="entry.id" v-for="entry in audit"
                                  :title="describeAction(tt, entry.action, entry.path) + (entry.entityId !== '0' ? ` #${entry.entityId}` : '')"
                                  :subtitle="formatTime(entry.time)"
                                  :text="tt('by {name}', { name: `${people.nameOf(entry.actorUid) || entry.actorUid} (${roleLabel(entry.role)})` })">
                        <template #after>
                            <f7-badge color="red" v-if="entry.status >= 400">{{ tt('Refused') }}</f7-badge>
                        </template>
                    </f7-list-item>
                </f7-list>
                <f7-block class="ext-muted" v-else>{{ tt('Nothing yet.') }}</f7-block>
                <f7-block v-if="moreAudit">
                    <f7-button tonal :disabled="busy" @click="loadMoreAudit">{{ tt('Show more') }}</f7-button>
                </f7-block>
            </template>
        </template>

        <f7-block class="text-align-center" v-if="!enabled && invitations.length < 1 && working.length < 2 && loaded">
            <p>{{ tt('Switch on the business features in Settings to build a team.') }}</p>
        </f7-block>

        <!-- a business: work there, or leave it -->
        <f7-actions :opened="!!selectedBusiness" @actions:closed="selectedBusiness = null">
            <f7-actions-group>
                <f7-actions-label v-if="selectedBusiness">{{ selectedBusiness.name }}</f7-actions-label>
                <f7-actions-button @click="workIn(selectedBusiness)" v-if="selectedBusiness && !isCurrent(selectedBusiness)">{{ tt('Work here') }}</f7-actions-button>
                <f7-actions-button color="red" @click="leave(selectedBusiness)" v-if="selectedBusiness?.status === 'active'">{{ tt('Leave') }}</f7-actions-button>
            </f7-actions-group>
            <f7-actions-group>
                <f7-actions-button bold>{{ tt('Cancel') }}</f7-actions-button>
            </f7-actions-group>
        </f7-actions>

        <!-- a team member: change their role, or remove them -->
        <f7-actions :opened="!!selectedMember" @actions:closed="selectedMember = null">
            <f7-actions-group>
                <f7-actions-label v-if="selectedMember">{{ selectedMember.nickname || selectedMember.username }}</f7-actions-label>
                <f7-actions-button @click="changeRole(selectedMember, 'manager')" v-if="selectedMember?.role === 'staff'">{{ tt('Make manager') }}</f7-actions-button>
                <f7-actions-button @click="changeRole(selectedMember, 'staff')" v-if="selectedMember?.role === 'manager'">{{ tt('Make staff') }}</f7-actions-button>
                <f7-actions-button color="red" @click="remove(selectedMember)">{{ selectedMember?.status === 'pending' ? tt('Cancel invitation') : tt('Remove') }}</f7-actions-button>
            </f7-actions-group>
            <f7-actions-group>
                <f7-actions-button bold>{{ tt('Cancel') }}</f7-actions-button>
            </f7-actions-group>
        </f7-actions>
    </f7-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

import { parseDateTimeFromUnixTime } from '@/lib/datetime.ts';
import { getMobileVersionPath } from '@/lib/version.ts';

import { useExtI18n } from '@/ext/shared/i18n.ts';
import api from '@/ext/shared/api.ts';
import { switchBusiness, useBusiness } from '@/ext/shared/business.ts';
import { useBusinessFeatures } from '@/ext/shared/features.ts';
import { usePeople } from '@/ext/shared/people.ts';
import { describeAction } from '@/ext/shared/audit.ts';
import type { AuditEntry, BusinessInfo, BusinessRole, StaffInfo } from '@/ext/shared/types.ts';

import { reopenSellAfterStart } from './sale.ts';
import { confirmAction, showError, showToast } from './ui.ts';

// Invitations to answer, the businesses the person works in, and their own team: invite by email, change roles,
// remove people, and see what managers and staff changed. Like the desktop Team page it is always about the person's
// own team, whichever business they are working in (the server ignores the business header on these routes).
const AUDIT_PAGE = 50; // what the server sends at a time

const { tt, roleLabel, formatDateTimeToLongDateTime } = useExtI18n();
const { working, current, invitations, refresh: refreshBusinesses } = useBusiness();
const { enabled, loadFeatureSetting } = useBusinessFeatures();
const people = usePeople().ownTeam();

const loaded = ref<boolean>(false);
const busy = ref<boolean>(false);
const staff = ref<StaffInfo[]>([]);
const audit = ref<AuditEntry[]>([]);
const moreAudit = ref<boolean>(false);
const inviteEmail = ref<string>('');
const inviteRole = ref<BusinessRole>('staff');
const selectedBusiness = ref<BusinessInfo | null>(null);
const selectedMember = ref<StaffInfo | null>(null);

function isCurrent(business: BusinessInfo): boolean {
    return !!current.value && current.value.ownerUid === business.ownerUid;
}

function formatTime(unixTime: number): string {
    return formatDateTimeToLongDateTime(parseDateTimeFromUnixTime(unixTime));
}

async function load(): Promise<void> {
    await Promise.all([refreshBusinesses(), loadFeatureSetting()]);

    if (enabled.value) {
        const [members, entries] = await Promise.all([api.listStaff(), api.listAudit(), people.load()]);
        staff.value = members;
        audit.value = entries;
        moreAudit.value = entries.length >= AUDIT_PAGE;
    }

    loaded.value = true;
}

async function refresh(done?: () => void): Promise<void> {
    try {
        await load();
    } catch (error) {
        showError(error);
    } finally {
        done?.();
    }
}

async function run(action: () => Promise<unknown>, doneMessage: string): Promise<void> {
    busy.value = true;

    try {
        await action();
        showToast(doneMessage);
        await load();
    } catch (error) {
        showError(error);
    } finally {
        busy.value = false;
    }
}

async function loadMoreAudit(): Promise<void> {
    const last = audit.value[audit.value.length - 1];

    if (!last) {
        return;
    }

    busy.value = true;

    try {
        const page = await api.listAudit(last.id);
        audit.value = [...audit.value, ...page];
        moreAudit.value = page.length >= AUDIT_PAGE;
    } catch (error) {
        showError(error);
    } finally {
        busy.value = false;
    }
}

async function invite(): Promise<void> {
    const email = inviteEmail.value.trim();

    if (email) {
        await run(async () => {
            await api.inviteStaff(email, inviteRole.value);
            inviteEmail.value = '';
        }, tt('Invitation sent'));
    }
}

async function respond(invitation: BusinessInfo, accept: boolean): Promise<void> {
    await run(() => api.respondToInvitation(invitation.ownerUid, accept), accept ? tt('Invitation accepted') : tt('Invitation declined'));
}

function changeRole(member: StaffInfo | null, role: BusinessRole): void {
    if (member) {
        run(() => api.setStaffRole(member.staffUid, role), tt('Role updated'));
    }
}

function remove(member: StaffInfo | null): void {
    if (!member) {
        return;
    }

    confirmAction(tt('Remove'), tt('ext.confirmRemoveMember', { name: member.nickname || member.username }), tt('Remove'), tt('Cancel'),
        () => run(() => api.removeStaff(member.staffUid), tt('Removed')));
}

// the app starts afresh so every screen shows the chosen business, and opens the Sell screen there
function workIn(business: BusinessInfo | null): void {
    if (business && !isCurrent(business)) {
        reopenSellAfterStart();
        switchBusiness(business.ownerUid, getMobileVersionPath());
    }
}

function leave(business: BusinessInfo | null): void {
    if (!business) {
        return;
    }

    confirmAction(tt('Leave'), tt('ext.confirmLeave', { name: business.name }), tt('Leave'), tt('Cancel'),
        () => run(() => api.leaveBusiness(business.ownerUid), tt('You left the business')));
}

onMounted(() => refresh());
</script>

<style>
.ext-invite-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
}

.ext-invite-actions .button {
    width: auto;
    padding: 0 16px;
}

.ext-role-hint {
    font-size: 0.9em;
}
</style>
