import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getToken, setToken, removeToken, getSavedUser, setSavedUser, authFetch } from '../utils/auth';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => getSavedUser());
    const [loading, setLoading] = useState(true);
    const [showLoginModal, setShowLoginModal] = useState(false);

    // 檢查是否已登入，未登入則彈出登入視窗，回傳 true/false
    const requireLogin = useCallback(() => {
        if (user) return true;
        setShowLoginModal(true);
        return false;
    }, [user]);

    // 啟動時以 token 驗證身份
    useEffect(() => {
        const token = getToken();
        if (!token) {
            setLoading(false);
            return;
        }
        authFetch(`${API_BASE}/auth/me`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setUser(data.user);
                    setSavedUser(data.user);
                } else {
                    removeToken();
                    setUser(null);
                }
            })
            .catch(() => {
                removeToken();
                setUser(null);
            })
            .finally(() => setLoading(false));
    }, []);

    const login = useCallback(async (email, password) => {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        setToken(data.token);
        setUser(data.user);
        setSavedUser(data.user);
        return data.user;
    }, []);

    const register = useCallback(async (email, password, name) => {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        setToken(data.token);
        setUser(data.user);
        setSavedUser(data.user);
        return data.user;
    }, []);

    const googleLogin = useCallback(async (credential) => {
        const res = await fetch(`${API_BASE}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        setToken(data.token);
        setUser(data.user);
        setSavedUser(data.user);
        return data.user;
    }, []);

    const logout = useCallback(() => {
        removeToken();
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, login, register, googleLogin, logout, showLoginModal, setShowLoginModal, requireLogin }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
