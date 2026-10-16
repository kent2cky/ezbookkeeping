// Getting a receipt off the screen: printing (or "Save as PDF", which is in the same browser dialog), copying it as
// text, and on phones handing it to the share sheet (WhatsApp, SMS, email). Used by the desktop and the mobile app.

export type ReceiptPaper = 'narrow' | 'a4';

const PAPER_KEY = 'ebk_ext_receipt_paper';
const PRINT_ROOT_ID = 'ext-print-root';
const PRINT_STYLE_ID = 'ext-print-style';

/** The paper size chosen last time on this device. */
export function readReceiptPaper(): ReceiptPaper {
    try {
        return localStorage.getItem(PAPER_KEY) === 'a4' ? 'a4' : 'narrow';
    } catch {
        return 'narrow';
    }
}

export function saveReceiptPaper(paper: ReceiptPaper): void {
    try {
        localStorage.setItem(PAPER_KEY, paper);
    } catch {
        // remembering the paper is a convenience only
    }
}

/** Characters per line of the text version: what fits on the chosen paper. */
export function receiptTextWidth(paper: ReceiptPaper): number {
    return paper === 'a4' ? 42 : 32;
}

function cleanupPrint(): void {
    document.getElementById(PRINT_ROOT_ID)?.remove();
    document.getElementById(PRINT_STYLE_ID)?.remove();
}

/**
 * Prints a rendered receipt. It is copied into its own element and everything else is hidden while the browser's
 * print dialog is open, so only the receipt comes out, on the chosen paper size.
 */
export function printReceiptElement(paperElement: HTMLElement, paper: ReceiptPaper): void {
    cleanupPrint();

    const root = document.createElement('div');
    root.id = PRINT_ROOT_ID;
    root.innerHTML = paperElement.outerHTML;
    document.body.appendChild(root);

    const style = document.createElement('style');
    style.id = PRINT_STYLE_ID;
    style.textContent = `
        #${PRINT_ROOT_ID} { display: none; }
        @media print {
            body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
            #${PRINT_ROOT_ID} { display: block !important; }
            #${PRINT_ROOT_ID} .ext-receipt-paper { box-shadow: none !important; margin: 0 !important; }
        }
        @page { size: ${paper === 'a4' ? 'A4' : '80mm auto'}; margin: ${paper === 'a4' ? '15mm' : '0'}; }
    `;
    document.head.appendChild(style);

    window.addEventListener('afterprint', cleanupPrint, { once: true });
    window.print();
}

/**
 * Copies text to the clipboard. Falls back to selecting a hidden box where the clipboard API is unavailable
 * (it needs a secure page). Returns false when neither worked.
 */
export async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const box = document.createElement('textarea');
        box.value = text;
        box.style.position = 'fixed';
        box.style.opacity = '0';
        document.body.appendChild(box);
        box.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(box);
        return copied;
    }
}

/** Whether the device offers a share sheet (phones, and some desktop browsers). */
export function canShareText(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/**
 * Opens the device's share sheet with the text. Resolves to false when the person closed the sheet without sharing
 * or sharing is not possible, so the caller can offer copying instead.
 */
export async function shareText(title: string, text: string): Promise<boolean> {
    if (!canShareText()) {
        return false;
    }

    try {
        await navigator.share({ title, text });
        return true;
    } catch {
        return false;
    }
}
