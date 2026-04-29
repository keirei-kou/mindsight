const GOOGLE_IDENTITY_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email";

let googleScriptPromise = null;

function getGoogleClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
}

function getGoogleSheetsScope() {
  const customScope = import.meta.env.VITE_GOOGLE_SHEETS_SCOPE;
  return customScope || GOOGLE_SHEETS_SCOPE;
}

function getOAuthDebugSnapshot({ clientId, prompt }) {
  const browserOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const browserHref = typeof window !== "undefined" ? window.location.href : "";

  return {
    flow: "google_identity_services_token_client",
    client_id: clientId,
    origin: browserOrigin,
    redirect_uri: "(not set by app; Google Identity Services token flow manages the popup redirect)",
    scope: getGoogleSheetsScope(),
    prompt,
    href: browserHref,
    expected_production_origin: "https://psilabs.app",
    expected_production_app_callback: "not used by this Connect with Google flow",
    expected_supabase_callback: "not used by this Connect with Google flow",
  };
}

function logOAuthDebugSnapshot(label, snapshot) {
  console.groupCollapsed(`[PsiLabs Google OAuth Debug] ${label}`);
  console.table(snapshot);
  console.log("client_id:", snapshot.client_id);
  console.log("origin:", snapshot.origin);
  console.log("redirect_uri:", snapshot.redirect_uri);
  console.log("scope:", snapshot.scope);
  console.log("prompt:", snapshot.prompt);
  console.log("href:", snapshot.href);
  console.log("Expected production origin:", snapshot.expected_production_origin);
  console.log("Expected production app callback:", snapshot.expected_production_app_callback);
  console.log("Expected Supabase callback:", snapshot.expected_supabase_callback);
  console.groupEnd();
}

function logOAuthUrl(url) {
  console.groupCollapsed("[PsiLabs Google OAuth Debug] OAuth popup URL");
  console.log("url:", url);

  try {
    const parsedUrl = new URL(url, window.location.href);
    const params = Object.fromEntries(parsedUrl.searchParams.entries());
    console.table({
      origin: window.location.origin,
      client_id: params.client_id || "(missing from URL)",
      redirect_uri: params.redirect_uri || "(missing from URL)",
      scope: params.scope || "(missing from URL)",
      response_type: params.response_type || "(missing from URL)",
      prompt: params.prompt || "(missing from URL)",
    });
  } catch (error) {
    console.warn("[PsiLabs Google OAuth Debug] Unable to parse OAuth popup URL.", error);
  }

  console.groupEnd();
}

function installOAuthPopupUrlLogger() {
  if (typeof window === "undefined" || typeof window.open !== "function") {
    return () => {};
  }

  const originalOpen = window.open;

  window.open = function openWithOAuthDebug(url, target, features) {
    if (typeof url === "string" && url.includes("accounts.google.com")) {
      logOAuthUrl(url);
    }

    return originalOpen.call(window, url, target, features);
  };

  return () => {
    window.open = originalOpen;
  };
}

export function isGoogleAuthConfigured() {
  return Boolean(getGoogleClientId());
}

export function loadGoogleIdentityScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google sign-in is only available in the browser."));
  }

  if (window.google?.accounts?.oauth2) {
    return Promise.resolve(window.google);
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${GOOGLE_IDENTITY_SCRIPT_SRC}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.google), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Unable to load Google's sign-in script.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Unable to load Google's sign-in script."));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

async function fetchGoogleUserProfile(accessToken) {
  if (!accessToken) {
    return {
      accountId: "",
      accountEmail: "",
    };
  }

  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return {
      accountId: "",
      accountEmail: "",
    };
  }

  const profile = await response.json();
  return {
    accountId: profile?.sub || "",
    accountEmail: profile?.email || "",
  };
}

export async function requestGoogleAccessToken({ prompt = "consent" } = {}) {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error("Google sign-in is not configured. Add VITE_GOOGLE_CLIENT_ID to your environment.");
  }

  const debugSnapshot = getOAuthDebugSnapshot({ clientId, prompt });
  logOAuthDebugSnapshot("before loading Google Identity Services", debugSnapshot);

  const google = await loadGoogleIdentityScript();

  return new Promise((resolve, reject) => {
    logOAuthDebugSnapshot("initTokenClient config", debugSnapshot);

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: getGoogleSheetsScope(),
      callback: async (response) => {
        if (response?.error) {
          console.error("[PsiLabs Google OAuth Debug] OAuth callback error response:", response);
          reject(new Error(response.error));
          return;
        }

        try {
          const userProfile = await fetchGoogleUserProfile(response.access_token);

          resolve({
            accessToken: response.access_token,
            expiresIn: response.expires_in,
            scope: response.scope,
            tokenType: response.token_type,
            issuedAt: new Date().toISOString(),
            ...userProfile,
          });
        } catch (error) {
          console.error("[PsiLabs Google OAuth Debug] Unable to read Google profile after OAuth.", error);
          reject(new Error(error?.message || "Unable to read the connected Google account."));
        }
      },
      error_callback: (error) => {
        console.error("[PsiLabs Google OAuth Debug] OAuth error callback:", {
          ...debugSnapshot,
          error,
        });
        reject(new Error(error?.message || "Google sign-in was cancelled or blocked."));
      },
    });

    const restoreOpen = installOAuthPopupUrlLogger();
    logOAuthDebugSnapshot("requestAccessToken call", debugSnapshot);
    tokenClient.requestAccessToken({ prompt });
    window.setTimeout(restoreOpen, 2000);
  });
}

export async function revokeGoogleAccessToken(accessToken) {
  if (!accessToken) {
    return;
  }

  const google = await loadGoogleIdentityScript();

  await new Promise((resolve) => {
    google.accounts.oauth2.revoke(accessToken, () => resolve());
  });
}
