import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ConnectionState, TranscriptionItem } from '../types';
import { createPcmBlob } from './audioUtils';

// System instruction to guide the model's behavior
const SYSTEM_INSTRUCTION = `
You are a professional Meeting Assistant AI. 
Your goal is to listen to the meeting audio stream silently and maintain context.
DO NOT speak or generate text outputs unsolicited. 
Wait for the user to explicitly ask for a response suggestion.
When the user sends a text message like "Suggest a response", provide a concise, professional, and contextually appropriate spoken response text that the user can say in the meeting. 
Keep suggestions direct (1-3 sentences).
`;

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private onTranscriptionUpdate: (item: TranscriptionItem) => void;
  private onStateChange: (state: ConnectionState) => void;

  constructor(
    onTranscriptionUpdate: (item: TranscriptionItem) => void,
    onStateChange: (state: ConnectionState) => void
  ) {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    this.onTranscriptionUpdate = onTranscriptionUpdate;
    this.onStateChange = onStateChange;
  }

  async connect(stream: MediaStream) {
    this.onStateChange(ConnectionState.CONNECTING);

    try {
      this.sessionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            this.onStateChange(ConnectionState.CONNECTED);
            this.startAudioStream(stream);
          },
          onmessage: (message: LiveServerMessage) => {
            this.handleMessage(message);
          },
          onclose: () => {
            this.onStateChange(ConnectionState.DISCONNECTED);
            this.stopAudioStream();
          },
          onerror: (err) => {
            console.error('Gemini Live Error:', err);
            this.onStateChange(ConnectionState.ERROR);
            this.stopAudioStream();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO], // We use AUDIO modality to get the "spoken" style response, but we'll read the transcription
          systemInstruction: SYSTEM_INSTRUCTION,
          inputAudioTranscription: { model: "google_speech_v2" }, // Enable input transcription to track context
          outputAudioTranscription: { model: "google_speech_v2" }, // Enable output transcription to get the suggestion as text
        },
      });
    } catch (error) {
      console.error('Connection failed:', error);
      this.onStateChange(ConnectionState.ERROR);
    }
  }

  private startAudioStream(stream: MediaStream) {
    // 16kHz context for Gemini compatibility
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 16000,
    });

    this.mediaStreamSource = this.inputAudioContext.createMediaStreamSource(stream);
    this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.scriptProcessor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createPcmBlob(inputData);
      
      if (this.sessionPromise) {
        this.sessionPromise.then((session) => {
            session.sendRealtimeInput({ media: pcmBlob });
        });
      }
    };

    this.mediaStreamSource.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioContext.destination);
  }

  private stopAudioStream() {
    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.inputAudioContext) {
      this.inputAudioContext.close();
      this.inputAudioContext = null;
    }
  }

  async disconnect() {
    if (this.sessionPromise) {
        // There is no explicit .close() on the session object returned by promise, 
        // but typically we stop sending data. The SDK manages cleanup on refresh/unmount usually.
        // However, we should try to close if the API supported it.
        // For now, we stop the audio stream which effectively pauses input.
        this.stopAudioStream();
        this.sessionPromise = null;
    }
    this.onStateChange(ConnectionState.DISCONNECTED);
  }

  requestSuggestion() {
    if (this.sessionPromise) {
      this.sessionPromise.then((session) => {
        session.sendRealtimeInput([{ text: "Based on the conversation, suggest a response now." }]);
      });
    }
  }

  private handleMessage(message: LiveServerMessage) {
    // Handle Input Transcription (What the meeting is saying)
    if (message.serverContent?.inputTranscription) {
      const text = message.serverContent.inputTranscription.text;
      if (text) {
        this.onTranscriptionUpdate({
          id: Date.now().toString() + Math.random(),
          timestamp: Date.now(),
          text: text,
          isUser: true,
          isComplete: !!message.serverContent.turnComplete,
        });
      }
    }

    // Handle Output Transcription (The suggestion)
    if (message.serverContent?.outputTranscription) {
      const text = message.serverContent.outputTranscription.text;
      if (text) {
         this.onTranscriptionUpdate({
          id: Date.now().toString() + Math.random(),
          timestamp: Date.now(),
          text: text,
          isUser: false, // Model output
          isComplete: !!message.serverContent.turnComplete,
        });
      }
    }
  }
}
