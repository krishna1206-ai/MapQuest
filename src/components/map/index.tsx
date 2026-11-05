// Picks the map engine: the native MapLibre map in the installed app, a WebView map in Expo Go
// (which lacks the MapLibre native module, so even importing native.tsx there would crash).
// The browser build uses index.web.tsx instead.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type * as Native from './native';

const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/* eslint-disable @typescript-eslint/no-require-imports */
const impl: typeof Native = inExpoGo ? require('./expoGo') : require('./native');
/* eslint-enable @typescript-eslint/no-require-imports */

export const MapView = impl.MapView;
export const Marker = impl.Marker;
export const Polyline = impl.Polyline;
export const Places = impl.Places;
// Same name as the component so screens can write useRef<MapView>, as with react-native-maps.
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type MapView = Native.MapView;
