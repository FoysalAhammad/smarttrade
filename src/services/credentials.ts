import * as SecureStore from 'expo-secure-store';

const KEY_ID = 'binance_api_key';
const SECRET_ID = 'binance_api_secret';

export interface Credentials {
  apiKey: string;
  apiSecret: string;
}

let cached: Credentials | null | undefined;

export const loadCredentials = async (): Promise<Credentials | null> => {
  if (cached !== undefined) return cached;
  try {
    const [apiKey, apiSecret] = await Promise.all([
      SecureStore.getItemAsync(KEY_ID),
      SecureStore.getItemAsync(SECRET_ID),
    ]);
    cached = apiKey && apiSecret ? { apiKey, apiSecret } : null;
  } catch {
    cached = null;
  }
  return cached;
};

export const saveCredentials = async (apiKey: string, apiSecret: string): Promise<void> => {
  await SecureStore.setItemAsync(KEY_ID, apiKey.trim());
  await SecureStore.setItemAsync(SECRET_ID, apiSecret.trim());
  cached = { apiKey: apiKey.trim(), apiSecret: apiSecret.trim() };
};

export const clearCredentials = async (): Promise<void> => {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_ID),
    SecureStore.deleteItemAsync(SECRET_ID),
  ]);
  cached = null;
};

/** Demo/paper-trading placeholder keys — same Keystore encryption as real keys. */
const DEMO_KEY_ID = 'demo_api_key';
const DEMO_SECRET_ID = 'demo_api_secret';

export const loadDemoCredentials = async (): Promise<Credentials | null> => {
  try {
    const [apiKey, apiSecret] = await Promise.all([
      SecureStore.getItemAsync(DEMO_KEY_ID),
      SecureStore.getItemAsync(DEMO_SECRET_ID),
    ]);
    return apiKey || apiSecret ? { apiKey: apiKey ?? '', apiSecret: apiSecret ?? '' } : null;
  } catch {
    return null;
  }
};

export const saveDemoCredentials = async (apiKey: string, apiSecret: string): Promise<void> => {
  if (apiKey) await SecureStore.setItemAsync(DEMO_KEY_ID, apiKey);
  else await SecureStore.deleteItemAsync(DEMO_KEY_ID);
  if (apiSecret) await SecureStore.setItemAsync(DEMO_SECRET_ID, apiSecret);
  else await SecureStore.deleteItemAsync(DEMO_SECRET_ID);
};

export const clearDemoCredentials = async (): Promise<void> => {
  await Promise.all([
    SecureStore.deleteItemAsync(DEMO_KEY_ID),
    SecureStore.deleteItemAsync(DEMO_SECRET_ID),
  ]);
};
