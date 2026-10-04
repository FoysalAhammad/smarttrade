const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;

const PROVIDERS: { url: string; parse: (text: string) => string }[] = [
  { url: 'https://api.ipify.org?format=json', parse: (t) => (JSON.parse(t) as { ip: string }).ip ?? '' },
  { url: 'https://api.bigdatacloud.net/data/client-ip', parse: (t) => (JSON.parse(t) as { ipString: string }).ipString ?? '' },
  { url: 'https://ifconfig.me/ip', parse: (t) => t.trim() },
  { url: 'https://icanhazip.com', parse: (t) => t.trim() },
  { url: 'https://checkip.amazonaws.com', parse: (t) => t.trim() },
];

const TIMEOUT_MS = 6000;

const fetchText = async (url: string): Promise<string> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
};

/**
 * The device's public IPv4 — the exact source address Binance sees when the
 * app signs a request, so it is the value to whitelist under
 * API Management → Create API → "Restrict access to trusted IPs only".
 * Providers are tried in order (first valid IPv4 wins).
 */
export const getPublicIp = async (): Promise<string> => {
  let lastError: unknown;
  for (const provider of PROVIDERS) {
    try {
      const raw = await fetchText(provider.url);
      const ip = provider.parse(raw).trim();
      if (IPV4.test(ip) && ip.split('.').every((o) => Number(o) <= 255)) return ip;
      lastError = new Error(`Invalid IP from ${provider.url}`);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not detect public IP');
};
