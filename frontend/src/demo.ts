// Conference demo mode. When VITE_DEMO_MODE is "true" the app auto-logs into a
// shared demo account (no login screen) and hides sign-out controls so
// attendees can't strand themselves on the landing page.
export const IS_DEMO = import.meta.env.VITE_DEMO_MODE === "true";
