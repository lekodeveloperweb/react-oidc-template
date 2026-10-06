import { WebStorageStateStore } from "oidc-client-ts";

export const OIDC_AUTHORITY = `${import.meta.env.VITE_OIDC_AUTHORITY ?? ""}`;
export const OIDC_CLIENT_ID = `${import.meta.env.VITE_OIDC_CLIENT_ID ?? ""}`;
export const OIDC_AUDIENCE = `${import.meta.env.VITE_OIDC_AUDIENCE ?? ""}`;

export const OIDC_CONFIG = {
  authority: OIDC_AUTHORITY,
  client_id: OIDC_CLIENT_ID,
  redirect_uri: window.location.origin + import.meta.env.BASE_URL,
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
  scope: "openid profile email",
  audience: OIDC_AUDIENCE,
  response_type: "code",
  automaticSilentRenew: true,
  loadUserInfo: true,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  disablePKCE: !import.meta.env.PROD, // Disable PKCE in production for compatibility
};

(() => {
  if (!OIDC_AUTHORITY || !OIDC_CLIENT_ID || !OIDC_AUDIENCE)
    throw "[oidc-config]: missing environment variable";
})();
