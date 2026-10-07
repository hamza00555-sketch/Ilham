"use client";

import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithCredential,
  signInWithEmailLink,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { firebase, usingEmulators } from "./firebase/client";

interface AuthState {
  user: User | null;
  ready: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, ready: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, ready: false });

  useEffect(() => {
    const { auth } = firebase();
    if (usingEmulators) exposeEmulatorSignIn();
    return onAuthStateChanged(auth, (user) => setState({ user, ready: true }));
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Signed-in user's uid. Only call inside the authenticated shell. */
export function useUid(): string {
  const { user } = useAuth();
  if (!user) throw new Error("useUid() used outside the signed-in shell");
  return user.uid;
}

export async function signInWithGoogle() {
  const { auth } = firebase();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, provider);
      return;
    }
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
    throw err;
  }
}

const EMAIL_KEY = "ilham:emailForSignIn";

export async function sendEmailLink(email: string) {
  const { auth } = firebase();
  await sendSignInLinkToEmail(auth, email, {
    url: `${window.location.origin}/auth/finish`,
    handleCodeInApp: true,
  });
  try {
    window.localStorage.setItem(EMAIL_KEY, email);
  } catch {
    // Private mode: the finish page asks for the email again.
  }
}

export function isEmailLink(href: string) {
  return isSignInWithEmailLink(firebase().auth, href);
}

export function storedEmail(): string | null {
  try {
    return window.localStorage.getItem(EMAIL_KEY);
  } catch {
    return null;
  }
}

export async function finishEmailLink(email: string, href: string) {
  await signInWithEmailLink(firebase().auth, email, href);
  try {
    window.localStorage.removeItem(EMAIL_KEY);
  } catch {
    // ignore
  }
}

export const signOut = () => firebaseSignOut(firebase().auth);

/** Emulator only: lets tests sign in as any Google user without a popup. */
function exposeEmulatorSignIn() {
  (window as unknown as Record<string, unknown>).__ilhamEmulatorSignIn = (email: string) =>
    signInWithCredential(
      firebase().auth,
      GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true, name: email.split("@")[0] })),
    );
}
