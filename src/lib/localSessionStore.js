const DB_NAME = "psilabs_sessions";
const DB_VERSION = 1;
const SESSION_STORE = "sessions";
const TRIAL_STORE = "trials";

function isIndexedDBAvailable() {
  return typeof indexedDB !== "undefined";
}

function openLocalSessionDb() {
  if (!isIndexedDBAvailable()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE, { keyPath: "session_id" });
      }

      if (!db.objectStoreNames.contains(TRIAL_STORE)) {
        const trialStore = db.createObjectStore(TRIAL_STORE, { keyPath: ["session_id", "trial_index"] });
        trialStore.createIndex("session_id", "session_id", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runStoreOperation(storeName, mode, operation) {
  return openLocalSessionDb().then((db) => {
    if (!db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = operation(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => db.close();
      transaction.onabort = () => {
        db.close();
        reject(transaction.error);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  });
}

export async function startLocalSession({ sessionId, startedAt }) {
  if (!sessionId) {
    return null;
  }

  const now = new Date().toISOString();
  const session = {
    session_id: sessionId,
    started_at: startedAt || now,
    updated_at: now,
    status: "in_progress",
  };

  return runStoreOperation(SESSION_STORE, "readwrite", (store) => store.put(session));
}

export async function appendTrialToIndexedDB(sessionId, slotResult, trialIndex) {
  if (!sessionId || !slotResult || !Number.isFinite(trialIndex)) {
    return null;
  }

  const record = {
    session_id: sessionId,
    trial_index: trialIndex,
    slotResult,
    saved_at: new Date().toISOString(),
  };

  return runStoreOperation(TRIAL_STORE, "readwrite", (store) => store.put(record));
}

export async function markLocalSessionCompleted(sessionId, endedAt = new Date().toISOString()) {
  if (!sessionId) {
    return null;
  }

  const existingSession = await runStoreOperation(SESSION_STORE, "readonly", (store) => store.get(sessionId));
  const session = {
    ...(existingSession || {}),
    session_id: sessionId,
    started_at: existingSession?.started_at || null,
    ended_at: endedAt,
    updated_at: endedAt,
    status: "completed",
  };

  return runStoreOperation(SESSION_STORE, "readwrite", (store) => store.put(session));
}

export async function getInProgressSession(sessionId) {
  if (!sessionId) {
    return null;
  }

  const session = await runStoreOperation(SESSION_STORE, "readonly", (store) => store.get(sessionId));
  if (!session || session.status !== "in_progress") {
    return null;
  }

  const trials = await runStoreOperation(TRIAL_STORE, "readonly", (store) => {
    const index = store.index("session_id");
    return index.getAll(sessionId);
  });

  return {
    session,
    trials: (trials || []).sort((left, right) => left.trial_index - right.trial_index),
  };
}
