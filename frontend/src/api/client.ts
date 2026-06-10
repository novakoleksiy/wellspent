import { IS_DEMO } from "../demo";

const BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

// Demo mode only: the kiosk holds a single JWT in localStorage and never logs
// in interactively, so once that token expires every request would 401 and the
// demo would silently break until someone intervened. Instead we treat a 401 as
// "re-mint a credential-free demo session and retry once". A token's lifetime
// therefore stops mattering — the kiosk self-heals within one request.
//
// In-flight refreshes are de-duplicated: a burst of parallel requests that all
// 401 share one mint rather than hammering the rate-limited session endpoint.
let demoRefresh: Promise<string | null> | null = null;

function refreshDemoToken(): Promise<string | null> {
    if (!demoRefresh) {
        demoRefresh = (async () => {
            try {
                const res = await fetch(`${BASE}/api/demo/session`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                });
                if (!res.ok) return null;
                const { access_token } = await res.json();
                localStorage.setItem("token", access_token);
                return access_token as string;
            } catch {
                return null;
            } finally {
                // Clear the slot so a later expiry can mint again. Callers
                // already hold the resolved promise, so this is race-safe.
                demoRefresh = null;
            }
        })();
    }
    return demoRefresh;
}

async function send<T>(
    path: string,
    options: RequestInit,
    allowRetry: boolean,
): Promise<T> {
    const token = localStorage.getItem("token");

    const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    // Stored demo token likely expired — re-mint and retry the request once.
    if (res.status === 401 && IS_DEMO && allowRetry) {
        const fresh = await refreshDemoToken();
        if (fresh) return send<T>(path, options, false);
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? "Request failed");
    }

    if (res.status === 204) return undefined as T;
    return res.json();
}

export function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    return send<T>(path, options, true);
}
