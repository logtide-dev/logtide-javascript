import React from 'react';
import { hub } from '@logtide/core';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode | ((error: Error) => React.ReactNode);
}

interface State {
  error: Error | null;
}

/**
 * React ErrorBoundary that automatically reports errors to LogTide.
 *
 * @example
 * ```tsx
 * import { LogtideErrorBoundary } from '@logtide/nextjs/client';
 *
 * <LogtideErrorBoundary fallback={<div>Something went wrong</div>}>
 *   <App />
 * </LogtideErrorBoundary>
 * ```
 */
export class LogtideErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    hub.captureError(error, {
      mechanism: 'react.error-boundary',
      componentStack: info.componentStack ?? undefined,
    });
  }

  render(): React.ReactNode {
    if (this.state.error) {
      const { fallback } = this.props;
      if (typeof fallback === 'function') {
        return fallback(this.state.error);
      }
      return fallback ?? null;
    }
    return this.props.children;
  }
}
