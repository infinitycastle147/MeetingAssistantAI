import React, { useEffect, useRef } from 'react';
import { TranscriptionItem } from '../types';

interface TranscriptProps {
  items: TranscriptionItem[];
}

const Transcript: React.FC<TranscriptProps> = ({ items }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [items]);

  return (
    <div className="flex flex-col h-full bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
      <div className="p-3 bg-slate-800/50 border-b border-slate-700">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Transcript</h3>
      </div>
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {items.length === 0 ? (
          <div className="text-center text-slate-600 italic text-sm mt-10">
            Listening for conversation...
          </div>
        ) : (
          items.map((item, index) => {
             // Simple logic to merge sequential items from same source could go here
             // For now we just list them.
             const isLast = index === items.length - 1;
             return (
                <div 
                    key={item.id} 
                    className={`flex flex-col ${item.isUser ? 'items-start' : 'items-end'}`}
                >
                    <div 
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                            item.isUser 
                            ? 'bg-slate-800 text-slate-300' 
                            : 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/30'
                        }`}
                    >
                        <span className="opacity-70 text-[10px] block mb-1">
                            {item.isUser ? 'Meeting Audio' : 'AI Assistant'}
                        </span>
                        {item.text}
                    </div>
                </div>
             )
          })
        )}
      </div>
    </div>
  );
};

export default Transcript;