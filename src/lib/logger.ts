import { isEnableDebug } from './settings.ts';

function logDebug(msg: string, obj?: unknown): void {
    if (isEnableDebug()) {
        if (obj) {
            console.debug('[Smartcore Books Debug] ' + msg, obj);
        } else {
            console.debug('[Smartcore Books Debug] ' + msg);
        }
    }
}

function logInfo(msg: string, obj?: unknown): void {
    if (obj) {
        console.info('[Smartcore Books Info] ' + msg, obj);
    } else {
        console.info('[Smartcore Books Info] ' + msg);
    }
}

function logWarn(msg: string, obj?: unknown): void {
    if (obj) {
        console.warn('[Smartcore Books Warn] ' + msg, obj);
    } else {
        console.warn('[Smartcore Books Warn] ' + msg);
    }
}

function logError(msg: string, obj?: unknown): void {
    if (obj) {
        console.error('[Smartcore Books Error] ' + msg, obj);
    } else {
        console.error('[Smartcore Books Error] ' + msg);
    }
}

export default {
    debug: logDebug,
    info: logInfo,
    warn: logWarn,
    error: logError
};
