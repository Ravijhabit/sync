import type React from 'react';

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode | undefined;
  component?: string | undefined;
}

export interface ErrorBoundaryState {
  hasError: boolean;
}
