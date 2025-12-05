export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface TranscriptionItem {
  id: string;
  timestamp: number;
  text: string;
  isUser: boolean; // true if input (meeting audio), false if model output (suggestion)
  isComplete: boolean;
}

export interface AudioDeviceConfig {
  micId?: string;
}

export interface Suggestion {
  text: string;
  timestamp: number;
}
