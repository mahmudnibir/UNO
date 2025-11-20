
import React from 'react';
import { Card, CardColor } from '../types';
import CardView from './CardView';
import { Megaphone } from 'lucide-react';

interface PlayerHandProps {
  hand: Card[];
  isCurrentTurn: boolean;
  activeColor: CardColor;
  discardTop: Card;
  onPlayCard: (card: Card) => void;
  onShoutUno: () => void;
  hasShoutedUno: boolean;
  mustDraw: boolean;
}

const PlayerHand: React.FC<PlayerHandProps> = ({ 
  hand, 
  isCurrentTurn, 
  activeColor, 
  discardTop, 
  onPlayCard,
  onShoutUno,
  hasShoutedUno,
  mustDraw
}) => {
  
  const isPlayable = (card: Card) => {
    if (!isCurrentTurn) return false;
    if (mustDraw) return false; // Disable all cards if penalty is active
    if (card.color === CardColor.Wild) return true;
    if (card.color === activeColor) return true;
    if (card.value === discardTop.value) return true;
    return false;
  };

  // Sort hand for better UX: Color then Value
  const sortedHand = [...hand].sort((a, b) => {
    if (a.color === b.color) {
      return a.value.localeCompare(b.value);
    }
    return a.color.localeCompare(b.color);
  });

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 h-[180px] md:h-[240px] pointer-events-none flex flex-col justify-end">
      
      {/* HUD Controls */}
      <div className="w-full flex justify-end items-end mb-4 px-6 md:px-12 pointer-events-auto z-50 absolute top-0">
         
         {/* UNO Button (Only visible when low cards) */}
         {hand.length <= 2 && !hasShoutedUno && hand.length > 0 && (
           <button 
             onClick={onShoutUno}
             className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-8 py-3 rounded-full shadow-lg shadow-red-500/50 animate-bounce hover:scale-105 active:scale-95 transition-all font-black text-xl tracking-wider flex items-center gap-2 ring-4 ring-red-500/30"
           >
             <Megaphone className="animate-wiggle" size={24} fill="currentColor" /> UNO!
           </button>
         )}
      </div>

      {/* Cards Container - Wide Spread */}
      <div className="w-full h-[150px] md:h-[200px] relative flex justify-center items-end pointer-events-auto perspective-[1000px] mb-2 md:mb-4">
         <div className="relative w-full max-w-[90%] md:max-w-[1400px] h-full flex justify-center items-end">
         {sortedHand.map((card, index) => {
           const canPlay = isPlayable(card);
           const total = sortedHand.length;
           
           // Calculate Position: Spread evenly from left to right relative to center
           // Center index is (total - 1) / 2
           const centerIndex = (total - 1) / 2;
           const offsetFromCenter = index - centerIndex;
           
           // Spread factor: How far apart cards are in pixels. 
           const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
           
           // Increased maxSpread to allow cards to sit side-by-side if space exists
           const maxSpread = isMobile ? 40 : 80; // Slightly tighter for smaller cards
           const minSpread = isMobile ? 25 : 40;
           
           // Dynamically squeeze if hand is large
           const availableWidth = typeof window !== 'undefined' ? window.innerWidth - 40 : 1000;
           const idealWidth = total * maxSpread;
           
           // Only squeeze if we exceed available width
           const spread = idealWidth > availableWidth 
             ? Math.max(availableWidth / total, minSpread) 
             : maxSpread;
           
           // X Translation
           const xPos = offsetFromCenter * spread;
           
           // Rotation arc (slight fan)
           const rotation = offsetFromCenter * (isMobile ? 1.5 : 2); 

           // Y Translation (arc effect - center cards higher)
           const yPos = Math.abs(offsetFromCenter) * (isMobile ? 2 : 4);

           return (
             <div 
               key={card.id}
               className="absolute transition-all duration-300 ease-out hover:z-[100] origin-bottom group"
               style={{ 
                 transform: `translateX(${xPos}px) translateY(${yPos}px) rotate(${rotation}deg)`,
                 zIndex: index,
                 bottom: 0, // Anchor to bottom of container
               }}
             >
                <div className={`transition-transform duration-200 ${canPlay ? 'hover:-translate-y-10 hover:scale-110 cursor-pointer' : ''}`}>
                    <CardView 
                    card={card} 
                    size="xl" 
                    playable={canPlay}
                    disabled={!canPlay} // Disabled purely on playable state
                    onClick={() => canPlay && onPlayCard(card)}
                    hoverEffect={true}
                    className={`
                        shadow-2xl 
                        ${canPlay 
                            ? 'brightness-110 hover:shadow-[0_0_40px_rgba(255,255,255,0.5)]' 
                            : 'grayscale-[0.8] opacity-60 brightness-50' // Make non-playable cards much darker
                        }
                    `}
                    />
                </div>
                
                {/* Hover Info / Selection Indicator */}
                {canPlay && (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-black text-xs font-bold px-3 py-1 rounded-full shadow-lg pointer-events-none whitespace-nowrap z-50">
                        Play
                    </div>
                )}
             </div>
           );
         })}
         </div>
      </div>
    </div>
  );
};

export default PlayerHand;
