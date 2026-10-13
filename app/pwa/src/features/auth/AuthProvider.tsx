"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { refreshClaims, signOut, watchAuth } from "./api";
import { SignInDialog } from "./components/SignInDialog";

interface AuthContextValue {
  user: User | null;
  isAdmin: boolean;
  /** True until Firebase has restored (or ruled out) a saved session. */
  isLoading: boolean;
  /** Opens the sign-in dialog; the emailed link brings the customer back to `returnTo`. */
  openSignIn: (returnTo?: string) => void;
  signOut: () => Promise<void>;
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [signInReturnTo, setSignInReturnTo] = useState<string | null>(null);

  useEffect(
    () =>
      watchAuth((snapshot) => {
        setUser(snapshot.user);
        setIsAdmin(snapshot.isAdmin);
        setIsLoading(false);
      }),
    [],
  );

  const openSignIn = useCallback((returnTo?: string) => {
    setSignInReturnTo(returnTo ?? window.location.pathname + window.location.search);
  }, []);

  const closeSignIn = useCallback(() => setSignInReturnTo(null), []);

  const value = useMemo(
    () => ({ user, isAdmin, isLoading, openSignIn, signOut, refreshClaims }),
    [user, isAdmin, isLoading, openSignIn],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SignInDialog open={signInReturnTo !== null} returnTo={signInReturnTo ?? "/account"} onClose={closeSignIn} />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
