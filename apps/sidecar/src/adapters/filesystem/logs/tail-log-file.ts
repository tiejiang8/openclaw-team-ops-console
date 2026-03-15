export interface TailResult<T> {
  items: T[];
  startIndex: number;
}

export function tailLogFile<T>(items: T[], limit: number): TailResult<T> {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : 200;
  const startIndex = Math.max(0, items.length - safeLimit);

  return {
    items: items.slice(startIndex),
    startIndex,
  };
}
