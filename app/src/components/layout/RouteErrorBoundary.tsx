import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../ui/Button';

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[RouteErrorBoundary]', error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-lg font-semibold text-[#012b54]">This page did not load correctly</p>
          <p className="mt-2 max-w-md text-sm text-[#64748b]">
            A temporary navigation error occurred. Reload to continue — your passport and account stay saved.
          </p>
          <Button className="mt-6" onClick={this.handleRetry}>
            Reload page
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
