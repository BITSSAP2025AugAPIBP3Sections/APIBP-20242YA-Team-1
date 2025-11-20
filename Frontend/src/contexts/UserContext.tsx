import React, { createContext, useContext, useState, useEffect } from "react";
import { getUserSyncStatus } from "../services/api";

interface UserContextValue {
  userId: string;
  email?: string;
  hasGoogleConnection?: boolean;
  loading: boolean;
  error?: string;
  setUserId: (id: string) => void;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export const UserProvider: React.FC<{ initialUserId?: string; children: React.ReactNode }> = ({ initialUserId = "", children }) => {
  const [userId, setUserId] = useState(initialUserId || (typeof window !== 'undefined' ? localStorage.getItem('vendorIQ_userId') || "" : ""));
  const [email, setEmail] = useState<string | undefined>();
  const [hasGoogleConnection, setHasGoogleConnection] = useState<boolean | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const fetchStatus = async () => {
      if (!userId) return;
      setLoading(true); setError(undefined);
      try {
        const { data, response } = await getUserSyncStatus(userId);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setEmail(data.email);
        setHasGoogleConnection(data.hasGoogleConnection);
        if (typeof window !== 'undefined') localStorage.setItem('vendorIQ_userId', userId);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, [userId]);

  const value: UserContextValue = {
    userId,
    email,
    hasGoogleConnection,
    loading,
    error,
    setUserId,
  };
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = (): UserContextValue => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
};
