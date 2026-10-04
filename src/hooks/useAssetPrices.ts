import { useEffect, useRef, useState } from 'react';

import { getPrices } from '../services/binance';

/**
 * Market prices for a set of USDT pairs (["SUI","BTC"] → { SUIUSDT: … }).
 * Re-fetches whenever the asset list changes; silent on failure (keeps old).
 */
export const useAssetPrices = (bases: string[]): Record<string, number> => {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const mounted = useRef(true);
  const key = [...new Set(bases)].sort().join(',');

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const list = key ? key.split(',') : [];
    if (!list.length) return;
    getPrices(list.map((b) => `${b}USDT`))
      .then((map) => {
        if (mounted.current) setPrices((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {
        /* keep previous prices */
      });
  }, [key]);

  return prices;
};
