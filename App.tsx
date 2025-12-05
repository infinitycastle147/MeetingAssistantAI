import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ConnectionState, TranscriptionItem } from './types';
import { GeminiLiveService } from './services/geminiLive';
import AudioVisualizer from './components/AudioVisualizer';
import Transcript from './components/Transcript';
import SuggestionCard from './components/SuggestionCard';

const App: React.FC = () => {
  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptionItem[]>([]);
  const [currentSuggestion, setCurrentSuggestion] = useState<TranscriptionItem | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Refs
  const geminiServiceRef = useRef<GeminiLiveService | null>(null);
  // Store source tracks (mic & display) to ensure they are stopped properly
  const activeTracksRef = useRef<MediaStreamTrack[]>([]);

  // Initialize service on mount
  useEffect(() => {
    geminiServiceRef.current = new GeminiLiveService(
      (item) => {
        setTranscripts(prev => {
            return [...prev, item];
        });

        if (!item.isUser) {
          // It's a response from the model
          setIsGenerating(false);
          setCurrentSuggestion(item);
        }
      },
      (state) => setConnectionState(state)
    );

    return () => {
      geminiServiceRef.current?.disconnect();
      cleanupTracks();
    };
  }, []);

  const cleanupTracks = () => {
    activeTracksRef.current.forEach(track => {
        try {
            track.stop();
        } catch (e) {
            console.error("Error stopping track:", e);
        }
    });
    activeTracksRef.current = [];
  };

  const handleStartMeeting = async () => {
    setErrorMsg(null);
    cleanupTracks(); // Ensure fresh start

    try {
      // 1. Get Microphone Audio
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (micStream.getAudioTracks().length === 0) {
         throw new Error("No microphone audio track found. Please check your microphone settings.");
      }
      activeTracksRef.current.push(...micStream.getTracks());
      
      // 2. Get System/Tab Audio
      // Note: This prompts the user to select a tab or screen.
      // They MUST select "Share tab audio" for this to work.
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true, // Video is required to get display media, but we'll ignore the track
        audio: true  // Critical
      });

      // CRITICAL CHECK: Ensure the user actually shared audio
      if (displayStream.getAudioTracks().length === 0) {
        // Stop the video track that was acquired since we can't use this stream
        displayStream.getTracks().forEach(track => track.stop());
        // Clean up mic tracks we already acquired
        cleanupTracks();
        throw new Error("Tab audio not detected. Please ensure you check the 'Share tab audio' box in the sharing dialog.");
      }

      activeTracksRef.current.push(...displayStream.getTracks());

      // 3. Mix Streams
      const audioContext = new AudioContext();
      // Ensure context is running (sometimes browsers suspend it)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const dest = audioContext.createMediaStreamDestination();
      
      const micSource = audioContext.createMediaStreamSource(micStream);
      const displaySource = audioContext.createMediaStreamSource(displayStream);
      
      // Optional: Add some gain control
      const micGain = audioContext.createGain();
      micGain.gain.value = 1.0; 
      
      const displayGain = audioContext.createGain();
      displayGain.gain.value = 1.0;

      micSource.connect(micGain).connect(dest);
      displaySource.connect(displayGain).connect(dest);

      const mixedStream = dest.stream;
      setStream(mixedStream);

      // Connect to Gemini
      await geminiServiceRef.current?.connect(mixedStream);

      // Handle stream end (user stops sharing via browser UI)
      const videoTrack = displayStream.getVideoTracks()[0];
      if (videoTrack) {
          videoTrack.onended = () => {
            handleStopMeeting();
          };
      }

    } catch (err: any) {
      console.error("Error starting meeting:", err);
      cleanupTracks();
      
      let msg = err.message || "Failed to access audio. Ensure you select a tab with audio sharing enabled.";
      
      if (err.name === 'NotAllowedError') {
        msg = "Permission denied. Please allow microphone access and select a tab to share.";
      } else if (err.message && err.message.includes('display-capture')) {
        msg = "Screen capture permission policy violation. Please refresh or try a different browser context.";
      }
      
      setErrorMsg(msg);
      setConnectionState(ConnectionState.ERROR);
    }
  };

  const handleStopMeeting = async () => {
    if (geminiServiceRef.current) {
      await geminiServiceRef.current.disconnect();
    }
    
    // Stop the mixed stream tracks (held in state)
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    
    // Stop the original source tracks (mic + display)
    cleanupTracks();

    setStream(null);
    setConnectionState(ConnectionState.DISCONNECTED);
  };

  const handleGenerateResponse = () => {
    if (connectionState !== ConnectionState.CONNECTED) return;
    setIsGenerating(true);
    setCurrentSuggestion(null); // Clear previous
    geminiServiceRef.current?.requestSuggestion();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center py-8 px-4">
      
      {/* Header */}
      <header className="mb-8 text-center max-w-2xl">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 mb-2">
          Meeting Assistant AI
        </h1>
        <p className="text-slate-400 text-sm">
          Capture Google Meet audio and generate real-time response suggestions.
        </p>
      </header>

      {/* Main Interface */}
      <main className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        
        {/* Left Col: Controls & Status */}
        <div className="lg:col-span-2 flex flex-col gap-4">
            
            {/* Status Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col justify-between">
                <div>
                    <div className="flex items-center justify-between mb-4">
                         <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${
                                connectionState === ConnectionState.CONNECTED ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 
                                connectionState === ConnectionState.CONNECTING ? 'bg-yellow-500 animate-pulse' :
                                'bg-slate-600'
                            }`}></span>
                            <span className="font-semibold text-slate-300">
                                {connectionState === ConnectionState.CONNECTED ? 'Listening Active' : 
                                 connectionState === ConnectionState.CONNECTING ? 'Connecting...' : 'Ready to Start'}
                            </span>
                        </div>
                        {connectionState === ConnectionState.CONNECTED && (
                             <span className="text-xs text-red-400 font-medium animate-pulse flex items-center gap-1">
                                ● REC
                             </span>
                        )}
                    </div>
                    
                    <AudioVisualizer stream={stream} isActive={connectionState === ConnectionState.CONNECTED} />
                </div>

                {/* Error Message */}
                {errorMsg && (
                    <div className="mt-4 p-3 bg-red-900/20 border border-red-800/50 rounded-lg text-red-300 text-sm">
                        {errorMsg}
                    </div>
                )}

                {/* Actions */}
                <div className="mt-6 flex gap-4">
                    {connectionState === ConnectionState.DISCONNECTED || connectionState === ConnectionState.ERROR ? (
                        <button 
                            onClick={handleStartMeeting}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-lg hover:shadow-blue-500/25 flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                            Start Meeting
                        </button>
                    ) : (
                        <button 
                            onClick={handleStopMeeting}
                            className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                            </svg>
                            End Meeting
                        </button>
                    )}
                </div>
            </div>

            {/* Sticky Action Button */}
            <div className="mt-auto">
                 <button 
                    onClick={handleGenerateResponse}
                    disabled={connectionState !== ConnectionState.CONNECTED || isGenerating}
                    className={`w-full py-4 rounded-xl font-bold text-lg shadow-xl transition-all flex items-center justify-center gap-3
                        ${connectionState === ConnectionState.CONNECTED 
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white hover:scale-[1.02] active:scale-[0.98]' 
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'}
                    `}
                >
                    {isGenerating ? (
                        <>
                             <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                             Generating...
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Suggest Response
                        </>
                    )}
                </button>
            </div>
             
             {/* Suggestion Display Area */}
             <div className="min-h-[120px]">
                <SuggestionCard 
                    suggestion={currentSuggestion} 
                    isLoading={isGenerating} 
                    onDismiss={() => setCurrentSuggestion(null)} 
                />
             </div>
        </div>

        {/* Right Col: Transcript */}
        <div className="lg:col-span-1 h-full">
            <Transcript items={transcripts} />
        </div>

      </main>
      
      <footer className="mt-8 text-slate-500 text-xs">
        <p>Uses Google Gemini 2.5 Flash Native Audio (Preview)</p>
        <p className="mt-1">Requires 'Tab Audio Sharing' permission for Google Meet integration.</p>
      </footer>
    </div>
  );
};

export default App;