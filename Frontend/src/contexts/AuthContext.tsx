import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || "http://localhost:4000";
// Auth endpoints now routed through gateway prefix: /auth/...
const AUTH_BASE = `${API_GATEWAY_URL}/auth/api/v1/auth`;

export interface User {
  id: string;
  username: string;
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

export const AuthProvider = ({ children }: AuthProviderProps) => {  
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================
  // Fetch current user (auth/me)
  // ============================
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const resp = await fetch(`${AUTH_BASE}/me`, {
          credentials: 'include',
        });

        const contentType = resp.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          setUser(null);
          return;
        }

        const data = await resp.json();
        if (data.isAuthenticated && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch (e) {
        console.error('Session check failed:', e);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  // ============================
  // Register
  // ============================
  const signUp: AuthContextType['signUp'] = async (email, password, fullName) => {
    setIsLoading(true);
    setError(null);

    try {
      const resp = await fetch(`${AUTH_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, username: fullName })
      });

      const data = await resp.json();
      if (!resp.ok) {
        return { success: false, error: data.error || 'Registration failed' };
      }

      if (data.user) setUser(data.user);
      return { success: true };

    } catch (e) {
      return { success: false, error: 'Network error' };
    } finally {
      setIsLoading(false);
    }
  };

  // ============================
  // Login
  // ============================
  const signIn: AuthContextType['signIn'] = async (email, password) => {
    setIsLoading(true);
    setError(null);

    try {
      const resp = await fetch(`${AUTH_BASE}/login`, {
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

      if (data.user) setUser(data.user);
      return { success: true };

    } catch (e) {
      const err = 'Login failed';
      setError(err);
      return { success: false, error: err };
    } finally {
      setIsLoading(false);
    }
  };

  // ============================
  // Google OAuth
  // ============================
  const signInWithGoogle: AuthContextType['signInWithGoogle'] = async () => {
    try {
      // Gateway -> Auth service 
      const resp = await fetch(`${AUTH_BASE}/google/login`, {
        credentials: 'include',
      });

      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return { success: false, error: 'Unexpected response from Google login' };
      }

      const data = await resp.json();
      if (data.auth_url) {
        window.location.href = data.auth_url; // Redirect to Google
        return { success: true };
      }

      return { success: false, error: 'Google auth URL missing' };

    } catch (e) {
      console.error('Google login error:', e);
      return { success: false, error: 'Network error during Google login' };
    }
  };

  // ============================
  // Reset password (future)
  // ============================
  const resetPassword: AuthContextType['resetPassword'] = async (email) => {
    return { success: true };
  };

  // ============================
  // Logout
  // ============================
  const signOut = async () => {
    try {
      await fetch(`${AUTH_BASE}/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      console.warn('Logout request failed:', e);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        signUp,
        signIn,
        resetPassword,
        signOut,
        signInWithGoogle
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
