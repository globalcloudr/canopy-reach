"use client";

import { useEffect, useState } from "react";

export const ACTIVE_ORG_KEY = "cr_active_org_id_v1";
const WORKSPACE_CHANGE_EVENT = "cr:workspace-change";

type WorkspaceChangeDetail = {
  workspaceId: string | null;
};

export function readStoredWorkspaceId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_ORG_KEY);
  } catch {
    return null;
  }
}

export function writeStoredWorkspaceId(workspaceId: string | null) {
  try {
    if (workspaceId) {
      window.localStorage.setItem(ACTIVE_ORG_KEY, workspaceId);
    } else {
      window.localStorage.removeItem(ACTIVE_ORG_KEY);
    }
  } catch {
    // Ignore storage failures and still notify listeners.
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<WorkspaceChangeDetail>(WORKSPACE_CHANGE_EVENT, {
        detail: { workspaceId },
      })
    );
  }
}

export function useReachWorkspaceId() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    setWorkspaceId(readStoredWorkspaceId());

    function handleWorkspaceChange(event: Event) {
      const detail = (event as CustomEvent<WorkspaceChangeDetail>).detail;
      setWorkspaceId(detail?.workspaceId ?? readStoredWorkspaceId());
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === ACTIVE_ORG_KEY) {
        setWorkspaceId(event.newValue);
      }
    }

    window.addEventListener(WORKSPACE_CHANGE_EVENT, handleWorkspaceChange as EventListener);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(WORKSPACE_CHANGE_EVENT, handleWorkspaceChange as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return workspaceId;
}
