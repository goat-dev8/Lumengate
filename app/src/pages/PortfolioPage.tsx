import { Navigate } from 'react-router-dom';

/** Portfolio holdings live on the dashboard — this route preserves legacy links. */
export function PortfolioPage() {
  return <Navigate to="/app/home#holdings" replace />;
}
