// Kiosk demo guard. On a stationary demo machine we don't want attendees to
// accidentally navigate away from the app: many detail screens link out to
// MySwitzerland, booking providers, maps, mailto:/tel:, etc. Rather than thread
// a "demo" prop through every component, we install one capture-phase click
// listener that swallows any click which would leave the SPA and shows a brief
// toast instead. Install only when IS_DEMO is true.

function isExternalNavigation(anchor: HTMLAnchorElement): boolean {
  // Opens a new tab/window — always leaves the kiosk view.
  if (anchor.target === "_blank") return true;

  const href = anchor.getAttribute("href");
  if (!href) return false;

  // In-page anchors and explicit SPA routes are fine.
  if (href.startsWith("#") || href.startsWith("/")) return false;

  // mailto:/tel: hand off to an external handler — block them too.
  if (/^(mailto|tel):/i.test(href)) return true;

  // Any absolute URL to a different origin leaves the app.
  try {
    const url = new URL(href, window.location.origin);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.origin !== window.location.origin;
    }
    // Non-http(s) schemes (e.g. maps:, geo:) hand off to the OS.
    return true;
  } catch {
    return false;
  }
}

let toastEl: HTMLDivElement | null = null;
let toastTimer: number | undefined;

function showToast(message: string): void {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.setAttribute("role", "status");
    toastEl.style.cssText = [
      "position:fixed",
      "left:50%",
      "bottom:32px",
      "transform:translateX(-50%) translateY(8px)",
      "z-index:2147483647",
      "max-width:min(90vw,420px)",
      "padding:12px 18px",
      "border-radius:999px",
      "background:rgba(28,26,22,0.92)",
      "color:#fff",
      "font:500 14px/1.4 system-ui,-apple-system,sans-serif",
      "text-align:center",
      "box-shadow:0 8px 24px rgba(0,0,0,0.25)",
      "opacity:0",
      "pointer-events:none",
      "transition:opacity .18s ease, transform .18s ease",
    ].join(";");
    document.body.appendChild(toastEl);
  }

  toastEl.textContent = message;
  // Force a reflow so the transition runs on repeated triggers.
  void toastEl.offsetWidth;
  toastEl.style.opacity = "1";
  toastEl.style.transform = "translateX(-50%) translateY(0)";

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (!toastEl) return;
    toastEl.style.opacity = "0";
    toastEl.style.transform = "translateX(-50%) translateY(8px)";
  }, 2200);
}

export function installDemoLinkGuard(): () => void {
  const onClick = (event: MouseEvent) => {
    const target = event.target as Element | null;
    const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
    if (!anchor) return;
    if (!isExternalNavigation(anchor)) return;

    event.preventDefault();
    event.stopPropagation();
    showToast("External links are disabled in this demo");
  };

  // Capture phase so we win before React/router handlers fire.
  document.addEventListener("click", onClick, true);

  // Block middle-click / modifier "open in new tab" too.
  const onAux = (event: MouseEvent) => {
    const anchor = (event.target as Element | null)?.closest?.("a") as HTMLAnchorElement | null;
    if (anchor && isExternalNavigation(anchor)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  document.addEventListener("auxclick", onAux, true);

  return () => {
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("auxclick", onAux, true);
    window.clearTimeout(toastTimer);
    toastEl?.remove();
    toastEl = null;
  };
}
