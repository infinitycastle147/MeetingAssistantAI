import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  stream: MediaStream | null;
  isActive: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ stream, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode>();
  const audioContextRef = useRef<AudioContext>();
  const sourceRef = useRef<MediaStreamAudioSourceNode>();

  useEffect(() => {
    if (!stream || !isActive || !canvasRef.current) return;

    audioContextRef.current = new AudioContext();
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 256;
    
    sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
    sourceRef.current.connect(analyserRef.current);

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      if (!ctx || !analyserRef.current) return;
      
      animationRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteFrequencyData(dataArray);

      ctx.fillStyle = '#0f172a'; // Clear with bg color
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;
        
        // Gradient fill
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#3b82f6'); // Blue-500
        gradient.addColorStop(1, '#a855f7'); // Purple-500

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [stream, isActive]);

  return (
    <div className="w-full h-16 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 relative">
        {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs uppercase tracking-wider">
                Waiting for audio...
            </div>
        )}
      <canvas 
        ref={canvasRef} 
        width={300} 
        height={64} 
        className="w-full h-full"
      />
    </div>
  );
};

export default AudioVisualizer;