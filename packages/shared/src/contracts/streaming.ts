export type StreamingEventType = 
  | "bootstrap_status" 
  | "cron_job" 
  | "node_status" 
  | "activity" 
  | "heartbeat";

export interface StreamingEventDto<T = any> {
  type: StreamingEventType;
  timestamp: string;
  data: T;
}
