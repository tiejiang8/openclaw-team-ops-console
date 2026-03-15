import { readFile } from "node:fs/promises";

import type { LogFile } from "@openclaw-team-ops/shared";

export interface ReadLogFileResult {
  content: string;
  lines: string[];
}

export async function readLogFile(file: LogFile): Promise<ReadLogFileResult> {
  const content = await readFile(file.path, "utf8");
  const lines = content.length === 0 ? [] : content.split(/\r?\n/).filter((line, index, array) => !(index === array.length - 1 && line === ""));

  return {
    content,
    lines,
  };
}
