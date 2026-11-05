/**
 * HTML page rendered inside the WebView. It hosts MapLibre GL JS and talks to
 * React Native through postMessage (web -> RN) and window.__recv (RN -> web).
 *
 * Runs in Expo Go because react-native-webview ships with Expo Go.
 */
const MAPLIBRE_VERSION = '4.7.1';
const MDI_VERSION = '7.4.47';

export type MapInit = {
  style: object;
  center: [number, number];
  zoom: number;
  dark: boolean;
};

export function buildMapHtml(init: MapInit): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@mdi/font@${MDI_VERSION}/css/materialdesignicons.min.css" />
<script src="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js"></script>
<style>
  :root { --ctrl-top: 10px; }
  html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
  body { background: ${init.dark ? '#0B1220' : '#F2EFE9'}; -webkit-tap-highlight-color: transparent; }
  .maplibregl-ctrl-top-right { top: var(--ctrl-top); }
  .maplibregl-ctrl-group { border-radius: 24px !important; box-shadow: 0 2px 6px rgba(0,0,0,.25) !important; }
  .maplibregl-ctrl-group button { width: 44px; height: 44px; }
  body.dark .maplibregl-ctrl-group { background: #151E2E; }
  body.dark .maplibregl-ctrl-icon { filter: invert(1); }
  body.dark .maplibregl-ctrl-attrib { background: rgba(21,30,46,.8); color: #9CA3AF; }
  body.dark .maplibregl-ctrl-attrib a { color: #9CA3AF; }

  .pin { display: flex; flex-direction: column; align-items: center; cursor: pointer; }
  .pin .dot { width: 34px; height: 34px; border-radius: 50%; border: 2px solid #fff; display: flex;
              align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,.3);
              transition: transform .15s ease; }
  .pin .dot i { color: #fff; font-size: 19px; line-height: 1; }
  .pin .tip { width: 0; height: 0; margin-top: -1px; border-left: 6px solid transparent;
              border-right: 6px solid transparent; border-top: 8px solid #000; }
  .pin.selected .dot { transform: scale(1.3); border-width: 3px; }
  .pin.selected .tip { transform: translateY(4px); }

  .me { width: 22px; height: 22px; position: relative; }
  .me .core { position: absolute; inset: 3px; border-radius: 50%; background: #1A73E8;
              border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.4); }
  .me .pulse { position: absolute; inset: -14px; border-radius: 50%; background: rgba(26,115,232,.25);
               animation: pulse 2s ease-out infinite; }
  @keyframes pulse { 0% { transform: scale(.4); opacity: 1; } 100% { transform: scale(1.4); opacity: 0; } }
</style>
</head>
<body class="${init.dark ? 'dark' : ''}">
<div id="map"></div>
<script>
(function () {
  var INIT = ${JSON.stringify(init)};
  function post(m) {
    var s = JSON.stringify(m);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);  // iOS / Android
    else if (window.parent && window.parent !== window) window.parent.postMessage(s, '*');  // web iframe
  }
  window.onerror = function (msg) { post({ type: 'log', message: String(msg) }); };

  if (typeof maplibregl === 'undefined') {
    post({ type: 'fatal', message: 'Could not load the map. Check your internet connection.' });
    return;
  }

  var map = new maplibregl.Map({
    container: 'map',
    style: INIT.style,
    center: INIT.center,
    zoom: INIT.zoom,
    attributionControl: false,
    pitchWithRotate: false,
    dragRotate: true,
    touchPitch: false,
    fadeDuration: 150
  });
  map.touchZoomRotate.enableRotation();
  map.addControl(new maplibregl.NavigationControl({ showZoom: false, showCompass: true, visualizePitch: false }), 'top-right');
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

  var ready = false, markers = {}, userMarker = null, routeData = null;

  function emitRegion(user) {
    var c = map.getCenter(), b = map.getBounds();
    post({ type: 'region', center: [c.lng, c.lat], zoom: map.getZoom(), bearing: map.getBearing(),
           bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], userInteraction: user });
  }

  map.on('load', function () { ready = true; applyRoute(); post({ type: 'ready' }); emitRegion(false); });
  map.on('moveend', function (e) { emitRegion(!!e.originalEvent); });
  map.on('click', function (e) {
    var t = e.originalEvent && e.originalEvent.target;
    if (t && t.closest && t.closest('.pin')) return;
    post({ type: 'press', lngLat: [e.lngLat.lng, e.lngLat.lat] });
  });

  /* ---------- markers ---------- */
  function styleEl(el, it) {
    el.__id = it.id;
    el.classList.toggle('selected', !!it.selected);
    el.style.zIndex = it.selected ? '10' : '';
    el.querySelector('.dot').style.background = it.color;
    el.querySelector('.tip').style.borderTopColor = it.color;
    el.querySelector('i').className = 'mdi mdi-' + it.icon;
  }
  function makeEl() {
    var el = document.createElement('div');
    el.className = 'pin';
    el.innerHTML = '<div class="dot"><i></i></div><div class="tip"></div>';
    el.addEventListener('click', function (ev) { ev.stopPropagation(); post({ type: 'markerPress', id: el.__id }); });
    return el;
  }
  function setMarkers(items) {
    var keep = {};
    items.forEach(function (it) {
      keep[it.id] = 1;
      var m = markers[it.id];
      if (!m) {
        var el = makeEl();
        styleEl(el, it);
        markers[it.id] = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(it.lngLat).addTo(map);
      } else {
        m.setLngLat(it.lngLat);
        styleEl(m.getElement(), it);
      }
    });
    Object.keys(markers).forEach(function (id) { if (!keep[id]) { markers[id].remove(); delete markers[id]; } });
  }

  /* ---------- user location (blue dot) ---------- */
  function setUser(ll) {
    if (!ll) { if (userMarker) { userMarker.remove(); userMarker = null; } return; }
    if (!userMarker) {
      var el = document.createElement('div');
      el.className = 'me';
      el.innerHTML = '<div class="pulse"></div><div class="core"></div>';
      userMarker = new maplibregl.Marker({ element: el }).setLngLat(ll).addTo(map);
    } else {
      userMarker.setLngLat(ll);
    }
  }

  /* ---------- route polyline ---------- */
  function applyRoute() {
    var data = routeData && routeData.coords && routeData.coords.length
      ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeData.coords } }
      : { type: 'FeatureCollection', features: [] };
    var src = map.getSource('route');
    if (!src) {
      map.addSource('route', { type: 'geojson', data: data });
      map.addLayer({ id: 'route-casing', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#fff', 'line-width': 9 } });
      map.addLayer({ id: 'route-line', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#0B6BCB', 'line-width': 6 } });
    } else {
      src.setData(data);
    }
    if (routeData) {
      map.setPaintProperty('route-casing', 'line-color', routeData.casing);
      map.setPaintProperty('route-line', 'line-color', routeData.color);
      map.setPaintProperty('route-line', 'line-dasharray', routeData.dashed ? [0.5, 2] : null);
    }
  }

  /* ---------- theme ---------- */
  function setTheme(dark) {
    document.body.classList.toggle('dark', dark);
    document.body.style.background = dark ? '#0B1220' : '#F2EFE9';
    map.setLayoutProperty('base-light', 'visibility', dark ? 'none' : 'visible');
    map.setLayoutProperty('base-dark', 'visibility', dark ? 'visible' : 'none');
    map.setPaintProperty('background', 'background-color', dark ? '#0B1220' : '#F2EFE9');
  }

  /* ---------- camera ---------- */
  function camera(c) {
    var duration = c.duration == null ? 800 : c.duration;
    if (c.op === 'fitBounds') {
      map.fitBounds([[c.bounds[0], c.bounds[1]], [c.bounds[2], c.bounds[3]]],
        { padding: c.padding || 40, duration: duration, maxZoom: 17 });
      return;
    }
    var o = { center: c.center, duration: duration };
    if (c.zoom != null) o.zoom = c.zoom;
    if (c.bearing != null) o.bearing = c.bearing;
    if (c.op === 'flyTo') map.flyTo(o); else map.easeTo(o);
  }

  window.__recv = function (msg) {
    try {
      switch (msg.type) {
        case 'markers': setMarkers(msg.items); break;
        case 'user': setUser(msg.lngLat); break;
        case 'route': routeData = msg.route; if (ready) applyRoute(); break;
        case 'theme': setTheme(msg.dark); break;
        case 'controlsTop': document.documentElement.style.setProperty('--ctrl-top', msg.top + 'px'); break;
        case 'camera': camera(msg); break;
      }
    } catch (e) { post({ type: 'log', message: String(e && e.message || e) }); }
  };
})();
</script>
</body>
</html>`;
}
