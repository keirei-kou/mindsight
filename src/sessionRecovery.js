const RECOVERY_STORAGE_KEY = "mindsight.interruptedSession.v1";

function isStorageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function persistInterruptedSession(snapshot) {
  if (!isStorageAvailable()) {
    return;
  }

  if (!snapshot || typeof snapshot !== "object") {
    return;
  }

  try {
    window.localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    // Ignore persistence failures (storage quota / privacy mode).
  }
}

export function restoreInterruptedSession() {
  if (!isStorageAvailable()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(RECOVERY_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    return null;
  }
}

export function clearInterruptedSession() {
  if (!isStorageAvailable()) {
    return;
  }

  try {
    window.localStorage.removeItem(RECOVERY_STORAGE_KEY);
  } catch (error) {
    // Ignore.
  }
}

