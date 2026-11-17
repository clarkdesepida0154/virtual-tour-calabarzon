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
