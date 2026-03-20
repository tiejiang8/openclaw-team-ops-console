import type { ReactNode } from "react";

import { useI18n } from "../lib/i18n.js";

interface DataStateProps {
  loading: boolean;
  error: string | null;
  children: ReactNode;
  isEmpty?: boolean | undefined;
  loadingMessage?: string | undefined;
  errorTitle?: string | undefined;
  emptyTitle?: string | undefined;
  emptyMessage?: string | undefined;
  onRetry?: (() => void) | undefined;
  preserveChildrenOnError?: boolean | undefined;
  staleWarning?: string | null | undefined;
}

export function DataState({
  loading,
  error,
  children,
  isEmpty = false,
  loadingMessage = "Loading inventory data...",
  errorTitle = "Request failed",
  emptyTitle = "No data found",
  emptyMessage = "Try adjusting filters or search criteria.",
  onRetry,
  preserveChildrenOnError = false,
  staleWarning,
}: DataStateProps) {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="state-box">
        <p className="state-title">{t("state.loadingTitle")}</p>
        <p className="state-message">{loadingMessage === "Loading inventory data..." ? t("state.loadingMessage") : loadingMessage}</p>
      </div>
    );
  }

  if (error) {
    if (preserveChildrenOnError) {
      return (
        <>
          <div className="state-box state-box-warning">
            <p className="state-title">{t("state.staleTitle")}</p>
            <p className="state-message">{staleWarning ?? t("state.staleMessage")}</p>
            {onRetry ? (
              <button type="button" className="state-retry-button" onClick={onRetry}>
                {t("state.retry")}
              </button>
            ) : null}
          </div>
          {children}
        </>
      );
    }

    return (
      <div className="state-box state-box-error">
        <p className="state-title">{errorTitle === "Request failed" ? t("state.errorTitle") : errorTitle}</p>
        <p className="state-message">{error}</p>
        {onRetry ? (
          <button type="button" className="state-retry-button" onClick={onRetry}>
            {t("state.retry")}
          </button>
        ) : null}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="state-box">
        <p className="state-title">{emptyTitle === "No data found" ? t("state.emptyTitle") : emptyTitle}</p>
        <p className="state-message">{emptyMessage === "Try adjusting filters or search criteria." ? t("state.emptyMessage") : emptyMessage}</p>
      </div>
    );
  }

  return <>{children}</>;
}
