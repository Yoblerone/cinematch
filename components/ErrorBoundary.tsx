'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Cinematch error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-screen bg-cherry-950 flex flex-col items-center justify-center p-6 border-2 border-double border-brass/80">
          <div className="max-w-md w-full rounded-xl border-2 border-brass/50 bg-cherry-900 p-6">
            <h1 className="text-xl font-display font-semibold text-neon-gold mb-2">
              Something went wrong
            </h1>
            <p className="text-cream text-sm mb-3">
              The page hit an error. Try refreshing. If it keeps happening, check the browser console for details.
            </p>
            <pre className="text-xs text-cream/80 bg-cherry-950 p-3 rounded overflow-auto max-h-32">
              {this.state.error.message}
            </pre>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 px-4 py-2 rounded-lg border-2 border-brass/50 text-brass-light hover:border-brass hover:bg-brass/10 text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
