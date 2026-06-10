/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useState } from "react";
import * as authApi from "../api/auth";
import { IS_DEMO } from "../demo";
import type { UserOut } from "../types";

interface AuthContextType {
    user: UserOut | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, full_name: string) => Promise<void>;
    refreshUser: () => Promise<UserOut>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<UserOut | null>(null);
    // In demo mode we fetch a token on load, so start in loading state even
    // without a stored token to keep route guards from bouncing to /login.
    const [loading, setLoading] = useState(
        () => Boolean(localStorage.getItem("token")) || IS_DEMO,
    );
    // Demo mode only: true while we've failed to obtain a demo token and are
    // retrying. Surfaces a visible message instead of silently blanking out.
    const [demoError, setDemoError] = useState(false);

    const refreshUser = async () => {
        const me = await authApi.getMe();
        setUser(me);
        return me;
    };

    useEffect(() => {
        let cancelled = false;

        // In demo mode the token comes from the credential-free session endpoint.
        // If it isn't ready yet — the machine rebooted before the seed script ran
        // (503), or a transient network blip — retry with capped backoff rather
        // than dropping the kiosk on /login, where sign-out is hidden and there's
        // no way back. This self-heals once the backend is seeded/reachable.
        const acquireDemoToken = async (): Promise<string | null> => {
            let delay = 2000;
            while (!cancelled) {
                try {
                    const { access_token } = await authApi.demoSession();
                    localStorage.setItem("token", access_token);
                    setDemoError(false);
                    return access_token;
                } catch {
                    setDemoError(true);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    delay = Math.min(delay * 2, 15000);
                }
            }
            return null;
        };

        const start = async () => {
            let token = localStorage.getItem("token");
            if (!token && IS_DEMO) {
                token = await acquireDemoToken();
            }
            if (!token || cancelled) {
                return;
            }
            try {
                setUser(await authApi.getMe());
            } catch {
                // The stored token was rejected and the client's transparent
                // refresh couldn't recover it (e.g. the demo backend isn't seeded
                // yet, so /demo/session 503s). Drop it and, in demo mode, fall
                // back to the backoff-retrying acquire — with its visible
                // "Starting the demo…" status — so the kiosk self-heals instead
                // of stranding on /login.
                localStorage.removeItem("token");
                if (!IS_DEMO || cancelled) {
                    return;
                }
                token = await acquireDemoToken();
                if (!token || cancelled) {
                    return;
                }
                try {
                    setUser(await authApi.getMe());
                } catch {
                    localStorage.removeItem("token");
                }
            }
        };

        start().finally(() => {
            if (!cancelled) setLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, []);

    // Kiosk-safe fallback: keep retrying in the background, but show a visible
    // status instead of a blank screen while the demo token is unavailable.
    if (IS_DEMO && demoError && !user) {
        return (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "100vh",
                    gap: "0.75rem",
                    textAlign: "center",
                    padding: "2rem",
                }}
            >
                <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Starting the demo…</h1>
                <p style={{ opacity: 0.7, maxWidth: "28rem" }}>
                    Couldn't reach the demo account yet — retrying automatically. If this
                    persists, the demo data may still need to be seeded on the server.
                </p>
            </div>
        );
    }

    const login = async (email: string, password: string) => {
        const { access_token } = await authApi.login(email, password);
        localStorage.setItem("token", access_token);
        await refreshUser();
    };

    const register = async (email: string, password: string, full_name: string) => {
        await authApi.register(email, password, full_name);
        await login(email, password);
    };

    const logout = () => {
        localStorage.removeItem("token");
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, refreshUser, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
}
