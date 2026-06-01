import React from "react";
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.hash = "#/dashboard";
    window.location.reload();
  };

  handleGoBack = () => {
    this.setState({ hasError: false, error: null });
    window.history.back();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-[2rem] flex items-center justify-center mb-5 border border-red-100 dark:border-red-900">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-1">
            Something went wrong
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8 max-w-md">
            {this.state.error?.message || "This section encountered an unexpected error"}
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
            <button
              onClick={this.handleGoBack}
              className="flex items-center gap-2 px-5 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Go Back
            </button>
            <button
              onClick={this.handleGoHome}
              className="flex items-center gap-2 px-5 py-2.5 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-xl text-sm font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <Home className="w-4 h-4" /> Home
            </button>
          </div>
          <details className="mt-6 text-left w-full max-w-lg">
            <summary className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest cursor-pointer hover:text-zinc-600 transition-colors">
              Error Details
            </summary>
            <pre className="mt-2 text-[11px] text-red-500 bg-red-50 dark:bg-red-950/30 p-4 rounded-2xl overflow-auto max-h-32 border border-red-100 dark:border-red-900 font-mono">
              {this.state.error?.stack || this.state.error?.message || "No details available"}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
