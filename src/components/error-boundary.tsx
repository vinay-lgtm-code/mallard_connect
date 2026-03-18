"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="bg-white rounded-[12px] p-8 shadow-sm border border-gray-100 text-center">
      <div className="flex justify-center mb-4">
        <AlertTriangle className="text-destructive" size={48} strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-semibold text-gray-900">Something went wrong</h3>
      {error?.message && (
        <p className="text-sm text-gray-500 mt-1.5 max-w-sm mx-auto font-mono break-words">
          {error.message}
        </p>
      )}
      <div className="mt-5">
        <button
          onClick={resetErrorBoundary}
          className="inline-flex items-center justify-center bg-primary text-white font-semibold py-2.5 px-5 rounded-lg text-sm hover:bg-primary-dark transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, info.componentStack);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <ErrorFallback
          error={this.state.error ?? new Error("Unknown error")}
          resetErrorBoundary={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}
