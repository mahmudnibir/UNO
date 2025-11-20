
import React, { useEffect, useState } from 'react';
import CardView from './CardView';
import { Card, CardColor, Player, GameStatus } from '../types';
import { Bot, Trophy, RotateCw, User } from 'lucide-react';
import { soundManager } from '../utils/sound';

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
  const [visualDiscard, setVisualDiscard] = useState<Card>(discardTop);

  useEffect(() => {
    if (discardTop.id !== visualDiscard.id) {
      soundManager.play('whoosh');
      const w = window.innerWidth;
      const h = window.innerHeight;
      let startX = w / 2;
      let startY = h + 100; 
      let rot = 0;

      // Heuristic for positions based on player count
      // Simplified: If it was You, bottom. If not you, top area random or based on index.
      // Since names can be 'Friend' or 'Host', we can't just check static names easily.
      
      // Logic: Find the player who made the move (currentPlayer moved to next index already, 
      // so we need reverse logic or pass specific prop. 
      // Hack: use lastAction text match)
      
      const sideBotY = h * 0.15; 

      if (lastAction.includes("You") || lastAction.includes("Host")) { 
         // Assuming local player or host at bottom 
         if (lastAction.includes("Host") && players[0].name !== 'Host') { 
             // If I am client, Host is Top/Opponent
             startX = w / 2; startY = h * 0.02 + 30; rot = 180;
         } else {
             // Me
             startX = w / 2; startY = h - 100; rot = 0;
         }
      } else if (lastAction.includes("Friend") || lastAction.includes("Player 2")) {
         // Typically Opponent
         startX = w / 2; startY = h * 0.02 + 30; rot = 180; 
      } else if (lastAction.includes("Sarah")) { 
         startX = w * 0.05 + 30; startY = sideBotY + 30; rot = 90; 
      } else if (lastAction.includes("Mike")) { 
         startX = w / 2; startY = h * 0.02 + 30; rot = 180; 
      } else if (lastAction.includes("Jess")) { 
         startX = w * 0.95 - 30; startY = sideBotY + 30; rot = -90; 
      }

      setFlyingCard({
        id: Math.random().toString(),
        card: discardTop,
        fromX: startX,
        fromY: startY,
        rotation: rot
      });
      
      setTimeout(() => {
        setFlyingCard(null);
        setVisualDiscard(discardTop);
        soundManager.play('land'); 
      }, 700); 
    }
  }, [discardTop.id, lastAction, visualDiscard.id]);


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
        {isTurn && <div className="absolute inset-0 bg-white/30 blur-xl rounded-full scale-150 animate-pulse" />}
        
        <div className={`
          w-14 h-14 md:w-16 md:h-16 rounded-full bg-slate-800 border-4 
          ${isTurn ? 'border-yellow-400 scale-110 shadow-[0_0_20px_rgba(250,204,21,0.5)]' : 'border-slate-600 opacity-80'}
          flex items-center justify-center relative z-30 shadow-2xl transition-all
        `}>
           {player.isBot ? <Bot size={28} className="text-slate-200" /> : <User size={28} className="text-blue-300" />}
           <div className="absolute -bottom-2 bg-black/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-white/10 z-50 whitespace-nowrap">
             {player.name}
           </div>
           <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-slate-900 shadow z-40">
             {player.hand.length}
           </div>
        </div>
        
        <div className="absolute top-[100%] left-1/2 -translate-x-1/2 mt-1 z-20 pointer-events-none w-0 h-0 flex items-center justify-center">
           {Array.from({ length: visibleCards }).map((_, i) => {
               const center = (visibleCards - 1) / 2;
               const offset = i - center;
               return (
                   <div key={i} className="absolute origin-bottom transition-all duration-300" 
                    style={{ transform: `translateX(${offset * 10}px) rotate(${offset * 5}deg) translateY(${Math.abs(offset) * 2}px)`, zIndex: i }}>
                      <CardView size="xs" flipped className="shadow-md border border-white/10 brightness-90 scale-90" />
                   </div>
               );
           })}
        </div>
        {player.hasUno && (
            <div className="absolute -top-12 z-50 animate-bounce">
               <div className="bg-red-600 text-white font-black px-2 py-1 rounded text-xs uppercase -rotate-12 shadow-lg border border-white">UNO!</div>
            </div>
        )}
      </div>
    );
  };

  if (status === GameStatus.GameOver && winner) {
      const isHumanWinner = winner.id === 0 || (winner.name === 'Friend' && false); // Adjust for multiplayer POV later
      return (
          <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden">
             <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-xl z-0"></div>
             {Array.from({ length: 50 }).map((_, i) => (
                 <div key={i} className="absolute top-0 w-3 h-3 md:w-4 md:h-4 rounded-sm animate-confetti z-0"
                   style={{ left: `${Math.random() * 100}%`, backgroundColor: '#ef4444', animationDuration: `${Math.random() * 3 + 2}s`, animationDelay: `${Math.random() * 2}s` }} />
             ))}
             <div className="relative z-10 flex flex-col items-center animate-pop scale-100 p-8 w-full max-w-2xl">
                <Trophy size={140} className="text-yellow-400 drop-shadow-[0_0_30px_rgba(250,204,21,0.8)] animate-bounce mb-8" />
                <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-sm mb-4 tracking-tighter uppercase text-center">VICTORY!</h1>
                <div className="text-2xl md:text-4xl text-white font-bold mb-12 flex items-center gap-3 bg-white/10 px-10 py-3 rounded-full border border-white/10 backdrop-blur-md shadow-lg">{winner.name} 🏆</div>
                <button onClick={onRestart} className="px-10 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full text-black font-black text-xl shadow-lg hover:scale-105 transition-transform">BACK TO LOBBY</button>
             </div>
          </div>
      );
  }

  // --- Position Logic ---
  const renderBots = () => {
      // Logic to map player ID to position based on MyID (0)
      // In multiplayer, we might need relative mapping if we want 'Me' always at bottom.
      // Current simplistic logic: Player 0 is bottom. 
      const totalPlayers = players.length;
      const bots = [];

      // Assuming Player 0 is ALWAYS 'Me' in the local array view
      for (let i = 1; i < totalPlayers; i++) {
          let pos: 'top' | 'left' | 'right' = 'top';
          if (totalPlayers === 2) pos = 'top';
          else if (totalPlayers === 3) { if (i === 1) pos = 'left'; if (i === 2) pos = 'right'; } 
          else { if (i === 1) pos = 'left'; if (i === 2) pos = 'top'; if (i === 3) pos = 'right'; }

          let style: React.CSSProperties = {};
          if (pos === 'left') style = { left: '5%', top: '15%' };
          if (pos === 'right') style = { right: '5%', top: '15%' };
          if (pos === 'top') style = { top: '2%', left: '50%', transform: 'translateX(-50%)' };

          bots.push(<div key={i} className="absolute" style={style}><BotAvatar player={players[i]} index={i} position={pos} /></div>);
      }
      return bots;
  };

  return (
    <div className={`relative w-full h-full bg-gradient-to-br ${getAmbientGlow()} transition-colors duration-1000 overflow-hidden`}>
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-full flex flex-col items-center z-40">
         <div className="absolute -top-24 h-8 pointer-events-none">
            <span className="px-4 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white/80 text-sm font-medium shadow-lg whitespace-nowrap">{lastAction}</span>
         </div>
         <div className={`absolute w-[500px] h-[500px] border-[1px] border-white/5 rounded-full ${direction === 1 ? 'animate-spin-slow' : 'animate-spin-slow-reverse'} pointer-events-none flex items-center justify-center`}>
             <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 p-2 rounded-full"><RotateCw className="text-white/20" /></div>
             <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-slate-900 p-2 rounded-full"><RotateCw className="text-white/20 rotate-180" /></div>
         </div>
         <div className="flex gap-12 md:gap-16 items-center mt-4">
            <div className={`relative group transition-transform duration-200 ${mustDraw ? 'scale-110 cursor-pointer' : ''}`} onClick={currentPlayerIndex === 0 ? onDrawCard : undefined}>
               <div className="absolute -top-2 -left-1 w-full h-full bg-slate-800 rounded-xl border border-slate-600" />
               <div className="absolute -top-1 -left-0.5 w-full h-full bg-slate-800 rounded-xl border border-slate-600" />
               <CardView size="lg" flipped className={`relative shadow-2xl ${mustDraw ? 'ring-4 ring-yellow-400 animate-pulse' : ''}`} />
               {mustDraw && <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-yellow-400 text-black font-bold px-3 py-1 rounded-full text-sm animate-bounce z-50 shadow-lg">TAP TO DRAW</div>}
            </div>
            <div className="relative">
               <div className={`absolute inset-0 bg-${activeColor === CardColor.Wild ? 'white' : activeColor.toLowerCase()}-500 blur-[50px] opacity-30 rounded-full scale-150 transition-colors duration-500`} />
               <CardView card={visualDiscard} size="lg" hoverEffect={false} className="relative z-10 shadow-2xl" />
               {flyingCard && (
                   <div className="absolute top-0 left-0 animate-fly-center pointer-events-none"
                     style={{ '--start-x': `${flyingCard.fromX - (window.innerWidth/2)}px`, '--start-y': `${flyingCard.fromY - (window.innerHeight/2)}px`, '--rot': `${flyingCard.rotation}deg`, zIndex: 100 } as React.CSSProperties}>
                       <CardView card={flyingCard.card} size="lg" className="shadow-2xl" />
                   </div>
               )}
            </div>
         </div>
      </div>
      {renderBots()}
    </div>
  );
};

export default GameTable;
