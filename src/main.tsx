import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "react-oidc-context";
import { OIDC_CONFIG } from "./settings/oidc-config.ts";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider {...OIDC_CONFIG}>
      <App />
    </AuthProvider>
  </StrictMode>,
);
