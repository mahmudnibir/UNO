
import React from 'react';
import { Card, CardColor, CardValue } from '../types';
import { Ban, RefreshCw, Plus, Zap, Hexagon } from 'lucide-react';

interface CardViewProps {
  card?: Card;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  playable?: boolean;
  hoverEffect?: boolean;
  flipped?: boolean;
  style?: React.CSSProperties;
}

const CardView: React.FC<CardViewProps> = ({ 
  card, 
  onClick, 
  disabled, 
  className = '', 
  size = 'md', 
  playable = false,
  hoverEffect = true,
  flipped = false,
  style
}) => {
  
  // Dimensions - Scaled down XL size
  const dimensions = {
    xs: 'w-8 h-12 rounded',
    sm: 'w-12 h-16 rounded-md',
    md: 'w-20 h-28 rounded-lg',
    lg: 'w-28 h-40 rounded-xl',
    xl: 'w-24 h-36 md:w-32 md:h-48 rounded-xl', // Reduced from w-36/w-44
  };

  // Interactive Classes
  const isInteractive = !disabled && !flipped && hoverEffect;
  const cursorClass = isInteractive ? 'cursor-pointer' : 'cursor-default';
  
  const disabledClasses = disabled 
    ? 'opacity-50 brightness-75 grayscale-[0.3]' 
    : 'opacity-100 shadow-[0_4px_10px_rgba(0,0,0,0.5)]';

  // Playable Glow
  const playableRing = playable 
    ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-black/50 shadow-[0_0_30px_rgba(250,204,21,0.6)] z-10' 
    : '';

  // --- Back of Card ---
  if (!card || flipped) {
    return (
      <div 
        style={style}
        className={`relative flex items-center justify-center select-none bg-gradient-to-br from-slate-900 to-black ${dimensions[size]} ${className} shadow-xl border-[3px] border-white/10 overflow-hidden`}
      >
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
        
        {/* Classic Oval on Back */}
        <div className="absolute w-[85%] h-[60%] bg-red-600 rounded-[50%] transform rotate-45 shadow-inner flex items-center justify-center overflow-hidden border-4 border-yellow-400">
           <span className="font-black text-yellow-400 italic tracking-tighter transform -rotate-45 drop-shadow-md" style={{ fontSize: size === 'xl' ? '2.5rem' : size === 'lg' ? '2rem' : '1.2rem' }}>UNO</span>
        </div>
      </div>
    );
  }

  // --- Classic Colors ---
  const getColorClass = (c: CardColor) => {
    switch (c) {
      case CardColor.Red: return 'bg-red-600';
      case CardColor.Blue: return 'bg-blue-600';
      case CardColor.Green: return 'bg-green-600';
      case CardColor.Yellow: return 'bg-amber-400'; 
      case CardColor.Wild: return 'bg-black';
      default: return 'bg-gray-700';
    }
  };

  // Text color inside the white oval should match the card color
  const getTextColorClass = (c: CardColor) => {
    switch (c) {
      case CardColor.Red: return 'text-red-600';
      case CardColor.Blue: return 'text-blue-600';
      case CardColor.Green: return 'text-green-600';
      case CardColor.Yellow: return 'text-amber-500';
      case CardColor.Wild: return 'text-black'; // Wild icons inside oval usually distinct
      default: return 'text-black';
    }
  };

  const bgClass = getColorClass(card.color);
  const textClass = getTextColorClass(card.color);

  // --- Content Rendering ---
  const renderCenterContent = () => {
    // Adjusted icon sizes for smaller cards
    const iconSize = size === 'xl' ? 50 : size === 'lg' ? 40 : size === 'md' ? 32 : 16;
    
    // Wild Graphics (Rainbow)
    if (card.value === CardValue.Wild || card.value === CardValue.WildDrawFour) {
       return (
         <div className="flex flex-col items-center justify-center relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-red-500 via-yellow-400 to-blue-600 opacity-20 blur-xl rounded-full" />
            {card.value === CardValue.WildDrawFour && (
                <div className="flex items-center font-black leading-none relative z-10">
                  <span className="text-black flex items-center gap-1 filter drop-shadow-sm">
                    <div className="flex flex-col -space-y-4">
                        <div className="w-6 h-8 bg-blue-500 rounded border-2 border-white transform -rotate-12" />
                        <div className="w-6 h-8 bg-red-500 rounded border-2 border-white transform rotate-6 z-10" />
                    </div>
                  </span>
                </div>
            )}
            {card.value === CardValue.Wild && (
                <div className="w-full h-full flex items-center justify-center">
                     <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-red-500 via-yellow-400 to-blue-600 border-4 border-white shadow-lg"></div>
                </div>
            )}
         </div>
       );
    }

    // Standard Numbers/Icons
    switch (card.value) {
      case CardValue.Skip: return <Ban size={iconSize} strokeWidth={3} />;
      case CardValue.Reverse: return <RefreshCw size={iconSize} strokeWidth={3} />;
      case CardValue.DrawTwo: return <div className="flex items-center justify-center font-black leading-none tracking-tighter"><Plus size={iconSize/1.5} strokeWidth={4} />2</div>;
      default: return <span className="font-black tracking-tighter" style={{ fontSize: size === 'xl' ? '4rem' : size === 'lg' ? '3.5rem' : '2.5rem' }}>{card.value}</span>;
    }
  };

  const renderCorner = () => {
     const miniIconSize = size === 'xl' ? 20 : size === 'lg' ? 18 : 14;
     if (card.value === CardValue.Wild) return <Zap size={miniIconSize} fill="currentColor" />;
     if (card.value === CardValue.WildDrawFour) return "+4";
     if (card.value === CardValue.DrawTwo) return "+2";
     if (card.value === CardValue.Skip) return <Ban size={miniIconSize} />;
     if (card.value === CardValue.Reverse) return <RefreshCw size={miniIconSize} />;
     return card.value;
  }

  return (
    <div 
      onClick={!disabled && onClick ? onClick : undefined}
      style={style}
      className={`
        relative flex flex-col items-center justify-center select-none 
        ${dimensions[size]} ${className} ${bgClass} ${cursorClass} ${disabledClasses} ${playableRing}
        transition-transform duration-200
      `}
    >
      {/* White Border/Padding inside */}
      <div className="absolute inset-1.5 border-2 border-white/20 rounded-[inherit] pointer-events-none" />

      {/* Top Left Corner */}
      <div className="absolute top-1.5 left-2 md:top-2 md:left-3 font-bold leading-none text-white drop-shadow-md text-lg md:text-xl">
        {renderCorner()}
      </div>

      {/* Center Oval */}
      <div className={`
        relative w-[85%] h-[65%] bg-white rounded-[100%] 
        transform -rotate-12 shadow-[inset_0_4px_10px_rgba(0,0,0,0.2)]
        flex items-center justify-center
        ${textClass}
      `}>
         {renderCenterContent()}
      </div>

      {/* Bottom Right Corner (Inverted) */}
      <div className="absolute bottom-1.5 right-2 md:bottom-2 md:right-3 font-bold leading-none text-white drop-shadow-md text-lg md:text-xl transform rotate-180">
        {renderCorner()}
      </div>
      
      {/* Glossy Shine */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent opacity-40 pointer-events-none rounded-[inherit]" />
    </div>
  );
};

export default CardView;
