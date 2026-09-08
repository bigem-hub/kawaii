import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

/**
 * Catches render errors anywhere below it and shows a friendly fallback
 * instead of a blank white screen.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : undefined };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleReload = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center" role="alert">
          <div className="text-6xl">😵</div>
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-[var(--text-muted)] max-w-sm text-sm">
            {this.state.message || "An unexpected error occurred while rendering this page."}
          </p>
          <div className="flex gap-3 mt-2">
            <button className="btn-secondary" onClick={() => window.location.reload()}>
              Reload page
            </button>
            <button className="btn-primary" onClick={this.handleReload}>
              Go home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}