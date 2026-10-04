import mobileAds, { AdEventType, InterstitialAd, TestIds } from 'react-native-google-mobile-ads';

/**
 * Ad identifiers are stored XOR+Base64-encrypted and only decoded at runtime
 * inside the integrity-gated app (tampered/re-signed builds crash in native
 * code before this module ever executes).
 */
const KEY = 'ST-ad-2026!';
const APP_ID_ENC = 'MDUAABRdH0BHVAxgbRlRVhgEAAsPGGdmGFVQUwEDBgEUYmUaUFc=';
const INTERSTITIAL_ENC = 'MDUAABRdH0BHVAxgbRlRVhgEAAsPGGdmGFVQAgMAAQUQZGcaUFY=';

const decode = (b64: string): string => {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return Array.from(bytes, (b, i) => String.fromCharCode(b ^ KEY.charCodeAt(i % KEY.length))).join('');
};

/** Minimum gap between two interstitials (any trigger). */
const COOLDOWN_MS = 75_000;
/** Safety cap per app session. */
const MAX_PER_SESSION = 12;

let ready = false;
let disposed = false;
let interstitial: InterstitialAd | null = null;
let adLoaded = false;
let lastShownAt = 0;
let shownThisSession = 0;
let listeners: Array<() => void> = [];

/** Self-check: encrypted blobs must decode to valid AdMob ids (tamper tripwire). */
const blobsIntact = (): boolean => {
  try {
    return decode(APP_ID_ENC).startsWith('ca-app-pub-') && decode(INTERSTITIAL_ENC).startsWith('ca-app-pub-');
  } catch {
    return false;
  }
};

const decodeUnit = (): string => {
  try {
    return decode(INTERSTITIAL_ENC);
  } catch {
    return TestIds.INTERSTITIAL;
  }
};

const loadAd = () => {
  if (disposed) return;
  listeners.forEach((un) => un());
  listeners = [];
  try {
    interstitial = InterstitialAd.createForAdRequest(decodeUnit(), {
      requestNonPersonalizedAdsOnly: false,
    });
    listeners.push(
      interstitial.addAdEventListener(AdEventType.LOADED, () => {
        adLoaded = true;
      }),
      interstitial.addAdEventListener(AdEventType.ERROR, () => {
        adLoaded = false;
        if (!disposed) setTimeout(loadAd, 15_000);
      }),
      interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        adLoaded = false;
        if (!disposed) loadAd();
      }),
    );
    interstitial.load();
  } catch {
    interstitial = null;
  }
};

/** Initialise the SDK once (call after the privacy consent is accepted). */
export const initAds = async (): Promise<void> => {
  if (ready) return;
  if (!blobsIntact()) return;
  ready = true;
  try {
    await mobileAds().setRequestConfiguration({ testDeviceIdentifiers: [] });
    await mobileAds().initialize();
    loadAd();
  } catch {
    ready = false;
  }
};

/**
 * Show an interstitial tied to a user action (strategy apply, method switch,
 * IP copy, API save, demo enable). Silent no-op when not loaded / cooling down.
 */
export const maybeShowAd = (): void => {
  try {
    if (!ready || disposed) return;
    if (!adLoaded || !interstitial) return;
    const now = Date.now();
    if (now - lastShownAt < COOLDOWN_MS) return;
    if (shownThisSession >= MAX_PER_SESSION) return;
    lastShownAt = now;
    shownThisSession += 1;
    adLoaded = false;
    interstitial.show();
  } catch {
    /* never break the user flow because of ads */
  }
};

/** Ad status for debugging/settings badges. */
export const adStatus = (): { ready: boolean; loaded: boolean; shown: number } => ({
  ready,
  loaded: adLoaded,
  shown: shownThisSession,
});
