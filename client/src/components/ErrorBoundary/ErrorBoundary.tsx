import React from 'react';
import { telemetryApi } from '../../services/api';
import type { ErrorBoundaryProps, ErrorBoundaryState } from './types';
import styles from './ErrorBoundary.module.css';

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    telemetryApi.track({
      type: 'error',
      errorMessage: error.message,
      component: this.props.component ?? 'Unknown',
      timestamp: new Date().toISOString(),
      sessionId: '',
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div role="alert" className={styles.fallback}>
          <h2>Something went wrong.</h2>
          <button onClick={() => this.setState({ hasError: false })}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
