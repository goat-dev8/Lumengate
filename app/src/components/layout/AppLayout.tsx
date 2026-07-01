import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { AppShell } from './Shell';
import { RouteErrorBoundary } from './RouteErrorBoundary';

function PageTransitionFallback() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded-lg bg-[var(--lg-muted-bg)]" />
        <div className="h-4 w-72 rounded bg-[var(--lg-muted-bg)]" />
        <div className="mt-8 h-64 rounded-2xl bg-[var(--lg-muted-bg)]" />
      </div>
    </div>
  );
}

export function AppLayout() {
  return (
    <AppShell>
      <RouteErrorBoundary>
        <Suspense fallback={<PageTransitionFallback />}>
          <Outlet />
        </Suspense>
      </RouteErrorBoundary>
    </AppShell>
  );
}
