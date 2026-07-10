/**
 * Analytics has been removed in the static GitHub Pages build \u2014 there's no
 * server to record events, and we don't want to embed a third-party
 * analytics key in a public static site. These hooks are now no-ops, kept
 * so existing call sites (App.tsx, suggestion-box.tsx) don't need changes.
 */

export function usePageViewTracker(): void {
  // no-op: analytics no longer tracked in the static build
}

export function trackFeature(_feature: string): void {
  // no-op: analytics no longer tracked in the static build
}
