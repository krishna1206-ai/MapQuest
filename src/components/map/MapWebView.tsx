import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { MapOverlay } from './MapOverlay';
import type { MapViewProps } from './types';
import { useMapBridge } from './useMapBridge';

export type { MapHandle, MapMarker, MapRoute, Region } from './types';

/**
 * iOS / Android: MapLibre GL JS inside react-native-webview.
 * react-native-webview ships with Expo Go, so no custom native build is needed.
 * (Web uses MapWebView.web.tsx.)
 */
export function MapWebView(props: MapViewProps) {
  // `WebView<{}>`: the library's default generic resolves its props to `never`.
  const web = useRef<WebView<{}>>(null);
  const inject = useCallback((msg: object) => {
    web.current?.injectJavaScript(`window.__recv && window.__recv(${JSON.stringify(msg)}); true;`);
  }, []);
  const { html, handleMessage, loaded, fatal, setFatal, reload, reloadKey, dark } = useMapBridge(props, inject);

  return (
    <View style={[styles.flex, { backgroundColor: dark ? '#0B1220' : '#F2EFE9' }]}>
      <WebView
        key={reloadKey}
        ref={web}
        style={styles.webview}
        source={{ html, baseUrl: 'https://localhost/' }}
        originWhitelist={['*']}
        onMessage={(e) => handleMessage(e.nativeEvent.data)}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onError={() => setFatal('Could not load the map. Check your internet connection.')}
      />
      <MapOverlay loaded={loaded} fatal={fatal} onRetry={reload} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  webview: { flex: 1, backgroundColor: 'transparent' },
});
