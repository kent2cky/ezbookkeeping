// Barcode scanning with the browser's own reader (BarcodeDetector). Android Chrome has it; iPhones do not yet, and
// there the scan button is simply not shown. No library is bundled, so the app stays as small as it was.

interface DetectedBarcode {
    readonly rawValue: string;
}

interface BarcodeDetectorInstance {
    detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorClass {
    new(options?: { formats?: string[] }): BarcodeDetectorInstance;
    getSupportedFormats(): Promise<string[]>;
}

function detectorClass(): BarcodeDetectorClass | undefined {
    return (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector;
}

/** Whether this device can scan: a barcode reader in the browser, and a camera the page may ask for. */
export function canScanBarcodes(): boolean {
    return !!detectorClass() && !!navigator.mediaDevices?.getUserMedia;
}

/** Creates a reader for every format the device supports, or undefined when there is none. */
export async function createBarcodeReader(): Promise<BarcodeDetectorInstance | undefined> {
    const Detector = detectorClass();

    if (!Detector) {
        return undefined;
    }

    const formats = await Detector.getSupportedFormats();
    return formats.length > 0 ? new Detector({ formats }) : undefined;
}

/** Item codes are compared without surrounding spaces and without regard to letter case. */
export function sameCode(a: string, b: string): boolean {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}
