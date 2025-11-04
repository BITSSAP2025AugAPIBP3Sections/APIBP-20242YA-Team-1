import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
const AUTH_SERVICE_URL = import.meta.env.VITE_AUTH_SERVICE_URL;

// Simple user shape
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

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const resp = await fetch(`${AUTH_SERVICE_URL}/auth/me`, {
          credentials: 'include', // sends cookies
        });
        const data = await resp.json();
        if (data.isAuthenticated && data.user) {
          setUser(data.user)
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

  const signUp: AuthContextType['signUp'] = async (email, password, fullName) => {
    setIsLoading(true);
    setError(null);
    try {
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

      if (data.user) {
        setUser(data.user);
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

      if (data.user) {
        setUser(data.user);
      } 

      return { success: true };
    } catch (e) {
      const err = 'Login failed';
      setError(err);
      return { success: false, error: err };
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle: AuthContextType['signInWithGoogle'] = async () => {
    try {
      const response = await fetch(`${AUTH_SERVICE_URL}/auth/login`, {
        credentials: "include",
      });
  
      const data = await response.json();
  
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

  const resetPassword: AuthContextType['resetPassword'] = async (email) => {
    return { success: true }; 
  };

  const signOut = async () => {
    try {
      await fetch(`${AUTH_SERVICE_URL}/auth/logout`, {
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
