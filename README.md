# MapQuest Mobile (Expo Go · iOS · Android · Web)

A React Native (Expo SDK 58 + TypeScript) app for mapquest.com. It has a MapLibre map, nearby places with category markers, autocomplete search, and directions powered by MapQuest APIs.
**It runs in Expo Go.** You don't need Android Studio or Xcode.

## How the map works
- The map uses **MapLibre GL JS**, not Google Maps.
  - **Phone:** it runs inside `react-native-webview`, which ships with Expo Go.
  - **Web:** it runs inside an `<iframe>` (`MapWebView.web.tsx`).
- Basemap tiles come from OpenStreetMap (light mode) and CARTO Dark (dark mode). You can change both in `.env`.
- MapQuest APIs used:
  - Search v4 `/search/v4/place` for nearby places
  - Search v3 `/search/v3/prediction` for autocomplete
  - Directions v2 `/directions/v2/route` for routes

## Structure
```
src/app/                 Expo Router routes
  _layout.tsx            Stack + light/dark theme
  index.tsx              /            → MapScreen
  directions.tsx         /directions  → DirectionsScreen
src/screens/             MapScreen, DirectionsScreen
src/components/          CategoryChips, SearchBar, PlaceBottomSheet, StatusPill, IconButton, TravelModeTabs
src/components/map/      MapWebView (.tsx native / .web.tsx web), useMapBridge, mapHtml, types
src/services/            mapquestApi.ts (all HTTP), types.ts
src/hooks/               useUserLocation, useNearbyPlaces (debounced), useAutocomplete, useRoute, useAppTheme
src/utils/               config (.env), categories (icons/colours), geo, mapStyle, theme, debounce
```

## Setup
```bash
cd D:\mapquest
npm install
```
Put your key in `.env`:
```
EXPO_PUBLIC_MAPQUEST_API_KEY=your_key_here
```
Restart the dev server after you change `.env`.

## Run
```bash
npm start            # dev server + QR code
```
- **Android:** scan the QR code with the **Expo Go** app.
- **iPhone:** scan the QR code with the **Camera** app. It opens Expo Go.
- **Web:** press `w` in the terminal, or run `npm run web`.

If your phone can't connect over Wi-Fi, run `npx expo start --tunnel`.

## Notes
- **API key exposure:** `EXPO_PUBLIC_*` values end up in the app bundle. Restrict the key in the MapQuest developer portal, or proxy requests through your own backend.
- **Tiles:** public OSM tiles are rate-limited by their [usage policy](https://operations.osmfoundation.org/policies/tiles/). Use your own tile server or a commercial provider before release.
- **Branding:** colours are in `src/utils/theme.ts`.
- **Request throttling:** map moves are debounced by 800 ms. The app skips moves under 250 m, cancels older requests, and caches results for 5 minutes.
- **Checks:** `npm run typecheck` and `npm run doctor`.
