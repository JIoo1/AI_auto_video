import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import pLimit from "p-limit";
import { TemplateScriptSchema, type TemplateScript } from "./template-script-schema.js";
import { loadConfig } from "../config.js";
import { createTtsClient } from "../tts/tts-client.js";
import {
  getDurationSec,
  concatWithSilence,
  mixSfxOntoVoice,
  type SfxMixSpec,
} from "../assets/audio-tools.js";
import { indexSfxLibrary, pickSfxForScene, defaultPlayback } from "../assets/sfx-selector.js";
import { composeTemplate } from "./template-composer.js";
import { fitClipToDuration, concatVideos, muxAudioOntoVideo } from "./video-tools.js";
import { log } from "../utils/logger.js";
import {
  fingerprint,
  loadPipelineCache,
  savePipelineCache,
} from "./pipeline-cache.js";

const TOTAL_STEPS = 8;
const SCENE_GAP_SEC = 0.3;
const OUTRO_HOLD_SEC = 3;
const RENDER_FPS = 30;

/** Maps a scene role to a key the SFX selector understands (tier-3 defaults). */
const TYPE_TO_SFX: Record<string, string> = {
  hook: "hook",
  body: "callout",
  outro: "outro",
};

async function getTemplateFingerprint(templateId: string, aspect: string): Promise<string> {
  const templateDir = resolve("templates", templateId);
  const files = [join(templateDir, "index.html")];
  if (aspect === "9:16") files.push(join(templateDir, "compositions", "portrait.html"));
  if (aspect === "1:1") files.push(join(templateDir, "compositions", "square.html"));
  const hash = createHash("sha256");
  for (const file of files) {
    if (existsSync(file)) hash.update(file).update(await readFile(file));
  }
  return hash.digest("hex");
}

export async function runTemplatePipeline(scriptPath: string): Promise<void> {
  const cfg = loadConfig();
  const outputDir = dirname(scriptPath);
  const cachePath = join(outputDir, ".pipeline-cache.json");
  const cache = await loadPipelineCache(cachePath);
  const stepStartedAt = Date.now();
  const stepTimes: Record<string, number> = {};
  const markStep = (name: string, startedAt: number) => {
    stepTimes[name] = Date.now() - startedAt;
    log.info(`  ${name}: ${(stepTimes[name] / 1000).toFixed(2)}s`);
  };
  log.info(`Output directory: ${outputDir}`);

  // STEP 1 — load + validate
  log.step(1, TOTAL_STEPS, `Load + validate template script (TTS: ${cfg.ttsProvider})`);
  const raw = JSON.parse(await readFile(scriptPath, "utf8"));
  const script: TemplateScript = TemplateScriptSchema.parse(raw);

  // STEP 2 — script.txt for CapCut
  log.step(2, TOTAL_STEPS, "Write script.txt");
  let startedAt = Date.now();
  await writeFile(join(outputDir, "script.txt"), script.scenes.map((s) => s.voiceText).join("\n\n"));
  markStep("script", startedAt);

  // STEP 3 — TTS per scene (idempotent)
  log.step(3, TOTAL_STEPS, "TTS each scene");
  startedAt = Date.now();
  const ttsClient = createTtsClient(cfg);
  const limit = pLimit(cfg.ttsConcurrency);
  const voiceDir = join(outputDir, "voice");
  await mkdir(voiceDir, { recursive: true });
  const sceneAudio = await Promise.all(
    script.scenes.map((scene) =>
      limit(async () => {
        const out = join(voiceDir, `scene-${scene.id}.mp3`);
        const srtOut = join(voiceDir, `scene-${scene.id}.srt`);
        const audioKey = fingerprint({
          provider: cfg.ttsProvider,
          text: scene.voiceText,
          endpoint: cfg.omnivoiceEndpoint,
          gender: cfg.omnivoiceVoiceGender,
          style: cfg.omnivoiceSpeakingStyle,
          referenceAudio: cfg.omnivoiceReferenceAudio,
          referenceText: cfg.omnivoiceReferenceText,
        });
        if (existsSync(out) && cache.audio[scene.id] === audioKey) {
          const dur = await getDurationSec(out);
          log.info(`  scene ${scene.id}: REUSE mp3 from verified cache (${dur.toFixed(2)}s)`);
          return { id: scene.id, path: out, durationSec: dur };
        }
        log.info(`  TTS scene ${scene.id} (${scene.voiceText.length} chars)...`);
        await ttsClient.generate(scene.voiceText, out, srtOut);
        cache.audio[scene.id] = audioKey;
        const dur = await getDurationSec(out);
        log.info(`  scene ${scene.id}: ${dur.toFixed(2)}s`);
        return { id: scene.id, path: out, durationSec: dur };
      }),
    ),
  );
  markStep("tts", startedAt);

  // STEP 4 — concat voice + compute scene timings
  log.step(4, TOTAL_STEPS, "Concat voice + compute timings");
  startedAt = Date.now();
  const voiceRawMp3 = join(outputDir, "voice-raw.mp3");
  const voiceMp3 = join(outputDir, "voice.mp3");

  let cursor = 0;
  const sceneStarts: Record<string, number> = {};
  for (const a of sceneAudio) {
    sceneStarts[a.id] = cursor;
    cursor += a.durationSec + SCENE_GAP_SEC;
  }

  // STEP 5 — SFX selection + mix
  log.step(5, TOTAL_STEPS, "Pick + mix SFX");
  const SFX_DIR = join(outputDir, "..", "..", "assets", "sfx");
  const sfxIndex = existsSync(SFX_DIR) ? indexSfxLibrary(SFX_DIR) : {};
  const sfxList: SfxMixSpec[] = [];
  for (const scene of script.scenes) {
    const startSec = sceneStarts[scene.id];
    if (scene.sfx) {
      if (scene.sfx.name === "none") continue;
      const p = join(SFX_DIR, `${scene.sfx.name}.mp3`);
      if (existsSync(p)) sfxList.push({ path: p, startSec: startSec + scene.sfx.startOffsetSec, volume: scene.sfx.volume });
      continue;
    }
    if (Object.keys(sfxIndex).length === 0) continue;
    const picked = pickSfxForScene({
      voiceText: scene.voiceText,
      templateName: TYPE_TO_SFX[scene.type] ?? "callout",
      sceneId: scene.id,
      index: sfxIndex,
    });
    if (!picked) continue;
    const pb = defaultPlayback(picked);
    sfxList.push({ path: join(SFX_DIR, picked.relPath), startSec: startSec + pb.offsetSec, volume: pb.volume });
  }
  const voiceKey = fingerprint({
    audio: sceneAudio.map((audio) => ({
      id: audio.id,
      cacheKey: cache.audio[audio.id],
      durationSec: audio.durationSec,
    })),
    gapSec: SCENE_GAP_SEC,
    sfx: sfxList,
  });
  if (existsSync(voiceMp3) && cache.voice === voiceKey) {
    log.info("  voice.mp3: REUSE verified cache");
  } else {
    await concatWithSilence(sceneAudio.map((a) => a.path), SCENE_GAP_SEC, voiceRawMp3);
    await mixSfxOntoVoice(voiceRawMp3, sfxList, voiceMp3);
    cache.voice = voiceKey;
  }
  const totalAudioSec = await getDurationSec(voiceMp3);
  log.info(`  voice.mp3: ${totalAudioSec.toFixed(2)}s, ${sfxList.length} SFX`);
  markStep("audio mix", startedAt);

  // STEP 6 — render each scene's template clip, fit to its narration length
  log.step(6, TOTAL_STEPS, "Render template clips + fit to narration");
  startedAt = Date.now();
  const clipsDir = join(outputDir, "clips");
  await mkdir(clipsDir, { recursive: true });
  const lastIdx = script.scenes.length - 1;
  const fittedClips: string[] = [];
  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const dur = sceneAudio.find((a) => a.id === scene.id)!.durationSec;
    const visualDur = dur + (i < lastIdx ? SCENE_GAP_SEC : OUTRO_HOLD_SEC);

    const rawClip = join(clipsDir, `scene-${scene.id}.mp4`);
    const fitClip = join(clipsDir, `scene-${scene.id}-fit.mp4`);
    const templateRevision = await getTemplateFingerprint(scene.templateId, script.aspect);
    const clipKey = fingerprint({
      templateId: scene.templateId,
      templateRevision,
      aspect: script.aspect,
      inputs: scene.inputs,
      durationSec: dur,
      visualDur,
    });
    if (existsSync(rawClip) && existsSync(fitClip) && cache.clips[scene.id] === clipKey) {
      log.info(`  scene ${scene.id}: REUSE verified clip cache`);
    } else {
      if (!existsSync(rawClip) || cache.clips[scene.id] !== clipKey) {
        await composeTemplate({
          templateId: scene.templateId,
          inputs: scene.inputs,
          aspect: script.aspect,
          outputPath: rawClip,
          fps: RENDER_FPS,
        });
      }
      await fitClipToDuration(rawClip, visualDur, fitClip, RENDER_FPS);
      cache.clips[scene.id] = clipKey;
    }
    log.info(`  scene ${scene.id}: ${scene.templateId} → ${visualDur.toFixed(2)}s`);
    fittedClips.push(fitClip);
  }
  markStep("clips", startedAt);
  await savePipelineCache(cachePath, cache);

  // STEP 7 — concat clips + mux voice
  log.step(7, TOTAL_STEPS, "Concat clips + mux audio");
  const silentVideo = join(outputDir, "video-silent.mp4");
  const videoPath = join(outputDir, "video.mp4");
  startedAt = Date.now();
  const videoKey = fingerprint({
    clips: script.scenes.map((scene) => cache.clips[scene.id]),
    voice: voiceKey,
  });
  if (existsSync(videoPath) && cache.video === videoKey) {
    log.info("  video.mp4: REUSE verified cache");
  } else {
    await concatVideos(fittedClips, silentVideo);
    await muxAudioOntoVideo(silentVideo, voiceMp3, videoPath);
    cache.video = videoKey;
    await savePipelineCache(cachePath, cache);
  }
  markStep("final mux", startedAt);

  // STEP 8 — done
  log.step(8, TOTAL_STEPS, "Done");
  console.log("\n=== Result ===");
  console.log(`Video:  ${videoPath}`);
  console.log(`Audio:  ${voiceMp3}  (cho CapCut)`);
  console.log(`Script: ${join(outputDir, "script.txt")}  (cho CapCut auto-caption)`);
  console.log(`Tong thoi luong: ${totalAudioSec.toFixed(2)}s`);
  console.log(`Thoi gian pipeline: ${((Date.now() - stepStartedAt) / 1000).toFixed(2)}s`);
}
