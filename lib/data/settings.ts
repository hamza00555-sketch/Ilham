"use client";

import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { AgentSettings } from "@/shared/types";
import { firebase } from "../firebase/client";

const agentDoc = (uid: string) => doc(firebase().db, "users", uid, "settings", "agent");

/** Account-wide agent preferences, live. Defaults (review on) until the doc exists. */
export function useAgentSettings(uid: string): AgentSettings | undefined {
  const [settings, setSettings] = useState<AgentSettings>();
  useEffect(
    () =>
      onSnapshot(
        agentDoc(uid),
        (snap) => setSettings({ review: (snap.data() as Partial<AgentSettings> | undefined)?.review ?? true }),
        () => setSettings({ review: true }),
      ),
    [uid],
  );
  return settings;
}

export function setAgentReview(uid: string, review: boolean) {
  return setDoc(agentDoc(uid), { review }, { merge: true });
}
