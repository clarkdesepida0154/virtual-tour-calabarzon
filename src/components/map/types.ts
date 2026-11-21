import type { DestinationPin } from '@/types/database';

/** A camera request: frame every pin, or zoom to one. `nonce` makes a repeat request count. */
export type MapFocus = { kind: 'all'; nonce: number } | { kind: 'pin'; id: string; nonce: number };

/** Shared contract of DestinationMap.tsx (native) and DestinationMap.web.tsx. */
export type DestinationMapProps = {
  pins: DestinationPin[];
  selectedId: string | null;
  /** A pin was tapped (or the empty map, with `null`). */
  onSelect: (id: string | null) => void;
  /** The pin's callout was tapped → open its Details. */
  onOpen: (id: string) => void;
  focus: MapFocus | null;
  /** Space covered by overlays (header, card), so the camera centres in what is visible. */
  insets: { top: number; bottom: number };
};

/** Shared contract of MapPreview.tsx (native) and MapPreview.web.tsx. */
export type MapPreviewProps = {
  latitude: number;
  longitude: number;
  pinColor: string;
  label: string;
};

/** Shared contract of TripMap.tsx (native) and TripMap.web.tsx (Run 6). */
export type TripMapProps = {
  /** The stops in trip order (numbered 1…n). */
  stops: { id: string; name: string; latitude: number; longitude: number }[];
  /** The person's location when the trip starts there. */
  start: { latitude: number; longitude: number } | null;
  label: string;
  /**
   * Run 8: the road-following line from OSRM. When null the route is drawn
   * as straight dashed segments (the "approximate" fallback).
   */
  route?: { latitude: number; longitude: number }[] | null;
};
