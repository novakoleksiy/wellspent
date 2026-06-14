// Conference demo mode. When VITE_DEMO_MODE is "true" the app auto-logs into a
// shared demo account (no login screen) and hides sign-out controls so
// attendees can't strand themselves on the landing page.
export const IS_DEMO = import.meta.env.VITE_DEMO_MODE === "true";

// Demo link guard: blocks outbound/external links so kiosk attendees can't
// navigate away from the app. Controlled independently via VITE_DEMO_LINK_GUARD
// ("true"/"false"); when unset it follows the overall demo-mode flag so existing
// demo deployments keep guarding links by default.
const rawLinkGuard = import.meta.env.VITE_DEMO_LINK_GUARD;
export const DEMO_LINK_GUARD =
  rawLinkGuard === undefined || rawLinkGuard === ""
    ? IS_DEMO
    : rawLinkGuard === "true";
