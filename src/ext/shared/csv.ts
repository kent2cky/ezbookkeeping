// Download a table as a CSV file that opens correctly in Excel and Google Sheets.

/** Cells that start with these characters would be run as formulas by a spreadsheet, so they get a quote in front. */
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: string | number): string {
    let text = String(value);

    if (typeof value === 'string' && FORMULA_START.test(text)) {
        text = `'${text}`;
    }

    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Turns rows into CSV text (lines end with CRLF as the format asks). */
export function toCsv(rows: (string | number)[][]): string {
    return rows.map(row => row.map(cell).join(',')).join('\r\n');
}

/** Saves rows as a file in the browser. The byte order mark makes Excel read accented letters correctly. */
export function downloadCsv(fileName: string, rows: (string | number)[][]): void {
    saveBlob(fileName, csvBlob(rows));
}

/** Hands a file to the browser as a download. */
export function saveBlob(fileName: string, blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    link.className = 'external'; // the mobile app (Framework7) would otherwise take over the click as a page change
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 10000); // some browsers read the file only after the click returns
}

export type FileHandOff = 'shared' | 'saved' | 'cancelled';

/**
 * On phones a download often lands nowhere the person can find, above all in an installed app, so the file goes to
 * the share sheet (WhatsApp, email, Drive...) where the device can share files, and is downloaded otherwise.
 */
export async function shareOrSaveFile(fileName: string, blob: Blob): Promise<FileHandOff> {
    const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });

    if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: fileName });
            return 'shared';
        } catch (error) {
            if ((error as { name?: string } | undefined)?.name === 'AbortError') {
                return 'cancelled'; // the person closed the share sheet
            }
            // sharing failed for another reason: fall back to a download
        }
    }

    saveBlob(fileName, blob);
    return 'saved';
}

/** Rows as a CSV file (the byte order mark makes Excel read accented letters correctly). */
export function csvBlob(rows: (string | number)[][]): Blob {
    return new Blob(['\uFEFF' + toCsv(rows)], { type: 'text/csv;charset=utf-8' });
}
