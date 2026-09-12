import { useState, useCallback } from 'react';
import { Place } from '../domain/types';

export type LocationStatus = 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable';

/**
 * Browser geolocation for "현재 위치를 출발지로 사용".
 * Denial is a normal, recoverable state: the user falls back to manual input.
 */
export function useCurrentLocation() {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [place, setPlace] = useState<Place | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const request = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable');
      setMessage('이 브라우저는 위치 권한을 지원하지 않아요. 출발지를 직접 검색해주세요.');
      return;
    }

    setStatus('locating');
    setPlace(null);
    setMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: Place = {
          label: '현재 위치',
          subLabel: 'GPS (브라우저)',
          coordinate: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          },
          source: 'geolocation',
          accuracy: typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : undefined,
        };
        setPlace(p);
        setStatus('ready');
      },
      () => {
        setStatus('denied');
        setMessage('위치 권한이 거부됐어요. 아래 칸에 출발지를 직접 입력하면 됩니다.');
      },
      { timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  return { status, place, message, request };
}