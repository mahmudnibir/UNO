import React from 'react';
import { CardColor } from '../types';

interface ColorPickerProps {
  onSelect: (color: CardColor) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ onSelect }) => {
  const colors = [
    { id: CardColor.Red, bg: 'bg-gradient-to-br from-red-500 to-red-700', label: 'Red' },
    { id: CardColor.Blue, bg: 'bg-gradient-to-br from-blue-500 to-blue-700', label: 'Blue' },
    { id: CardColor.Green, bg: 'bg-gradient-to-br from-green-500 to-green-700', label: 'Green' },
    { id: CardColor.Yellow, bg: 'bg-gradient-to-br from-yellow-400 to-amber-500', label: 'Yellow' },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-pop">
      <div className="glass-panel p-8 rounded-3xl max-w-md w-full mx-4 text-center border border-white/10 shadow-2xl">
        <h2 className="text-3xl font-bold mb-2 text-white">Wild Card Played!</h2>
        <p className="text-slate-300 mb-8">Choose the next color to continue.</p>
        
        <div className="grid grid-cols-2 gap-6">
          {colors.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`${c.bg} group relative h-24 rounded-2xl shadow-lg transform transition-all duration-200 hover:scale-105 hover:shadow-xl active:scale-95 border-2 border-transparent hover:border-white/50 overflow-hidden`}
            >
               <span className="relative z-10 text-white font-bold text-xl drop-shadow-md group-hover:scale-110 transition-transform block">
                 {c.label}
               </span>
               {/* Shiny overlay */}
               <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/30 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ColorPicker;