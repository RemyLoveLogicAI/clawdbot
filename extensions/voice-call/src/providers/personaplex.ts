/**
 * PersonaPlex Voice Provider - NVIDIA's Full-Duplex Speech-to-Speech
 *
 * Integrates PersonaPlex for real-time, full-duplex conversational voice
 * with persona control through text-based role prompts and audio-based
 * voice conditioning.
 *
 * Based on the Moshi architecture for low-latency spoken interactions.
 */

import type {
  HangupCallInput,
  InitiateCallInput,
  InitiateCallResult,
  PlayTtsInput,
  ProviderName,
  ProviderWebhookParseResult,
  StartListeningInput,
  StopListeningInput,
  WebhookContext,
  WebhookVerificationResult,
  NormalizedEvent,
  CallId,
} from "../types.js";
import type { VoiceCallProvider } from "./base.js";

// PersonaPlex-specific configuration
export interface PersonaPlexConfig {
  /** PersonaPlex server URL (WebSocket) */
  serverUrl: string;
  /** Hugging Face token for model access */
  hfToken?: string;
  /** Voice prompt file (e.g., "NATF2.pt" for natural female voice) */
  voicePrompt?: string;
  /** Text prompt for persona (e.g., "You are a wise and friendly teacher.") */
  textPrompt?: string;
  /** CPU offload for low-memory GPUs */
  cpuOffload?: boolean;
  /** SSL directory for secure connections */
  sslDir?: string;
}

// Available PersonaPlex voices
export const PERSONAPLEX_VOICES = {
  // Natural voices (more conversational)
  NATF0: "NATF0.pt",
  NATF1: "NATF1.pt",
  NATF2: "NATF2.pt",
  NATF3: "NATF3.pt",
  NATM0: "NATM0.pt",
  NATM1: "NATM1.pt",
  NATM2: "NATM2.pt",
  NATM3: "NATM3.pt",
  // Variety voices (more diverse)
  VARF0: "VARF0.pt",
  VARF1: "VARF1.pt",
  VARF2: "VARF2.pt",
  VARF3: "VARF3.pt",
  VARF4: "VARF4.pt",
  VARM0: "VARM0.pt",
  VARM1: "VARM1.pt",
  VARM2: "VARM2.pt",
  VARM3: "VARM3.pt",
  VARM4: "VARM4.pt",
} as const;

// Default persona prompts
export const PERSONA_PROMPTS = {
  assistant:
    "You are a wise and friendly teacher. Answer questions or provide advice in a clear and engaging way.",
  casual: "You enjoy having a good conversation.",
  service: (name: string, company: string, info: string) =>
    `You work for ${company} and your name is ${name}. Information: ${info}`,
} as const;

// Active WebSocket connections per call
const activeConnections = new Map<
  CallId,
  {
    ws: WebSocket | null;
    config: PersonaPlexConfig;
    audioBuffer: ArrayBuffer[];
    isListening: boolean;
  }
>();

export class PersonaPlexProvider implements VoiceCallProvider {
  readonly name: ProviderName = "mock"; // Use mock type until schema is updated
  private config: PersonaPlexConfig;

  constructor(config: PersonaPlexConfig) {
    this.config = {
      serverUrl: config.serverUrl || "wss://localhost:8998",
      hfToken: config.hfToken || process.env.HF_TOKEN,
      voicePrompt: config.voicePrompt || PERSONAPLEX_VOICES.NATF2,
      textPrompt: config.textPrompt || PERSONA_PROMPTS.assistant,
      cpuOffload: config.cpuOffload ?? false,
      sslDir: config.sslDir,
    };
  }

  /**
   * Verify webhook - PersonaPlex uses WebSocket, so this is a no-op
   */
  verifyWebhook(_ctx: WebhookContext): WebhookVerificationResult {
    return { ok: true };
  }

  /**
   * Parse webhook event - PersonaPlex events come via WebSocket
   */
  parseWebhookEvent(_ctx: WebhookContext): ProviderWebhookParseResult {
    return { events: [] };
  }

  /**
   * Initiate a full-duplex voice call via PersonaPlex
   */
  async initiateCall(input: InitiateCallInput): Promise<InitiateCallResult> {
    const { callId } = input;

    // Initialize connection state
    activeConnections.set(callId, {
      ws: null,
      config: this.config,
      audioBuffer: [],
      isListening: false,
    });

    // Connect to PersonaPlex WebSocket server
    try {
      await this.connectToPersonaPlex(callId);

      return {
        providerCallId: `personaplex-${callId}`,
        status: "initiated",
      };
    } catch (error) {
      throw new Error(
        `Failed to initiate PersonaPlex call: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Connect to PersonaPlex WebSocket server
   */
  private async connectToPersonaPlex(callId: CallId): Promise<void> {
    const connection = activeConnections.get(callId);
    if (!connection) {
      throw new Error(`No connection state for call ${callId}`);
    }

    return new Promise((resolve, reject) => {
      try {
        // Note: In a real implementation, this would use the actual WebSocket
        // from the PersonaPlex client. This is a placeholder for the integration.
        console.log(
          `[PersonaPlex] Connecting to ${connection.config.serverUrl} for call ${callId}`
        );
        console.log(`[PersonaPlex] Voice: ${connection.config.voicePrompt}`);
        console.log(`[PersonaPlex] Persona: ${connection.config.textPrompt}`);

        // Simulate connection success for now
        // In production, this would establish actual WebSocket connection
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Hang up the call and close WebSocket connection
   */
  async hangupCall(input: HangupCallInput): Promise<void> {
    const { callId } = input;
    const connection = activeConnections.get(callId);

    if (connection?.ws) {
      connection.ws.close();
    }

    activeConnections.delete(callId);
    console.log(`[PersonaPlex] Call ${callId} ended`);
  }

  /**
   * Play TTS - PersonaPlex handles speech synthesis natively
   * This sends text to the model which generates speech output
   */
  async playTts(input: PlayTtsInput): Promise<void> {
    const { callId, text, voice } = input;
    const connection = activeConnections.get(callId);

    if (!connection) {
      throw new Error(`No active connection for call ${callId}`);
    }

    // Update voice if specified
    if (voice && Object.values(PERSONAPLEX_VOICES).includes(voice as any)) {
      connection.config.voicePrompt = voice;
    }

    console.log(`[PersonaPlex] Speaking on call ${callId}: "${text}"`);

    // In a real implementation, this would:
    // 1. Send the text to PersonaPlex via WebSocket
    // 2. PersonaPlex generates speech and streams it back
    // 3. The audio is played to the user in real-time
  }

  /**
   * Start listening - Enable full-duplex audio input
   */
  async startListening(input: StartListeningInput): Promise<void> {
    const { callId } = input;
    const connection = activeConnections.get(callId);

    if (!connection) {
      throw new Error(`No active connection for call ${callId}`);
    }

    connection.isListening = true;
    console.log(`[PersonaPlex] Started listening on call ${callId}`);

    // In PersonaPlex, listening is always active (full-duplex)
    // This just enables processing of incoming audio
  }

  /**
   * Stop listening - Disable audio input processing
   */
  async stopListening(input: StopListeningInput): Promise<void> {
    const { callId } = input;
    const connection = activeConnections.get(callId);

    if (!connection) {
      throw new Error(`No active connection for call ${callId}`);
    }

    connection.isListening = false;
    console.log(`[PersonaPlex] Stopped listening on call ${callId}`);
  }

  /**
   * Set persona prompt for the call
   */
  setPersona(callId: CallId, textPrompt: string): void {
    const connection = activeConnections.get(callId);
    if (connection) {
      connection.config.textPrompt = textPrompt;
    }
  }

  /**
   * Set voice for the call
   */
  setVoice(callId: CallId, voicePrompt: string): void {
    const connection = activeConnections.get(callId);
    if (connection) {
      connection.config.voicePrompt = voicePrompt;
    }
  }

  /**
   * Handle incoming audio from the user
   * PersonaPlex processes this in real-time and generates responses
   */
  handleIncomingAudio(callId: CallId, audioData: ArrayBuffer): void {
    const connection = activeConnections.get(callId);
    if (!connection || !connection.isListening) {
      return;
    }

    connection.audioBuffer.push(audioData);

    // In a real implementation, this would stream the audio to PersonaPlex
    // which processes it in real-time and generates spoken responses
  }

  /**
   * Create events from PersonaPlex WebSocket messages
   */
  createEventsFromMessage(
    callId: CallId,
    message: any
  ): NormalizedEvent[] {
    const events: NormalizedEvent[] = [];
    const timestamp = Date.now();

    // Handle different PersonaPlex message types
    if (message.type === "transcript") {
      events.push({
        type: "call.speech",
        id: `${callId}-speech-${timestamp}`,
        callId,
        timestamp,
        transcript: message.text,
        isFinal: message.is_final ?? true,
        confidence: message.confidence,
      });
    } else if (message.type === "response") {
      events.push({
        type: "call.speaking",
        id: `${callId}-speaking-${timestamp}`,
        callId,
        timestamp,
        text: message.text,
      });
    }

    return events;
  }
}

/**
 * Create a PersonaPlex provider instance
 */
export function createPersonaPlexProvider(
  config: Partial<PersonaPlexConfig> = {}
): PersonaPlexProvider {
  return new PersonaPlexProvider({
    serverUrl: config.serverUrl || process.env.PERSONAPLEX_SERVER_URL || "wss://localhost:8998",
    hfToken: config.hfToken || process.env.HF_TOKEN,
    voicePrompt: config.voicePrompt || PERSONAPLEX_VOICES.NATF2,
    textPrompt: config.textPrompt || PERSONA_PROMPTS.assistant,
    cpuOffload: config.cpuOffload ?? false,
    sslDir: config.sslDir,
  });
}
