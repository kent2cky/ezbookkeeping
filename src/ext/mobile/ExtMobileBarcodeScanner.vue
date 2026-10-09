<template>
    <f7-popup class="ext-barcode-scanner" :opened="show" @popup:opened="start" @popup:closed="onClosed">
        <f7-page>
            <f7-navbar :title="tt('Scan items')">
                <f7-nav-right>
                    <f7-link popup-close>{{ tt('Done') }}</f7-link>
                </f7-nav-right>
            </f7-navbar>

            <div class="ext-scanner-stage">
                <video ref="video" class="ext-scanner-video" playsinline muted></video>
                <div class="ext-scanner-frame"></div>
            </div>

            <f7-block class="text-align-center">
                <p class="text-color-red" v-if="problem">{{ problem }}</p>
                <p v-else>{{ tt('Point the camera at a barcode. Every item scanned is added to the cart.') }}</p>
                <p class="ext-scanner-last" v-if="lastMessage">{{ lastMessage }}</p>
            </f7-block>
        </f7-page>
    </f7-popup>
</template>

<script setup lang="ts">
import { ref, useTemplateRef, onBeforeUnmount } from 'vue';

import { useExtI18n } from '@/ext/shared/i18n.ts';
import { createBarcodeReader } from './barcode.ts';

// Full-screen camera view that keeps scanning until Done, so a pile of goods can be rung up one after another.
// Each code is reported to the parent, which adds the matching item and says what happened (lastMessage).
const props = defineProps<{
    show: boolean;
    lastMessage?: string;
}>();

const emit = defineEmits<{
    (e: 'update:show', value: boolean): void;
    (e: 'detected', code: string): void;
}>();

const SAME_CODE_PAUSE_MS = 1500; // a code held in front of the camera is not counted again until this has passed
const SCAN_INTERVAL_MS = 200;

const { tt } = useExtI18n();
const video = useTemplateRef<HTMLVideoElement>('video');

const problem = ref<string>('');

let stream: MediaStream | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastCode = '';
let lastCodeTime = 0;

async function start(): Promise<void> {
    problem.value = '';

    try {
        const reader = await createBarcodeReader();

        if (!reader) {
            problem.value = tt('This device cannot read barcodes.');
            return;
        }

        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });

        if (!props.show || !video.value) {
            stop(); // closed while the camera was starting
            return;
        }

        video.value.srcObject = stream;
        await video.value.play();

        const scan = async (): Promise<void> => {
            if (!stream || !video.value) {
                return;
            }

            try {
                const codes = await reader.detect(video.value);
                const code = codes[0]?.rawValue?.trim();
                const now = Date.now();

                if (code && (code !== lastCode || now - lastCodeTime > SAME_CODE_PAUSE_MS)) {
                    lastCode = code;
                    lastCodeTime = now;
                    navigator.vibrate?.(60);
                    emit('detected', code);
                } else if (code) {
                    lastCodeTime = now;
                }
            } catch {
                // a frame that could not be read; try the next one
            }

            timer = setTimeout(scan, SCAN_INTERVAL_MS);
        };

        await scan();
    } catch (error) {
        const name = (error as { name?: string } | undefined)?.name;
        problem.value = name === 'NotAllowedError'
            ? tt('The camera is blocked. Allow camera access for this app in your phone settings.')
            : tt('The camera could not be started.');
        stop();
    }
}

function stop(): void {
    if (timer) {
        clearTimeout(timer);
        timer = null;
    }

    stream?.getTracks().forEach(track => track.stop());
    stream = null;

    if (video.value) {
        video.value.srcObject = null;
    }
}

function onClosed(): void {
    stop();
    lastCode = '';
    emit('update:show', false);
}

onBeforeUnmount(stop);
</script>

<style>
.ext-scanner-stage {
    position: relative;
    background: #000;
    aspect-ratio: 3 / 4;
    max-height: 60vh;
    width: 100%;
    overflow: hidden;
}

.ext-scanner-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.ext-scanner-frame {
    position: absolute;
    left: 12%;
    right: 12%;
    top: 35%;
    bottom: 35%;
    border: 3px solid rgba(255, 255, 255, 0.85);
    border-radius: 12px;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.35);
}

.ext-scanner-last {
    font-weight: 600;
    font-size: 1.1em;
}
</style>
