import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
const AUTH_SERVICE_URL = import.meta.env.VITE_AUTH_SERVICE_URL;

// Simple user shape
export interface User {
  id: string;
  fullName: string;
  email: string;
}

interface AuthResult { success: boolean; error?: string }

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  signUp: (email: string, password: string, fullName: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  signOut: () => void;
  signInWithGoogle: () => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps { children: ReactNode }

// Keys for localStorage
const LS_USERS_KEY = 'auth_users'; // kept for backward compatibility (not used now for backend)
const LS_SESSION_KEY = 'auth_session_user';
const LS_ACCESS_TOKEN = 'auth_access_token';
const LS_REFRESH_TOKEN = 'auth_refresh_token';

// Helper to load users array
function loadUsers(): Array<{ id: string; fullName: string; email: string; password: string }> {
  try {
    const raw = localStorage.getItem(LS_USERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveUsers(users: Array<{ id: string; fullName: string; email: string; password: string }>) {
  localStorage.setItem(LS_USERS_KEY, JSON.stringify(users));
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_SESSION_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signUp: AuthContextType['signUp'] = async (email, password, fullName) => {
    setIsLoading(true);
    setError(null);
    try {
      console.log("making request to", `${AUTH_SERVICE_URL}/register`);
      const resp = await fetch(`${AUTH_SERVICE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, username: fullName })
      });
      const data = await resp.json();
      if (!resp.ok) {
        return { success: false, error: data.error || 'Registration failed' };
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Network error' };
    } finally {
      setIsLoading(false);
    }
  };

  const signIn: AuthContextType['signIn'] = async (email, password) => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${AUTH_SERVICE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      const data = await resp.json();
      if (!resp.ok) {
        const err = data.error || 'Invalid credentials';
        setError(err);
        return { success: false, error: err };
      }
      // data.message expected to contain tokens and user per backend service
      const tokens = data.message || {};
      if (tokens.access_token) localStorage.setItem(LS_ACCESS_TOKEN, tokens.access_token);
      if (tokens.refresh_token) localStorage.setItem(LS_REFRESH_TOKEN, tokens.refresh_token);
      const sessionUser: User = { id: tokens.user?.id?.toString() || '', fullName: tokens.user?.username || '', email: tokens.user?.email || email };
      localStorage.setItem(LS_SESSION_KEY, JSON.stringify(sessionUser));
      setUser(sessionUser);
      return { success: true };
    } catch (e) {
      const err = 'Login failed';
      setError(err);
      return { success: false, error: err };
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword: AuthContextType['resetPassword'] = async (email) => {
    setIsLoading(true);
    setError(null);
    return new Promise<AuthResult>(resolve => {
      setTimeout(() => {
        const users = loadUsers();
        const exists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
        if (!exists) {
          const err = 'Email not found';
          setError(err);
          setIsLoading(false);
          resolve({ success: false, error: err });
          return;
        }
        // Fake success
        setIsLoading(false);
        resolve({ success: true });
      }, 800);
    });
  };

  const signInWithGoogle: AuthContextType['signInWithGoogle'] = async () => {
    try {
      const response = await fetch(`${AUTH_SERVICE_URL}/auth/login`, {
        method: "GET",
        credentials: "include", // important for sessions
      });
  
      const data = await response.json();
      console.log('Google OAuth URL response:', data); // Debug log
  
      if (data.auth_url) {
        // redirect to Google's OAuth URL
        window.location.href = data.auth_url;
        return { success: true };
      } else {
        return { success: false, error: 'Google auth URL not received' };
      }
    } catch (e) {
      console.error('Google login error:', e);
      return { success: false, error: 'Network error during Google login' };
    }
  };

  const signOut = () => {
    localStorage.removeItem(LS_SESSION_KEY);
    localStorage.removeItem(LS_ACCESS_TOKEN);
    localStorage.removeItem(LS_REFRESH_TOKEN);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, error, signUp, signIn, resetPassword, signOut, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
