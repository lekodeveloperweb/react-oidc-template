import { WebStorageStateStore } from "oidc-client-ts";

// Resolve OIDC values from the environment at runtime (instead of letting
// Vite statically inline `import.meta.env.VITE_*` into literals). Reading the
// env object through this reference keeps the source mockable in tests via a
// runtime redefine of `import.meta.env`.
const env = import.meta.env;
const OIDC_AUTHORITY = `${env.VITE_OIDC_AUTHORITY ?? ""}`;
const OIDC_CLIENT_ID = `${env.VITE_OIDC_CLIENT_ID ?? ""}`;
const OIDC_AUDIENCE = `${env.VITE_OIDC_AUDIENCE ?? ""}`;

export const OIDC_CONFIG = {
  authority: OIDC_AUTHORITY,
  client_id: OIDC_CLIENT_ID,
  redirect_uri: window.location.origin + env.BASE_URL,
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
  scope: "openid profile email",
  audience: OIDC_AUDIENCE,
  response_type: "code",
  automaticSilentRenew: true,
  loadUserInfo: true,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  disablePKCE: !env.PROD, // Disable PKCE in production for compatibility
};

// Warn instead of throwing: the config above already falls back to empty
// strings, and a module-load throw made the module impossible to import in
// tests (or anywhere the env is not configured). The real failure surfaces
// when an unauthenticated request is made against the auth server.
(() => {
  if (!OIDC_AUTHORITY || !OIDC_CLIENT_ID || !OIDC_AUDIENCE)
    console.error("[oidc-config]: missing environment variable");
})();
