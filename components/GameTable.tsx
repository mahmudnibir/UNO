
import React, { useEffect, useState } from 'react';
import CardView from './CardView';
import { Card, CardColor, Player, GameStatus } from '../types';
import { Bot, User, Trophy, RotateCw, RotateCcw } from 'lucide-react';

interface GameTableProps {
  deckCount: number;
  discardTop: Card;
  activeColor: CardColor;
  direction: 1 | -1;
  players: Player[];
  currentPlayerIndex: number;
  onDrawCard: () => void;
  status: GameStatus;
  winner: Player | null;
  onRestart: () => void;
  lastAction: string;
  mustDraw: boolean;
}

interface FlyingCardState {
  id: string;
  card: Card;
  fromX: number;
  fromY: number;
  rotation: number;
}

const GameTable: React.FC<GameTableProps> = ({
  deckCount,
  discardTop,
  activeColor,
  direction,
  players,
  currentPlayerIndex,
  onDrawCard,
  status,
  winner,
  onRestart,
  lastAction,
  mustDraw
}) => {
  
  const [flyingCard, setFlyingCard] = useState<FlyingCardState | null>(null);
  const [prevDiscardId, setPrevDiscardId] = useState<string>(discardTop.id);

  useEffect(() => {
    if (discardTop.id !== prevDiscardId) {
      // Determine source position based on who played
      const w = window.innerWidth;
      const h = window.innerHeight;
      let startX = w / 2;
      let startY = h + 100; // Default bottom (Player)
      let rot = 0;

      // Identify who played by checking whose turn index *just* passed or by heuristics
      // Since react state updates instantly, currentPlayerIndex is already next.
      // We can try to deduce from lastAction string or pass 'previousPlayerIndex' prop.
      // Fallback: If lastAction includes "Sarah", set Sarah's pos.
      
      if (lastAction.includes("Sarah")) { startX = 100; startY = h * 0.35; rot = 90; } // Left
      else if (lastAction.includes("Mike")) { startX = w / 2; startY = -100; rot = 180; } // Top
      else if (lastAction.includes("Jess")) { startX = w - 100; startY = h * 0.35; rot = -90; } // Right
      else if (lastAction.includes("You")) { startX = w / 2; startY = h - 50; rot = 0; }

      // Don't animate for player if we want instant drag feel, but for now let's animate all for impact
      // actually, if "You" played, the card is already removed from hand, so animating from bottom center looks good.

      setFlyingCard({
        id: Math.random().toString(),
        card: discardTop,
        fromX: startX,
        fromY: startY,
        rotation: rot
      });

      setPrevDiscardId(discardTop.id);
      
      // Reset animation
      setTimeout(() => setFlyingCard(null), 600);
    }
  }, [discardTop.id, lastAction]);


  const getAmbientGlow = () => {
    switch (activeColor) {
      case CardColor.Red: return 'from-red-900/40 via-slate-950 to-black';
      case CardColor.Blue: return 'from-blue-900/40 via-slate-950 to-black';
      case CardColor.Green: return 'from-green-900/40 via-slate-950 to-black';
      case CardColor.Yellow: return 'from-yellow-900/40 via-slate-950 to-black';
      default: return 'from-slate-900 via-slate-950 to-black';
    }
  };

  const BotAvatar: React.FC<{ player: Player, index: number, position: 'top' | 'left' | 'right' }> = ({ player, index, position }) => {
    const isTurn = currentPlayerIndex === index;
    return (
      <div className="relative flex flex-col items-center transition-all duration-500">
        {/* Glow */}
        {isTurn && <div className="absolute inset-0 bg-white/30 blur-xl rounded-full scale-150 animate-pulse" />}
        
        {/* Avatar */}
        <div className={`
          w-16 h-16 md:w-20 md:h-20 rounded-full bg-slate-800 border-4 
          ${isTurn ? 'border-yellow-400 scale-110 shadow-[0_0_20px_rgba(250,204,21,0.5)]' : 'border-slate-600 opacity-80'}
          flex items-center justify-center relative z-10 shadow-2xl transition-all
        `}>
           <Bot size={32} className="text-slate-200" />
           <div className="absolute -bottom-2 bg-black/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-white/10">
             {player.name}
           </div>
           {/* Card Count Badge */}
           <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-slate-900 shadow">
             {player.hand.length}
           </div>
        </div>
        
        {/* Opponent Cards Visual */}
        <div className={`absolute z-0 opacity-90 transition-transform duration-300
            ${position === 'left' ? 'left-12 top-4 rotate-[15deg]' : ''}
            ${position === 'right' ? 'right-12 top-4 -rotate-[15deg]' : ''}
            ${position === 'top' ? 'top-12' : ''}
        `}>
           {Array.from({ length: Math.min(player.hand.length, 5) }).map((_, i) => (
               <div key={i} className="absolute transform origin-center" style={{ 
                 transform: `translate(${i*4}px, ${i*2}px) rotate(${i*5}deg)`,
                 zIndex: -i 
               }}>
                  <CardView size="xs" flipped className="shadow-sm border border-white/10" />
               </div>
           ))}
        </div>

        {/* UNO Bubble */}
        {player.hasUno && (
            <div className="absolute -top-12 z-50 animate-bounce">
               <div className="bg-red-600 text-white font-black px-2 py-1 rounded text-xs uppercase -rotate-12 shadow-lg border border-white">UNO!</div>
            </div>
        )}
      </div>
    );
  };

  if (status === GameStatus.GameOver && winner) {
      return (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md animate-pop">
              <Trophy size={120} className="text-yellow-400 mb-8 drop-shadow-[0_0_30px_rgba(250,204,21,0.8)] animate-bounce" />
              <h1 className="text-6xl font-black text-white mb-4">WINNER</h1>
              <p className="text-4xl text-yellow-300 font-bold mb-12">{winner.name}</p>
              <button onClick={onRestart} className="px-10 py-4 bg-white text-black font-black text-xl rounded-full hover:scale-105 transition-transform">PLAY AGAIN</button>
          </div>
      );
  }

  return (
    <div className={`relative w-full h-full bg-gradient-to-br ${getAmbientGlow()} transition-colors duration-1000 overflow-hidden`}>
      
      {/* Table Texture */}
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] pointer-events-none"></div>

      {/* Center Content */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-full flex flex-col items-center">
         
         {/* Direction Ring */}
         <div className={`absolute w-[600px] h-[600px] border-[1px] border-white/5 rounded-full ${direction === 1 ? 'animate-spin-slow' : 'animate-spin-slow-reverse'} pointer-events-none flex items-center justify-center`}>
             <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 p-2 rounded-full"><RotateCw className="text-white/20" /></div>
             <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-slate-900 p-2 rounded-full"><RotateCw className="text-white/20 rotate-180" /></div>
         </div>

         {/* Action Log */}
         <div className="mb-12 h-8">
            <span className="px-6 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white/80 font-medium shadow-lg">
                {lastAction}
            </span>
         </div>

         {/* Decks */}
         <div className="flex gap-16 items-center">
            {/* Draw Pile */}
            <div 
               className={`relative group transition-transform duration-200 ${mustDraw ? 'scale-110 cursor-pointer' : ''}`}
               onClick={currentPlayerIndex === 0 ? onDrawCard : undefined}
            >
               <div className="absolute -top-2 -left-1 w-full h-full bg-slate-800 rounded-xl border border-slate-600" />
               <div className="absolute -top-1 -left-0.5 w-full h-full bg-slate-800 rounded-xl border border-slate-600" />
               <CardView 
                 size="lg" 
                 flipped 
                 className={`relative shadow-2xl ${mustDraw ? 'ring-4 ring-yellow-400 animate-pulse' : ''}`} 
               />
               {mustDraw && (
                 <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-yellow-400 text-black font-bold px-3 py-1 rounded-full text-sm animate-bounce">
                    TAP TO DRAW
                 </div>
               )}
            </div>

            {/* Discard Pile */}
            <div className="relative">
               {/* Glow */}
               <div className={`absolute inset-0 bg-${activeColor === CardColor.Wild ? 'white' : activeColor.toLowerCase()}-500 blur-[50px] opacity-30 rounded-full scale-150 transition-colors duration-500`} />
               
               <CardView card={discardTop} size="lg" hoverEffect={false} className="relative z-10 shadow-2xl" />

               {/* Flying Card */}
               {flyingCard && (
                   <div 
                     className="absolute top-0 left-0 z-50 animate-fly-center"
                     style={{
                         '--start-x': `${flyingCard.fromX - (window.innerWidth/2)}px`,
                         '--start-y': `${flyingCard.fromY - (window.innerHeight/2)}px`,
                         '--rot': `${flyingCard.rotation}deg`
                     } as React.CSSProperties}
                   >
                       <CardView card={flyingCard.card} size="lg" className="shadow-2xl" />
                   </div>
               )}
            </div>
         </div>
      </div>

      {/* Bots Positioning */}
      {/* Left */}
      <div className="absolute left-[5%] top-[35%]"><BotAvatar player={players[1]} index={1} position="left" /></div>
      {/* Top */}
      <div className="absolute top-[10%] left-1/2 -translate-x-1/2"><BotAvatar player={players[2]} index={2} position="top" /></div>
      {/* Right */}
      <div className="absolute right-[5%] top-[35%]"><BotAvatar player={players[3]} index={3} position="right" /></div>

    </div>
  );
};

export default GameTable;
    