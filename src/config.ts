import "dotenv/config";
import { resolve } from "node:path";

export type TtsProvider = "omnivoice";

export interface Config {
    ttsProvider: TtsProvider;

    // OmniVoice (local TTS server)
    omnivoiceEndpoint: string;
    omnivoiceVoiceGender: "male" | "female" | "";
    omnivoiceSpeakingStyle: string;
    omnivoiceReferenceAudio: string;
    omnivoiceReferenceText: string;

    ttsConcurrency: number;
}

function intDefault(name: string, def: number): number {
    const v = process.env[name];
    if (!v) return def;
    const n = parseInt(v, 10);
    if (isNaN(n))
        throw new Error(`Env var ${name} must be integer, got "${v}"`);
    return n;
}

export function loadConfig(): Config {
    const provider = (process.env.TTS_PROVIDER ?? "omnivoice") as TtsProvider;
    if (provider !== "omnivoice") {
        throw new Error(
            `TTS_PROVIDER must be "omnivoice", got "${provider}"`,
        );
    }

    return {
        ttsProvider: provider,
        omnivoiceEndpoint:
            process.env.OMNIVOICE_ENDPOINT ?? "http://127.0.0.1:8123",
        omnivoiceVoiceGender:
            process.env.OMNIVOICE_VOICE_GENDER === "female" ? "female" : "male",
        omnivoiceSpeakingStyle:
            process.env.OMNIVOICE_SPEAKING_STYLE ?? "narrator",
        omnivoiceReferenceAudio: resolve(
            process.env.OMNIVOICE_REFERENCE_AUDIO ??
                "assets/voice-reference/vietnamese-male-middle-audio-019.wav",
        ),
        omnivoiceReferenceText:
            process.env.OMNIVOICE_REFERENCE_TEXT ??
            "Xin chào, mình là Thế Hào. Rất vui vì hôm nay chúng ta lại có dịp ngồi lại với nhau. Trong không gian nhỏ bé, nhưng đầy yêu thương.",
        ttsConcurrency: intDefault("TTS_CONCURRENCY", 1),
    };
}
