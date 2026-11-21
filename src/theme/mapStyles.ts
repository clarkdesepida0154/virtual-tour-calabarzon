/**
 * Google Maps style JSON (Android / Google provider) for both themes: a
 * warm, quiet base map so the category pins carry the colour. Points of
 * interest, transit and road icons are hidden. Pure.
 */
export type MapStyleElement = {
  featureType?: string;
  elementType?: string;
  stylers: Record<string, string | number>[];
};

/** Warm parchment map — the original Run 3 style. */
export const lightMapStyle: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#F2EADC' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5C5149' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FAF6EF' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#E8DFD0' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#CFC3B1' }] },
  { featureType: 'administrative.province', elementType: 'labels.text.fill', stylers: [{ color: '#7A600E' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#EDE4D3' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#C8D9DE' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5B7C86' }] },
];

/** Night gallery map: deep warm browns, muted ink-blue water, gold province names. */
export const darkMapStyle: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#221B17' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#BBAE9F' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#16110E' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#3A302A' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9A8D80' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4A3D34' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#5A4C43' }] },
  { featureType: 'administrative.province', elementType: 'labels.text.fill', stylers: [{ color: '#E6C86E' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#1E1814' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#14232A' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6F8F9A' }] },
];
