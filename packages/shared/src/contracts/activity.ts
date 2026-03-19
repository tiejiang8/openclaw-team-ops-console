export type ActivityEventType = "cron" | "node" | "session" | "log" | "finding" | "bootstrap";
export type ActivityEventSeverity = "info" | "warn" | "error" | "critical";

export interface ActivityEventDto {
  id: string;
  timestamp: string;
  type: ActivityEventType;
  severity: ActivityEventSeverity;
  message: string;
  subjectId?: string;
  subjectType?: string;
  targetId?: string;
  details?: Record<string, string | number | boolean | null>;
}

export interface ActivityResponse {
  data: ActivityEventDto[];
  meta: {
    generatedAt: string;
    total: number;
    filters: Record<string, string | undefined>;
  };
}
