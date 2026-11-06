import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

export interface PipelineCache {
  version: 1;
  audio: Record<string, string>;
  clips: Record<string, string>;
  voice?: string;
  video?: string;
}

export const CACHE_VERSION = 1;

export async function loadPipelineCache(path: string): Promise<PipelineCache> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<PipelineCache>;
    if (
      parsed.version !== CACHE_VERSION ||
      typeof parsed.audio !== "object" ||
      typeof parsed.clips !== "object"
    ) {
      throw new Error(`Unsupported pipeline cache format at ${path}`);
    }
    return {
      version: CACHE_VERSION,
      audio: parsed.audio as Record<string, string>,
      clips: parsed.clips as Record<string, string>,
      voice: parsed.voice,
      video: parsed.video,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: CACHE_VERSION, audio: {}, clips: {} };
    }
    throw new Error(`Invalid pipeline cache at ${path}`, { cause: error });
  }
}

export async function savePipelineCache(path: string, cache: PipelineCache): Promise<void> {
  await writeFile(path, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

export function fingerprint(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}
