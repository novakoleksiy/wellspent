import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import RecommendPage from "./pages/RecommendPage";
import RegisterPage from "./pages/RegisterPage";
import SettingsPage from "./pages/SettingsPage";
import TripsPage from "./pages/DashboardPage";
import TripDetailPage from "./pages/TripDetailPage";
import { hasCompletedOnboarding } from "./preferences";

function isOnboarded(preferences: Record<string, unknown> | null | undefined) {
  return hasCompletedOnboarding(preferences);
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isOnboarded(user.preferences)) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function OnboardingOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (isOnboarded(user.preferences)) return <Navigate to="/trips" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    return <Navigate to={isOnboarded(user.preferences) ? "/trips" : "/onboarding"} replace />;
  }
  return <>{children}</>;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={isOnboarded(user.preferences) ? "/trips" : "/onboarding"} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/onboarding" element={<OnboardingOnly><OnboardingPage /></OnboardingOnly>} />
          <Route path="/recommend" element={<RequireAuth><RequireOnboarding><RecommendPage /></RequireOnboarding></RequireAuth>} />
          <Route path="/trips" element={<RequireAuth><RequireOnboarding><TripsPage /></RequireOnboarding></RequireAuth>} />
          <Route path="/trips/:id" element={<RequireAuth><RequireOnboarding><TripDetailPage /></RequireOnboarding></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><RequireOnboarding><SettingsPage /></RequireOnboarding></RequireAuth>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
