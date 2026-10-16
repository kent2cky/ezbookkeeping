// The activity log of a business (pkg/ext/middleware writes an entry for every change a manager or staff member makes),
// described for people. Used by the desktop and the mobile Team screens.

type Translate = (text: string) => string;

/** What the person did, in words; unknown actions are shown as written so nothing is hidden. */
export function describeAction(tt: Translate, action: string, path: string): string {
    switch (action) {
        case 'sales.add': return tt('Recorded a sale');
        case 'sales.void': return tt('Voided a sale');
        case 'repayments.add': return tt('Recorded a repayment');
        case 'customers.add': return tt('Added a customer');
        case 'customers.modify': return tt('Changed a customer');
        case 'customers.delete': return tt('Deleted a customer');
        case 'items.add': return tt('Added an item');
        case 'items.modify': return tt('Changed an item');
        case 'items.delete': return tt('Deleted an item');
        case 'stock.receive': return tt('Received stock');
        case 'stock.adjust': return tt('Adjusted stock');
        case 'stock.transfer': return tt('Transferred stock');
        case 'locations.add': return tt('Added a location');
        case 'locations.modify': return tt('Renamed a location');
        case 'locations.delete': return tt('Deleted a location');
        case 'transactions.add': return tt('Added a transaction');
        case 'transactions.modify': return tt('Changed a transaction');
        case 'transactions.delete': return tt('Deleted a transaction');
        case 'accounts.add': return tt('Added an account');
        case 'accounts.modify': return tt('Changed an account');
        default: return (action || path).replace(/[._/]/g, ' ');
    }
}
