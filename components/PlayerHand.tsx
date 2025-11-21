
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardColor } from '../types';
import CardView from './CardView';
import { Megaphone } from 'lucide-react';
import { soundManager } from '../utils/sound';

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

// --- Draggable Card Component ---
interface DraggableCardProps {
  card: Card;
  index: number;
  total: number;
  canPlay: boolean;
  onPlay: () => void;
  style: React.CSSProperties;
}

const DraggableCard: React.FC<DraggableCardProps> = ({ card, index, total, canPlay, onPlay, style }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  
  // Drag Ref to store initial offset
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleStart = (clientX: number, clientY: number) => {
    if (!canPlay) return;
    setIsDragging(true);
    setPosition({ x: clientX, y: clientY });
    dragOffset.current = { x: 0, y: 0 }; // Center anchoring usually feels better for cards
    soundManager.play('draw'); // Small feedback
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    setPosition({ x: clientX, y: clientY });
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // Drop Zone Logic: If dropped in the upper 60% of the screen
    const dropThreshold = window.innerHeight * 0.65;
    
    if (position.y < dropThreshold) {
      onPlay();
    } else {
      soundManager.play('whoosh'); // Return sound
    }
  };

  // Mouse Events
  const onMouseDown = (e: React.MouseEvent) => {
    // Prevent default to stop text selection
    e.preventDefault(); 
    handleStart(e.clientX, e.clientY);
  };

  // Touch Events
  const onTouchStart = (e: React.TouchEvent) => {
    // e.preventDefault(); // Don't prevent default here or scroll might break, checking browser behavior
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onMouseUp = () => handleEnd();
    
    const onTouchMove = (e: TouchEvent) => {
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY);
    };
    const onTouchEnd = () => handleEnd();

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging]);

  // If dragging, render a Portal-like fixed element (high z-index)
  // We keep the original element as a placeholder (opacity 0) to maintain layout
  
  return (
    <>
      <div 
        ref={ref}
        className="absolute origin-bottom transition-transform duration-300 ease-out group select-none"
        style={{ 
            ...style, 
            zIndex: isDragging ? -1 : index, // Hide behind if dragging (using placeholder logic)
            opacity: isDragging ? 0 : 1
        }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        <div className={`transition-transform duration-200 ${canPlay ? 'hover:-translate-y-10 hover:scale-110 cursor-grab active:cursor-grabbing' : ''}`}>
            <CardView 
                card={card} 
                size="xl" 
                playable={canPlay}
                // Disable click if we are relying on drag, but keep click for accessibility/quick play
                onClick={canPlay ? onPlay : undefined}
                hoverEffect={true}
                className={`
                    shadow-2xl 
                    ${canPlay 
                        ? 'brightness-110 hover:shadow-[0_0_40px_rgba(255,255,255,0.5)]' 
                        : 'grayscale-[0.5] opacity-100 brightness-90'
                    }
                `}
            />
        </div>
        {canPlay && (
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-black text-xs font-bold px-3 py-1 rounded-full shadow-lg pointer-events-none whitespace-nowrap z-50">
                Drag to Play
            </div>
        )}
      </div>

      {isDragging && (
        <div 
            className="fixed z-[1000] pointer-events-none"
            style={{ 
                left: position.x, 
                top: position.y,
                transform: 'translate(-50%, -50%) scale(1.2) rotate(5deg)', // Slightly larger and tilted while dragging
            }}
        >
            <CardView card={card} size="xl" playable={true} className="shadow-[0_20px_50px_rgba(0,0,0,0.5)]" />
        </div>
      )}
    </>
  );
};

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
    if (mustDraw) return false;
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
           
           const centerIndex = (total - 1) / 2;
           const offsetFromCenter = index - centerIndex;
           
           const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
           
           const maxSpread = isMobile ? 40 : 80;
           const minSpread = isMobile ? 25 : 40;
           
           const availableWidth = typeof window !== 'undefined' ? window.innerWidth - 40 : 1000;
           const idealWidth = total * maxSpread;
           
           const spread = idealWidth > availableWidth 
             ? Math.max(availableWidth / total, minSpread) 
             : maxSpread;
           
           const xPos = offsetFromCenter * spread;
           const rotation = offsetFromCenter * (isMobile ? 1.5 : 2); 
           const yPos = Math.abs(offsetFromCenter) * (isMobile ? 2 : 4);

           return (
             <DraggableCard 
                key={card.id}
                card={card}
                index={index}
                total={total}
                canPlay={canPlay}
                onPlay={() => onPlayCard(card)}
                style={{ 
                    transform: `translateX(${xPos}px) translateY(${yPos}px) rotate(${rotation}deg)`,
                    bottom: 0
                }}
             />
           );
         })}
         </div>
      </div>
    </div>
  );
};

export default PlayerHand;
