import React from 'react';
import { TranscriptionItem } from '../types';

interface SuggestionCardProps {
  suggestion: TranscriptionItem | null;
  onDismiss: () => void;
  isLoading: boolean;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({ suggestion, onDismiss, isLoading }) => {
  if (!suggestion && !isLoading) return null;

  return (
    <div className="mt-4 bg-gradient-to-r from-indigo-900/80 to-purple-900/80 border border-indigo-500/50 rounded-xl p-5 shadow-lg relative animate-in fade-in slide-in-from-bottom-4 duration-300">
        {isLoading ? (
            <div className="flex items-center space-x-3 text-indigo-200">
                <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="font-medium">Generating suggestion...</span>
            </div>
        ) : (
            <>
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-indigo-300 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        Suggested Response
                    </h3>
                    <button 
                        onClick={onDismiss}
                        className="text-indigo-400 hover:text-white transition-colors"
                        aria-label="Dismiss"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <p className="text-white text-lg font-medium leading-relaxed">
                    "{suggestion?.text}"
                </p>
                <div className="mt-3 flex gap-2">
                    <button 
                        onClick={() => navigator.clipboard.writeText(suggestion?.text || '')}
                        className="text-xs bg-indigo-700/50 hover:bg-indigo-600/50 px-3 py-1.5 rounded-md text-indigo-100 transition-colors flex items-center gap-1"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                        </svg>
                        Copy
                    </button>
                </div>
            </>
        )}
    </div>
  );
};

export default SuggestionCard;