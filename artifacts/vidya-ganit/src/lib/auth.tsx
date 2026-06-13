import { createContext, useContext, useState, useEffect } from "react";
import type { UserProfile } from "@workspace/api-client-react";

const STORAGE_KEY = "vidyaganit_user";

interface AuthContextValue {
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  setUser: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as UserProfile) : null;
    } catch {
      return null;
    }
  });

  const setUser = (u: UserProfile | null) => {
    setUserState(u);
    if (u) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const logout = () => setUser(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setUserState(JSON.parse(stored) as UserProfile);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
