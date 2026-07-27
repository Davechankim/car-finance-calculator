'use client';

import { useEffect } from 'react';
import {
  getAdsenseConfig,
  type AdsensePlacement,
} from '@/lib/adsense';

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

export function AdSlot(props: {
  placement: AdsensePlacement;
  label: string;
}) {
  const config = getAdsenseConfig();
  const client = config.active ? config.client : null;
  const slot = config.active ? config.slots[props.placement] : null;

  useEffect(() => {
    if (!client || !slot) return;
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {
      // 광고 차단기나 네트워크 오류가 계산기 사용을 방해하지 않게 한다.
    }
  }, [client, slot]);

  if (!client || !slot) return null;
  return (
    <aside className="ad-container" aria-label={props.label}>
      <span className="ad-label">광고</span>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
