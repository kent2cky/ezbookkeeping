import { f7ready } from 'framework7-vue';

import { describeError } from '@/ext/shared/api.ts';

// Toasts and dialogs for the mobile business screens. Unlike the app's own helpers (src/lib/ui/mobile.ts) these show
// the text as given: it is already translated, and may contain customer names or server messages that must not be
// looked up as translation keys.

export function showToast(text: string, timeout: number = 2000): void {
    f7ready(f7 => {
        f7.toast.create({ text, position: 'center', closeTimeout: timeout }).open();
    });
}

/** Shows what went wrong with a request. Errors the app already reported (such as a lost login) are skipped. */
export function showError(error: unknown): void {
    const message = describeError(error);

    if (message) {
        showToast(message, 3000);
    }
}

export function confirmAction(title: string, text: string, okText: string, cancelText: string, onConfirm: () => void): void {
    f7ready(f7 => {
        f7.dialog.create({
            title,
            text,
            buttons: [
                { text: cancelText },
                { text: okText, strong: true, onClick: onConfirm }
            ]
        }).open();
    });
}

/** Asks for one line of text; calls back with the trimmed answer unless the person cancelled. */
export function promptText(title: string, text: string, value: string, okText: string, cancelText: string,
                           onConfirm: (value: string) => void, inputMode: string = 'text'): void {
    f7ready(f7 => {
        const dialog = f7.dialog.create({
            title,
            text,
            content: `<div class="dialog-input-field input"><input type="text" class="dialog-input" inputmode="${inputMode}"></div>`,
            buttons: [
                { text: cancelText },
                {
                    text: okText,
                    strong: true,
                    onClick: dialogInstance => onConfirm(String(dialogInstance.$el.find('.dialog-input').val() ?? '').trim())
                }
            ],
            on: {
                // the starting value goes in at once, so nothing typed during the opening animation is overwritten
                open: dialogInstance => {
                    const input = dialogInstance.$el.find('.dialog-input')[0] as HTMLInputElement | undefined;

                    if (input) {
                        input.value = value;
                    }
                },
                opened: dialogInstance => {
                    const input = dialogInstance.$el.find('.dialog-input')[0] as HTMLInputElement | undefined;

                    if (input && document.activeElement !== input) {
                        input.focus();
                        input.select();
                    }
                }
            }
        });

        dialog.open();
    });
}
