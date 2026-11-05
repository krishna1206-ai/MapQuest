import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useAppTheme } from '../../hooks/useAppTheme';
import { buildMapStyle } from '../../utils/mapStyle';
import { buildMapHtml } from './mapHtml';
import type { MapViewProps } from './types';

/**
 * Platform-independent glue between React and the MapLibre page.
 * `inject` delivers a message into the page (WebView on native, iframe on web).
 */
export function useMapBridge(props: MapViewProps, inject: (msg: object) => void) {
  const {
    ref,
    initialCenter,
    initialZoom,
    markers = [],
    userLocation = null,
    route = null,
    controlsTop = 10,
  } = props;
  const t = useAppTheme();
  const ready = useRef(false);
  const pendingCamera = useRef<object | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const injectRef = useRef(inject);
  injectRef.current = inject;
  const send = useCallback((msg: object) => injectRef.current(msg), []);

  // Built once per mount (or reload); later changes are sent as messages.
  const html = useMemo(
    () => buildMapHtml({ style: buildMapStyle(t.dark), center: initialCenter, zoom: initialZoom, dark: t.dark }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reloadKey],
  );

  /** State messages are dropped before "ready" and re-sent once it arrives. */
  const sendState = useCallback((msg: object) => ready.current && send(msg), [send]);

  const sendCamera = useCallback(
    (msg: object) => {
      if (ready.current) send(msg);
      else pendingCamera.current = msg; // keep only the latest camera move
    },
    [send],
  );

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (o) => sendCamera({ type: 'camera', op: 'flyTo', ...o }),
      easeTo: (o) => sendCamera({ type: 'camera', op: 'easeTo', ...o }),
      fitBounds: (bounds, o) => sendCamera({ type: 'camera', op: 'fitBounds', bounds, ...o }),
    }),
    [sendCamera],
  );

  const latest = useRef({ markers, userLocation, route, dark: t.dark, controlsTop });
  latest.current = { markers, userLocation, route, dark: t.dark, controlsTop };

  useEffect(() => void sendState({ type: 'markers', items: markers }), [markers, sendState]);
  useEffect(() => void sendState({ type: 'user', lngLat: userLocation }), [userLocation, sendState]);
  useEffect(() => void sendState({ type: 'route', route }), [route, sendState]);
  useEffect(() => void sendState({ type: 'theme', dark: t.dark }), [t.dark, sendState]);
  useEffect(() => void sendState({ type: 'controlsTop', top: controlsTop }), [controlsTop, sendState]);

  const handlers = useRef(props);
  handlers.current = props;

  /** Feed raw message strings coming out of the page. */
  const handleMessage = useCallback(
    (data: string) => {
      let msg: any;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }
      switch (msg?.type) {
        case 'ready': {
          ready.current = true;
          setLoaded(true);
          const s = latest.current;
          send({ type: 'theme', dark: s.dark });
          send({ type: 'controlsTop', top: s.controlsTop });
          send({ type: 'markers', items: s.markers });
          send({ type: 'user', lngLat: s.userLocation });
          send({ type: 'route', route: s.route });
          if (pendingCamera.current) {
            send(pendingCamera.current);
            pendingCamera.current = null;
          }
          break;
        }
        case 'region':
          handlers.current.onRegionDidChange?.(msg);
          break;
        case 'markerPress':
          handlers.current.onMarkerPress?.(msg.id);
          break;
        case 'press':
          handlers.current.onPress?.(msg.lngLat);
          break;
        case 'fatal':
          setFatal(msg.message);
          break;
        case 'log':
          if (__DEV__) console.log('[map]', msg.message);
          break;
      }
    },
    [send],
  );

  const reload = useCallback(() => {
    ready.current = false;
    setLoaded(false);
    setFatal(null);
    setReloadKey((k) => k + 1);
  }, []);

  return { html, handleMessage, loaded, fatal, setFatal, reload, reloadKey, dark: t.dark };
}
