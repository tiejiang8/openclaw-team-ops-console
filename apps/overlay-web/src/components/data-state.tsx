import type { ReactNode } from "react";

interface DataStateProps {
  loading: boolean;
  error: string | null;
  children: ReactNode;
  isEmpty?: boolean;
  loadingMessage?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  onRetry?: () => void;
}

export function DataState({
  loading,
  error,
  children,
  isEmpty = false,
  loadingMessage = "Loading inventory data...",
  emptyTitle = "No data found",
  emptyMessage = "Try adjusting filters or search criteria.",
  onRetry,
}: DataStateProps) {
  if (loading) {
    return (
      <div className="state-box">
        <p className="state-title">Loading</p>
        <p className="state-message">{loadingMessage}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="state-box state-box-error">
        <p className="state-title">Request failed</p>
        <p className="state-message">{error}</p>
        {onRetry ? (
          <button type="button" className="state-retry-button" onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="state-box">
        <p className="state-title">{emptyTitle}</p>
        <p className="state-message">{emptyMessage}</p>
      </div>
    );
  }

  return <>{children}</>;
}
