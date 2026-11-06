import axios, { AxiosError } from "axios";
import { access, readFile, writeFile } from "node:fs/promises";
import type { TtsClient } from "./tts-client.js";

export interface OmniVoiceOpts {
  endpoint: string; // e.g. "http://127.0.0.1:8123"
  voiceGender?: "male" | "female" | "";
  speakingStyle?: string;
  referenceAudioPath: string;
  referenceText: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// OmniVoice local TTS: POST { text } → audio/mpeg bytes.
// No API key or voice ID — configured server-side.
// srtOutPath is ignored (no subtitle support).
export class OmniVoiceClient implements TtsClient {
  constructor(private cfg: OmniVoiceOpts) {}

  async generate(text: string, audioOutPath: string, _srtOutPath?: string): Promise<void> {
    const delays = [1000, 2000, 4000];
    let lastErr: unknown;

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await access(this.cfg.referenceAudioPath);
        const form = new FormData();
        form.append("ref_audio", new Blob([await readFile(this.cfg.referenceAudioPath)], { type: "audio/wav" }), "voice-reference.wav");
        form.append("ref_text", this.cfg.referenceText);
        form.append("text", text);
        form.append("voice_gender", this.cfg.voiceGender || "male");
        form.append("speaking_style", this.cfg.speakingStyle || "narrator");
        form.append("ref_voice_name", "vietnamese-male-middle-audio-019");
        const resp = await axios.post<ArrayBuffer>(
          `${this.cfg.endpoint}/generate`,
          form,
          { headers: { Accept: "audio/wav" }, responseType: "arraybuffer", timeout: 0 },
        );
        await writeFile(audioOutPath, Buffer.from(resp.data));
        return;
      } catch (e) {
        lastErr = e;
        const status = (e as AxiosError).response?.status;
        if (status !== undefined && status < 500 && status !== 429) {
          throw new Error(`OmniVoice TTS failed (status ${status})`);
        }
        if (attempt < delays.length) await sleep(delays[attempt]);
      }
    }
    throw lastErr;
  }
}
