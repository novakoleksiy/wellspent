import { request } from "./client";
import type { Token, UserOut, Preferences } from "../types";

export const register = (email: string, password: string, full_name: string) =>
    request<UserOut>("/api/users/register", {
        method: "POST",
        body: JSON.stringify({ email, password, full_name }),
    });

export const login = (email: string, password: string) =>
    request<Token>("/api/users/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });

export const getMe = () => request<UserOut>("/api/users/me");

export const updatePreferences = (prefs: Preferences) =>
    request<UserOut>("/api/users/me/preferences", {
        method: "PUT",
        body: JSON.stringify(prefs),
    });
