import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { getDurationSec } from "../assets/audio-tools.js";

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let out = "", err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${cmd} failed (exit ${code}): ${err.slice(-800)}`)),
    );
    proc.on("error", reject);
  });
}

/** Common encode flags so every fitted clip is concat-compatible (same codec). */
const ENCODE = (fps: number) => [
  "-an",
  "-c:v", "libx264",
  "-preset", "medium",
  "-crf", "18",
  "-pix_fmt", "yuv420p",
  "-r", String(fps),
];

/**
 * Re-encode `inPath` to exactly `targetSec` seconds (video only):
 * - longer target → freeze the last frame (tpad clone) to fill the remainder,
 *   so a 5s poster animation holds while the scene's narration continues;
 * - shorter target → trim. Output is normalized for concat.
 */
export async function fitClipToDuration(
  inPath: string,
  targetSec: number,
  outPath: string,
  fps = 30,
): Promise<void> {
  const inDur = await getDurationSec(inPath);
  const target = Math.max(0.1, targetSec);
  const args = ["-y", "-i", inPath];
  if (target > inDur + 0.02) {
    const ext = target - inDur;
    args.push("-vf", `tpad=stop_mode=clone:stop_duration=${ext.toFixed(3)}`);
  }
  args.push("-t", target.toFixed(3), ...ENCODE(fps), outPath);
  await run("ffmpeg", args);
}

/** Concatenate clips into one continuous silent video with fresh timestamps. */
export async function concatVideos(clipPaths: string[], outPath: string): Promise<void> {
  if (clipPaths.length === 0) throw new Error("concatVideos: empty clipPaths");
  const inputs = clipPaths.flatMap((p) => ["-i", resolve(p)]);
  const labels = clipPaths.map((_, i) => `[${i}:v:0]`).join("");
  const filter = `${labels}concat=n=${clipPaths.length}:v=1:a=0[v]`;
  await run("ffmpeg", [
    "-y",
    ...inputs,
    "-filter_complex", filter,
    "-map", "[v]",
    ...ENCODE(30),
    "-movflags", "+faststart",
    outPath,
  ]);
}

/**
 * Mux an audio track onto a silent video. The video length wins (no -shortest),
 * so an outro visual hold past the end of narration is preserved as silent tail.
 */
export async function muxAudioOntoVideo(
  videoPath: string,
  audioPath: string,
  outPath: string,
): Promise<void> {
  await run("ffmpeg", [
    "-y",
    "-i", videoPath,
    "-i", audioPath,
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-c:v", "copy",
    "-af", "aresample=async=1:first_pts=0",
    "-c:a", "aac",
    "-b:a", "192k",
    "-disposition:a:0", "default",
    "-metadata:s:a:0", "language=vie",
    "-movflags", "+faststart",
    outPath,
  ]);
}
