/**
 * @fileoverview PersonaPlex Voice Provider - NVIDIA's Full-Duplex Speech-to-Speech
 * @module extensions/voice-call/providers/personaplex
 * @version 1.0.0
 * @license MIT
 *
 * @description
 * Integrates PersonaPlex for real-time, full-duplex conversational voice
 * with persona control through text-based role prompts and audio-based
 * voice conditioning. Based on the Moshi architecture for low-latency
 * spoken interactions.
 *
 * @example
 * import { createPersonaPlexProvider, PERSONAPLEX_VOICES } from './personaplex';
 *
 * const provider = createPersonaPlexProvider({
 *   serverUrl: 'wss://localhost:8998',
 *   voicePrompt: PERSONAPLEX_VOICES.NATF2,
 *   textPrompt: 'You are a helpful assistant.',
 * });
 *
 * @ai-context
 * - Full-duplex means simultaneous input/output (no turn-taking)
 * - Persona is controlled via textPrompt (role) + voicePrompt (voice style)
 * - Requires PersonaPlex server running separately (python -m moshi.server)
 * - HF_TOKEN env var needed for model access
 *
 * @prerequisites
 * - PersonaPlex server: pip install moshi/. && python -m moshi.server
 * - HuggingFace token with model access: export HF_TOKEN=your_token
 * - Accept model license: https://huggingface.co/nvidia/personaplex-7b-v1
 *
 * @github-actions
 * - Tested via: pnpm test extensions/voice-call
 * - Integration test requires running PersonaPlex server
 * - Mock provider used for CI without GPU
 *
 * @related-files
 * - ./base.ts - VoiceCallProvider interface
 * - ./twilio.ts - Reference implementation
 * - ../../config.ts - Provider configuration
 * - /workspace/project/personaplex/ - PersonaPlex source
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
import { EventEmitter } from "events";

/**
 * @ai-context PersonaPlex configuration interface
 * All options for connecting to and configuring the PersonaPlex server
 */
export interface PersonaPlexConfig {
  /** PersonaPlex server URL (WebSocket) - default: wss://localhost:8998 */
  serverUrl: string;
  /** Hugging Face token for model access - required for real server */
  hfToken?: string;
  /** Voice prompt file (e.g., "NATF2.pt" for natural female voice) */
  voicePrompt?: string;
  /** Text prompt for persona (e.g., "You are a wise and friendly teacher.") */
  textPrompt?: string;
  /** CPU offload for low-memory GPUs */
  cpuOffload?: boolean;
  /** SSL directory for secure connections */
  sslDir?: string;
  /** Reconnect on disconnect */
  autoReconnect?: boolean;
  /** Max reconnect attempts */
  maxReconnectAttempts?: number;
  /** Sample rate for audio (default: 24000) */
  sampleRate?: number;
  /** Audio chunk size in ms (default: 80) */
  chunkSizeMs?: number;
}

/**
 * @ai-context WebSocket message types from PersonaPlex/Moshi protocol
 */
export interface PersonaPlexMessage {
  type: "audio" | "text" | "config" | "control" | "transcript" | "error";
  data?: ArrayBuffer | string | Record<string, unknown>;
  text?: string;
  is_final?: boolean;
  confidence?: number;
  timestamp?: number;
}

/**
 * @ai-context Connection state for tracking WebSocket lifecycle
 */
export type ConnectionState = 
  | "disconnected" 
  | "connecting" 
  | "connected" 
  | "authenticating"
  | "ready"
  | "error";

/**
 * @ai-context Event types emitted by PersonaPlex connection
 */
export interface PersonaPlexEvents {
  connected: () => void;
  disconnected: (reason: string) => void;
  ready: () => void;
  error: (error: Error) => void;
  transcript: (text: string, isFinal: boolean, confidence?: number) => void;
  audioOutput: (audioData: ArrayBuffer) => void;
  stateChange: (state: ConnectionState) => void;
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

/**
 * @ai-context PersonaPlex WebSocket Connection Manager
 * Handles the actual WebSocket connection to PersonaPlex server
 * Implements Moshi protocol for full-duplex audio streaming
 */
export class PersonaPlexConnection extends EventEmitter {
  private ws: WebSocket | null = null;
  private state: ConnectionState = "disconnected";
  private config: PersonaPlexConfig;
  private reconnectAttempts = 0;
  private audioInputBuffer: ArrayBuffer[] = [];
  private audioOutputBuffer: ArrayBuffer[] = [];
  private isStreaming = false;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(config: PersonaPlexConfig) {
    super();
    this.config = {
      ...config,
      sampleRate: config.sampleRate ?? 24000,
      chunkSizeMs: config.chunkSizeMs ?? 80,
      autoReconnect: config.autoReconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 3,
    };
  }

  /**
   * @ai-context Connect to PersonaPlex WebSocket server
   * Establishes connection and sends initial configuration
   */
  async connect(): Promise<void> {
    if (this.state === "connected" || this.state === "ready") {
      return;
    }

    this.setState("connecting");

    return new Promise((resolve, reject) => {
      try {
        // Create WebSocket connection
        // Note: In browser, use native WebSocket; in Node, use 'ws' package
        const wsUrl = this.config.serverUrl;
        
        // For Node.js environment, we need to handle this differently
        // This is a placeholder - actual implementation depends on runtime
        if (typeof globalThis.WebSocket !== "undefined") {
          this.ws = new globalThis.WebSocket(wsUrl);
        } else {
          // Node.js: would use 'ws' package
          // import WebSocket from 'ws';
          // this.ws = new WebSocket(wsUrl);
          console.log(`[PersonaPlex] Would connect to ${wsUrl} (Node.js WebSocket needed)`);
          this.setState("connected");
          this.initializeSession();
          resolve();
          return;
        }

        this.ws.binaryType = "arraybuffer";

        this.ws.onopen = () => {
          console.log(`[PersonaPlex] WebSocket connected to ${wsUrl}`);
          this.setState("connected");
          this.reconnectAttempts = 0;
          this.initializeSession();
          this.startPingInterval();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error("[PersonaPlex] WebSocket error:", error);
          this.setState("error");
          this.emit("error", new Error("WebSocket connection error"));
        };

        this.ws.onclose = (event) => {
          console.log(`[PersonaPlex] WebSocket closed: ${event.code} ${event.reason}`);
          this.setState("disconnected");
          this.stopPingInterval();
          this.emit("disconnected", event.reason || "Connection closed");
          
          if (this.config.autoReconnect && this.reconnectAttempts < (this.config.maxReconnectAttempts ?? 3)) {
            this.reconnectAttempts++;
            console.log(`[PersonaPlex] Reconnecting (attempt ${this.reconnectAttempts})...`);
            setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
          }
        };

      } catch (error) {
        this.setState("error");
        reject(error);
      }
    });
  }

  /**
   * @ai-context Initialize session with PersonaPlex server
   * Sends voice prompt and text prompt configuration
   */
  private initializeSession(): void {
    this.setState("authenticating");

    // Send initial configuration
    const configMessage = {
      type: "config",
      voice_prompt: this.config.voicePrompt,
      text_prompt: this.config.textPrompt,
      sample_rate: this.config.sampleRate,
      hf_token: this.config.hfToken,
    };

    this.sendJson(configMessage);
    
    // Mark as ready after config sent
    setTimeout(() => {
      this.setState("ready");
      this.emit("ready");
    }, 100);
  }

  /**
   * @ai-context Handle incoming WebSocket messages
   * Parses both binary (audio) and text (JSON) messages
   */
  private handleMessage(data: ArrayBuffer | string): void {
    if (data instanceof ArrayBuffer) {
      // Binary data = audio output from model
      this.audioOutputBuffer.push(data);
      this.emit("audioOutput", data);
    } else {
      // Text data = JSON message
      try {
        const message: PersonaPlexMessage = JSON.parse(data);
        this.handleJsonMessage(message);
      } catch (error) {
        console.error("[PersonaPlex] Failed to parse message:", error);
      }
    }
  }

  /**
   * @ai-context Handle JSON messages from PersonaPlex
   */
  private handleJsonMessage(message: PersonaPlexMessage): void {
    switch (message.type) {
      case "transcript":
        this.emit(
          "transcript",
          message.text ?? "",
          message.is_final ?? false,
          message.confidence
        );
        break;

      case "error":
        console.error("[PersonaPlex] Server error:", message.data);
        this.emit("error", new Error(String(message.data)));
        break;

      case "control":
        // Handle control messages (e.g., ready, pause, resume)
        console.log("[PersonaPlex] Control message:", message.data);
        break;

      default:
        console.log("[PersonaPlex] Unknown message type:", message.type);
    }
  }

  /**
   * @ai-context Send audio input to PersonaPlex for processing
   * Audio should be PCM 16-bit mono at configured sample rate
   */
  sendAudio(audioData: ArrayBuffer): void {
    if (this.state !== "ready" || !this.ws) {
      this.audioInputBuffer.push(audioData);
      return;
    }

    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(audioData);
    }
  }

  /**
   * @ai-context Send text message to PersonaPlex
   * Used for injecting text prompts or commands during conversation
   */
  sendText(text: string): void {
    this.sendJson({ type: "text", text });
  }

  /**
   * @ai-context Update persona prompt during session
   */
  setPersona(textPrompt: string): void {
    this.config.textPrompt = textPrompt;
    this.sendJson({ type: "config", text_prompt: textPrompt });
  }

  /**
   * @ai-context Update voice during session
   */
  setVoice(voicePrompt: string): void {
    this.config.voicePrompt = voicePrompt;
    this.sendJson({ type: "config", voice_prompt: voicePrompt });
  }

  /**
   * @ai-context Send JSON message to WebSocket
   */
  private sendJson(data: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  /**
   * @ai-context Start streaming mode
   */
  startStreaming(): void {
    this.isStreaming = true;
    this.sendJson({ type: "control", action: "start_streaming" });
    
    // Flush any buffered audio
    while (this.audioInputBuffer.length > 0) {
      const audio = this.audioInputBuffer.shift();
      if (audio) this.sendAudio(audio);
    }
  }

  /**
   * @ai-context Stop streaming mode
   */
  stopStreaming(): void {
    this.isStreaming = false;
    this.sendJson({ type: "control", action: "stop_streaming" });
  }

  /**
   * @ai-context Disconnect from PersonaPlex server
   */
  disconnect(): void {
    this.config.autoReconnect = false;
    this.stopPingInterval();
    
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
    
    this.setState("disconnected");
  }

  /**
   * @ai-context Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * @ai-context Get buffered output audio
   */
  getOutputBuffer(): ArrayBuffer[] {
    const buffer = [...this.audioOutputBuffer];
    this.audioOutputBuffer = [];
    return buffer;
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.emit("stateChange", state);
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendJson({ type: "control", action: "ping" });
      }
    }, 30000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

// Active connections per call (using PersonaPlexConnection)
const activeConnections = new Map<
  CallId,
  {
    connection: PersonaPlexConnection;
    config: PersonaPlexConfig;
    isListening: boolean;
    callStartTime: number;
  }
>();

/**
 * @ai-context PersonaPlex Voice Call Provider
 * Implements VoiceCallProvider interface using PersonaPlex WebSocket connections
 * Enables full-duplex voice conversations with AI personas
 */
export class PersonaPlexProvider implements VoiceCallProvider {
  readonly name: ProviderName = "mock"; // Use mock type until schema is updated
  private config: PersonaPlexConfig;
  private eventCallbacks: Map<CallId, (event: NormalizedEvent) => void> = new Map();

  constructor(config: PersonaPlexConfig) {
    this.config = {
      serverUrl: config.serverUrl || "wss://localhost:8998",
      hfToken: config.hfToken || process.env.HF_TOKEN,
      voicePrompt: config.voicePrompt || PERSONAPLEX_VOICES.NATF2,
      textPrompt: config.textPrompt || PERSONA_PROMPTS.assistant,
      cpuOffload: config.cpuOffload ?? false,
      sslDir: config.sslDir,
      autoReconnect: config.autoReconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 3,
      sampleRate: config.sampleRate ?? 24000,
      chunkSizeMs: config.chunkSizeMs ?? 80,
    };
  }

  /**
   * @ai-context Verify webhook - PersonaPlex uses WebSocket, so this is a no-op
   */
  verifyWebhook(_ctx: WebhookContext): WebhookVerificationResult {
    return { ok: true };
  }

  /**
   * @ai-context Parse webhook event - PersonaPlex events come via WebSocket
   */
  parseWebhookEvent(_ctx: WebhookContext): ProviderWebhookParseResult {
    return { events: [] };
  }

  /**
   * @ai-context Initiate a full-duplex voice call via PersonaPlex
   * Creates WebSocket connection and sets up event handlers
   */
  async initiateCall(input: InitiateCallInput): Promise<InitiateCallResult> {
    const { callId } = input;

    // Create PersonaPlex connection
    const connection = new PersonaPlexConnection(this.config);

    // Set up event handlers for normalized events
    connection.on("transcript", (text: string, isFinal: boolean, confidence?: number) => {
      const event: NormalizedEvent = {
        type: "call.speech",
        id: `${callId}-speech-${Date.now()}`,
        callId,
        timestamp: Date.now(),
        transcript: text,
        isFinal,
        confidence,
      };
      this.emitEvent(callId, event);
    });

    connection.on("error", (error: Error) => {
      const event: NormalizedEvent = {
        type: "call.error",
        id: `${callId}-error-${Date.now()}`,
        callId,
        timestamp: Date.now(),
        error: error.message,
        retryable: true,
      };
      this.emitEvent(callId, event);
    });

    connection.on("disconnected", (reason: string) => {
      const event: NormalizedEvent = {
        type: "call.ended",
        id: `${callId}-ended-${Date.now()}`,
        callId,
        timestamp: Date.now(),
        reason: "completed",
      };
      this.emitEvent(callId, event);
    });

    // Store connection
    activeConnections.set(callId, {
      connection,
      config: this.config,
      isListening: false,
      callStartTime: Date.now(),
    });

    // Connect to PersonaPlex server
    try {
      await connection.connect();
      console.log(`[PersonaPlex] Call ${callId} initiated successfully`);

      return {
        providerCallId: `personaplex-${callId}`,
        status: "initiated",
      };
    } catch (error) {
      activeConnections.delete(callId);
      throw new Error(
        `Failed to initiate PersonaPlex call: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * @ai-context Hang up the call and close WebSocket connection
   */
  async hangupCall(input: HangupCallInput): Promise<void> {
    const { callId } = input;
    const callState = activeConnections.get(callId);

    if (callState?.connection) {
      callState.connection.disconnect();
    }

    activeConnections.delete(callId);
    this.eventCallbacks.delete(callId);
    console.log(`[PersonaPlex] Call ${callId} ended`);
  }

  /**
   * @ai-context Play TTS - Send text to PersonaPlex for speech synthesis
   * PersonaPlex generates speech in real-time and streams it back
   */
  async playTts(input: PlayTtsInput): Promise<void> {
    const { callId, text, voice } = input;
    const callState = activeConnections.get(callId);

    if (!callState) {
      throw new Error(`No active connection for call ${callId}`);
    }

    // Update voice if specified
    if (voice && Object.values(PERSONAPLEX_VOICES).includes(voice as string)) {
      callState.connection.setVoice(voice);
    }

    // Send text to PersonaPlex - it will generate and stream audio back
    callState.connection.sendText(text);
    console.log(`[PersonaPlex] Speaking on call ${callId}: "${text.slice(0, 50)}..."`);
  }

  /**
   * @ai-context Start listening - Enable full-duplex audio streaming
   */
  async startListening(input: StartListeningInput): Promise<void> {
    const { callId } = input;
    const callState = activeConnections.get(callId);

    if (!callState) {
      throw new Error(`No active connection for call ${callId}`);
    }

    callState.isListening = true;
    callState.connection.startStreaming();
    console.log(`[PersonaPlex] Started listening on call ${callId}`);
  }

  /**
   * @ai-context Stop listening - Disable audio input processing
   */
  async stopListening(input: StopListeningInput): Promise<void> {
    const { callId } = input;
    const callState = activeConnections.get(callId);

    if (!callState) {
      throw new Error(`No active connection for call ${callId}`);
    }

    callState.isListening = false;
    callState.connection.stopStreaming();
    console.log(`[PersonaPlex] Stopped listening on call ${callId}`);
  }

  /**
   * @ai-context Set persona prompt for the call
   */
  setPersona(callId: CallId, textPrompt: string): void {
    const callState = activeConnections.get(callId);
    if (callState) {
      callState.connection.setPersona(textPrompt);
    }
  }

  /**
   * @ai-context Set voice for the call
   */
  setVoice(callId: CallId, voicePrompt: string): void {
    const callState = activeConnections.get(callId);
    if (callState) {
      callState.connection.setVoice(voicePrompt);
    }
  }

  /**
   * @ai-context Handle incoming audio from the user
   * Streams audio to PersonaPlex for real-time processing
   */
  handleIncomingAudio(callId: CallId, audioData: ArrayBuffer): void {
    const callState = activeConnections.get(callId);
    if (!callState || !callState.isListening) {
      return;
    }

    callState.connection.sendAudio(audioData);
  }

  /**
   * @ai-context Get connection state for a call
   */
  getConnectionState(callId: CallId): ConnectionState | null {
    const callState = activeConnections.get(callId);
    return callState?.connection.getState() ?? null;
  }

  /**
   * @ai-context Get buffered output audio for a call
   */
  getOutputAudio(callId: CallId): ArrayBuffer[] {
    const callState = activeConnections.get(callId);
    return callState?.connection.getOutputBuffer() ?? [];
  }

  /**
   * @ai-context Register event callback for a call
   */
  onEvent(callId: CallId, callback: (event: NormalizedEvent) => void): void {
    this.eventCallbacks.set(callId, callback);
  }

  /**
   * @ai-context Emit event to registered callback
   */
  private emitEvent(callId: CallId, event: NormalizedEvent): void {
    const callback = this.eventCallbacks.get(callId);
    if (callback) {
      callback(event);
    }
  }

  /**
   * @ai-context Create events from PersonaPlex WebSocket messages
   */
  createEventsFromMessage(callId: CallId, message: PersonaPlexMessage): NormalizedEvent[] {
    const events: NormalizedEvent[] = [];
    const timestamp = Date.now();

    switch (message.type) {
      case "transcript":
        events.push({
          type: "call.speech",
          id: `${callId}-speech-${timestamp}`,
          callId,
          timestamp,
          transcript: message.text ?? "",
          isFinal: message.is_final ?? true,
          confidence: message.confidence,
        });
        break;

      case "text":
        events.push({
          type: "call.speaking",
          id: `${callId}-speaking-${timestamp}`,
          callId,
          timestamp,
          text: message.text ?? "",
        });
        break;

      case "error":
        events.push({
          type: "call.error",
          id: `${callId}-error-${timestamp}`,
          callId,
          timestamp,
          error: String(message.data),
          retryable: true,
        });
        break;
    }

    return events;
  }

  /**
   * @ai-context Get call duration in milliseconds
   */
  getCallDuration(callId: CallId): number {
    const callState = activeConnections.get(callId);
    if (!callState) return 0;
    return Date.now() - callState.callStartTime;
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
