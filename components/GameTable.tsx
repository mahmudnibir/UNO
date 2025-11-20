
import React, { useEffect, useState } from 'react';
import CardView from './CardView';
import { Card, CardColor, Player, GameStatus } from '../types';
import { Bot, Trophy, RotateCw } from 'lucide-react';

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

      // Determine positions based on bot layout (matching renderBots logic)
      // Side bots are at top: 25%
      const sideBotY = h * 0.25;
      
      if (lastAction.includes("Sarah")) { 
         // Sarah usually Left
         startX = 80; startY = sideBotY; rot = 90; 
      } else if (lastAction.includes("Mike")) { 
         // Mike usually Top
         startX = w / 2; startY = 50; rot = 180; 
      } else if (lastAction.includes("Jess")) { 
         // Jess usually Right
         startX = w - 80; startY = sideBotY; rot = -90; 
      } else if (lastAction.includes("You")) { 
         startX = w / 2; startY = h - 100; rot = 0; 
      }

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
    const visibleCards = Math.min(player.hand.length, 5);

    return (
      <div className="relative flex flex-col items-center transition-all duration-500 group">
        {/* Glow */}
        {isTurn && <div className="absolute inset-0 bg-white/30 blur-xl rounded-full scale-150 animate-pulse" />}
        
        {/* Avatar */}
        <div className={`
          w-16 h-16 md:w-20 md:h-20 rounded-full bg-slate-800 border-4 
          ${isTurn ? 'border-yellow-400 scale-110 shadow-[0_0_20px_rgba(250,204,21,0.5)]' : 'border-slate-600 opacity-80'}
          flex items-center justify-center relative z-30 shadow-2xl transition-all
        `}>
           <Bot size={32} className="text-slate-200" />
           <div className="absolute -bottom-2 bg-black/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-white/10 z-50 whitespace-nowrap">
             {player.name}
           </div>
           {/* Card Count Badge */}
           <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-slate-900 shadow z-40">
             {player.hand.length}
           </div>
        </div>
        
        {/* Opponent Cards Visual - Uniformly Below Avatar */}
        <div className="absolute top-[100%] left-1/2 -translate-x-1/2 mt-4 z-20 pointer-events-none w-0 h-0 flex items-center justify-center">
           {Array.from({ length: visibleCards }).map((_, i) => {
               const center = (visibleCards - 1) / 2;
               const offset = i - center;
               return (
                   <div 
                    key={i} 
                    className="absolute origin-bottom transition-all duration-300" 
                    style={{
                        transform: `translateX(${offset * 14}px) rotate(${offset * 5}deg) translateY(${Math.abs(offset) * 2}px)`,
                        zIndex: i
                    }}
                   >
                      <CardView size="xs" flipped className="shadow-md border border-white/10 brightness-90" />
                   </div>
               );
           })}
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

  // --- Position Logic ---
  const renderBots = () => {
      const totalPlayers = players.length;
      
      // Player 0 is always local (Bottom, handled outside this function implicitly or just not rendered here)
      // We need to render players 1...totalPlayers-1
      
      const bots = [];

      for (let i = 1; i < totalPlayers; i++) {
          let pos: 'top' | 'left' | 'right' = 'top';

          if (totalPlayers === 2) {
              // 1 Bot -> Top
              pos = 'top';
          } else if (totalPlayers === 3) {
              // 2 Bots -> Left (1), Right (2)
              if (i === 1) pos = 'left';
              if (i === 2) pos = 'right';
          } else {
              // 3 Bots -> Left (1), Top (2), Right (3)
              if (i === 1) pos = 'left';
              if (i === 2) pos = 'top';
              if (i === 3) pos = 'right';
          }

          let style: React.CSSProperties = {};
          // Side bots at 25% top to avoid table overlap
          if (pos === 'left') style = { left: '5%', top: '25%' };
          if (pos === 'right') style = { right: '5%', top: '25%' };
          // Top bot centered
          if (pos === 'top') style = { top: '5%', left: '50%', transform: 'translateX(-50%)' };

          bots.push(
              <div key={i} className="absolute" style={style}>
                  <BotAvatar player={players[i]} index={i} position={pos} />
              </div>
          );
      }
      return bots;
  };

  return (
    <div className={`relative w-full h-full bg-gradient-to-br ${getAmbientGlow()} transition-colors duration-1000 overflow-hidden`}>
      
      {/* Table Texture */}
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] pointer-events-none"></div>

      {/* Center Content */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-full flex flex-col items-center">
         
         {/* Direction Ring */}
         <div className={`absolute w-[500px] h-[500px] border-[1px] border-white/5 rounded-full ${direction === 1 ? 'animate-spin-slow' : 'animate-spin-slow-reverse'} pointer-events-none flex items-center justify-center`}>
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
                 <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-yellow-400 text-black font-bold px-3 py-1 rounded-full text-sm animate-bounce z-50">
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

      {/* Render Bots based on dynamic logic */}
      {renderBots()}

    </div>
  );
};

export default GameTable;
