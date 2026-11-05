# MapQuest mobile app

React Native (Expo SDK 58) app for iOS and Android: map, search, nearby places, directions and turn-by-turn navigation. The phone map is MapLibre with a Google-style vector map (OpenFreeMap), with no Google SDK or logo. The browser uses Leaflet.

## Run it

**Browser:** `npm install`, then `npx expo start --web`.

**Phone:** MapLibre is a native module, so Expo Go cannot run it. Build the test app once in the cloud:

1. `npx eas-cli@latest build --profile development --platform android`
2. Install the APK from the link it prints
3. `npx expo start --dev-client` and open the project from the installed app

It works with no setup. Without a MapQuest key, search and routing use free OpenStreetMap services (Photon for search and nearby places, OSRM routing).

## Switch to MapQuest

1. Get an API key at https://developer.mapquest.com/
2. `cp .env.example .env` and put the key in `EXPO_PUBLIC_MAPQUEST_KEY`
3. Restart `npx expo start`

With a key the app uses MapQuest search, directions, traffic-aware ETAs and the avoid tolls/highways options.

## Structure

- `src/screens/MapScreen.tsx` – the single map screen and its modes (browse, results, place, directions, navigate)
- `src/api/` – `index.ts` picks the provider; `mapquest.ts` and `openData.ts` implement it
- `src/hooks/` – location, recent searches, turn-by-turn guidance
- `src/components/` – search bar, category chips, bottom panels, navigation banner
- `src/theme.ts` – colors (swap in brand colors), categories, maneuver icons

## Before release

- Use a MapQuest key; the free OpenStreetMap servers are for development only.
- Move the API key behind a server proxy; `EXPO_PUBLIC_` values are visible inside the app bundle.
- Replace the icon and splash in `assets/` with brand assets.
- Build with EAS: `npx eas-cli@latest build`.
