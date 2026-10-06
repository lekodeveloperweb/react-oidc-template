import { lazy, Suspense, useEffect } from "react";
import "./App.css";
import { BrowserRouter, useLocation, useRoutes } from "react-router-dom";
import { Toaster } from "sonner";
import { useTheme, applyTheme } from "./stores/theme.store";
import logo from "@/assets/vite.svg";
import { useAuth, withAuthenticationRequired } from "react-oidc-context";

// Get the base path from Vite env or fall back to '/'
const getBasePath = (): string => {
  return import.meta.env.VITE_APP_PATH_PREFIX || "/";
};

const PAGE_TITLES: Record<string, string> = {
  "/": "React OIDC Template",
};

const Home = lazy(() => import("./pages/Home"));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-100">
      <div className="flex flex-col items-center gap-4">
        <img src={logo} alt="React OIDC Template Logo" className="h-40 w-48" />
        <span className="text-muted-foreground text-2xl animate-pulse">
          Loading…
        </span>
      </div>
    </div>
  );
}

function Routes() {
  return useRoutes([{ path: "/", element: <Home /> }]);
}

function Layout() {
  const location = useLocation();

  useEffect(() => {
    document.title = PAGE_TITLES[location.pathname] || "React OIDC template";
  }, [location.pathname]);

  return (
    <div>
      <main
        id="main-content"
        className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 focus:outline-none focus-visible:outline-none"
        tabIndex={-1}
      >
        <Suspense fallback={<LoadingFallback />}>
          <Routes />
        </Suspense>
      </main>
    </div>
  );
}

function AuthWrapper() {
  const auth = useAuth();
  const { theme } = useTheme();

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Clean URL query params after authentication (must be called unconditionally)
  useEffect(() => {
    if (auth.isLoading || auth.error || !auth.isAuthenticated) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("state");
    url.searchParams.delete("session_state");
    url.searchParams.delete("iss");
    url.searchParams.delete("code");
    window.history.replaceState({}, document.title, url.toString());
  }, [auth.isLoading, auth.error, auth.isAuthenticated]);

  if (auth.isLoading) {
    return (
      <div className="flex flex-col h-screen items-center justify-center">
        <img src={logo} alt="IWT Conscious Spending Logo" className="h-40" />
        <p>Loading...</p>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <img src={logo} alt="IWT Conscious Spending Logo" className="h-40" />
        <div>Oops... {auth.error.message}</div>;
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <img src={logo} alt="IWT Conscious Spending Logo" className="h-40" />
        <button
          onClick={() => auth.signinRedirect()}
          className="rounded bg-primary px-4 py-2 text-primary-foreground"
        >
          Log in
        </button>
      </div>
    );
  }

  return (
    <BrowserRouter basename={getBasePath()}>
      <a
        href={`${getBasePath()}#main-content`}
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:ring-2 focus:ring-ring rounded-md"
      >
        Skip to main content
      </a>
      <Toaster richColors position="top-right" />
      <Layout />
    </BrowserRouter>
  );
}

export default withAuthenticationRequired(AuthWrapper, {
  onBeforeSignin() {
    console.log("Redirecting to login page...");
  },
  OnRedirecting: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center space-y-4 p-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">Redirecting to login...</h2>
            <p className="text-sm text-muted-foreground">
              Please wait while we're verifying your credentials.
            </p>
          </div>
        </div>
      </div>
    </div>
  ),
});
