import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { MapOverlay } from './MapOverlay';
import type { MapViewProps } from './types';
import { useMapBridge } from './useMapBridge';

export type { MapHandle, MapMarker, MapRoute, Region } from './types';

type MapWindow = Window & { __recv?: (msg: object) => void };

/**
 * Web: the same MapLibre page as native, rendered in an <iframe>.
 * A srcdoc iframe shares the parent's origin, so we can call into it directly.
 */
export function MapWebView(props: MapViewProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const inject = useCallback((msg: object) => {
    (frame.current?.contentWindow as MapWindow | null)?.__recv?.(msg);
  }, []);
  const { html, handleMessage, loaded, fatal, reload, reloadKey, dark } = useMapBridge(props, inject);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || typeof e.data !== 'string') return;
      handleMessage(e.data);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [handleMessage]);

  return (
    <View style={[styles.flex, { backgroundColor: dark ? '#0B1220' : '#F2EFE9' }]}>
      <iframe
        key={reloadKey}
        ref={frame}
        srcDoc={html}
        title="Map"
        allow="geolocation"
        style={{ border: 0, width: '100%', height: '100%', display: 'block' }}
      />
      <MapOverlay loaded={loaded} fatal={fatal} onRetry={reload} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, overflow: 'hidden' },
});
