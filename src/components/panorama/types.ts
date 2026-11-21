/** Shared props of PanoramaFrame.tsx (native WebView) and PanoramaFrame.web.tsx (iframe). */
export type PanoramaFrameProps = {
  /** The Maps Embed API Street View URL (src/lib/panorama.ts). */
  url: string;
  /** Accessible title of the view. */
  title: string;
  onLoaded: () => void;
  onFailed: () => void;
};
