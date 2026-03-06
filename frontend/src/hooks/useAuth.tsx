import { createContext, useContext, useEffect, useState } from "react";
import * as authApi from "../api/auth";
import type { UserOut } from "../types";

interface AuthContextType {
    user: UserOut | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, full_name: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<UserOut | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) { setLoading(false); return; }

        authApi.getMe()
            .then(setUser)
            .catch(() => localStorage.removeItem("token"))
            .finally(() => setLoading(false));
    }, []);

    const login = async (email: string, password: string) => {
        const { access_token } = await authApi.login(email, password);
        localStorage.setItem("token", access_token);
        const me = await authApi.getMe();
        setUser(me);
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
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
}
