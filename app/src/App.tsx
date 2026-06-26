import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { LandingPage } from './pages/LandingPage';

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((mod) => ({ default: mod.DashboardPage })),
);
const VerifyPage = lazy(() =>
  import('./pages/VerifyPage').then((mod) => ({ default: mod.VerifyPage })),
);
const TransferPage = lazy(() =>
  import('./pages/TransferPage').then((mod) => ({ default: mod.TransferPage })),
);
const AuditorPage = lazy(() =>
  import('./pages/AuditorPage').then((mod) => ({ default: mod.AuditorPage })),
);
const AdminPage = lazy(() =>
  import('./pages/AdminPage').then((mod) => ({ default: mod.AdminPage })),
);
const CompliancePage = lazy(() =>
  import('./pages/CompliancePage').then((mod) => ({ default: mod.CompliancePage })),
);
const MarketplacePage = lazy(() =>
  import('./pages/MarketplacePage').then((mod) => ({ default: mod.MarketplacePage })),
);
const PortfolioPage = lazy(() =>
  import('./pages/PortfolioPage').then((mod) => ({ default: mod.PortfolioPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((mod) => ({ default: mod.SettingsPage })),
);
const ActivityPage = lazy(() =>
  import('./pages/ActivityPage').then((mod) => ({ default: mod.ActivityPage })),
);
const OfferingDetailRoute = lazy(() =>
  import('./pages/OfferingDetailPage').then((mod) => ({ default: mod.OfferingDetailRoute })),
);

function RouteFallback() {
  return <div className="p-6 text-sm text-slate-muted">Loading…</div>;
}

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function AppRoutes() {
  const location = useLocation();
  return (
    <Routes location={location} key={location.pathname}>
      <Route path="/" element={<LandingPage />} />
      <Route path="/home" element={<Navigate to="/app/home" replace />} />
      <Route path="/passport" element={<Navigate to="/app/verify" replace />} />
      <Route path="/invest" element={<Navigate to="/app/marketplace" replace />} />
      <Route path="/send" element={<Navigate to="/app/send" replace />} />
      <Route path="/receipt" element={<Navigate to="/app/compliance" replace />} />
      <Route path="/audit" element={<Navigate to="/app/auditor" replace />} />
      <Route path="/operators" element={<Navigate to="/app/admin" replace />} />
      <Route path="/app" element={<Navigate to="/app/home" replace />} />
      <Route path="/app/home" element={<LazyRoute><DashboardPage /></LazyRoute>} />
      <Route path="/app/dashboard" element={<Navigate to="/app/home" replace />} />
      <Route path="/app/verify" element={<LazyRoute><VerifyPage /></LazyRoute>} />
      <Route path="/app/send" element={<LazyRoute><TransferPage /></LazyRoute>} />
      <Route
        path="/app/auditor"
        element={<LazyRoute><AuditorPage /></LazyRoute>}
      />
      <Route
        path="/app/admin"
        element={<LazyRoute><AdminPage /></LazyRoute>}
      />
      <Route path="/app/passport" element={<Navigate to="/app/verify" replace />} />
      <Route path="/app/marketplace" element={<LazyRoute><MarketplacePage /></LazyRoute>} />
      <Route path="/app/marketplace/:offeringId" element={<LazyRoute><OfferingDetailRoute /></LazyRoute>} />
      <Route path="/app/portfolio" element={<LazyRoute><PortfolioPage /></LazyRoute>} />
      <Route path="/app/compliance" element={<LazyRoute><CompliancePage /></LazyRoute>} />
      <Route path="/app/receipt" element={<Navigate to="/app/compliance" replace />} />
      <Route path="/app/activity" element={<LazyRoute><ActivityPage /></LazyRoute>} />
      <Route path="/app/settings" element={<LazyRoute><SettingsPage /></LazyRoute>} />
      <Route path="/app/credential" element={<Navigate to="/app/verify" replace />} />
      <Route path="/app/prove" element={<Navigate to="/app/verify" replace />} />
      <Route path="/app/transfer" element={<Navigate to="/app/send" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
