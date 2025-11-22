
import React, { useEffect, useState, useRef } from 'react';
import CardView from './CardView';
import { Card, CardColor, Player, GameStatus, ChatMessage } from '../types';
import { Bot, Trophy, RotateCw, User, Copy, Check, MessageCircle, Smile, Settings, Send, X } from 'lucide-react';
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
  roomId?: string;
  myPlayerId: number;
  lastActivePlayerId: number | null;
  activeEmotes: Record<number, string>;
  activeBubbles: Record<number, string>;
  chatMessages: ChatMessage[];
  onSendChat: (text: string) => void;
  onSendEmote: (emote: string) => void;
  onOpenSettings: () => void;
}

interface FlyingCardState {
  id: string;
  card: Card;
  fromX: number;
  fromY: number;
  rotation: number;
}

interface DrawingCardState {
    id: string;
    toX: number;
    toY: number;
    rotation: number;
}

const EMOTES = ['😀', '😂', '😎', '😡', '😭', '🤯', '👋', '👍', '👎', '🎉', '💔', '👻'];

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
  mustDraw,
  roomId,
  myPlayerId,
  lastActivePlayerId,
  activeEmotes,
  activeBubbles,
  chatMessages,
  onSendChat,
  onSendEmote,
  onOpenSettings
}) => {
  
  const [flyingCard, setFlyingCard] = useState<FlyingCardState | null>(null);
  const [drawingCard, setDrawingCard] = useState<DrawingCardState | null>(null);
  const [visualDiscard, setVisualDiscard] = useState<Card>(discardTop);
  const [copiedId, setCopiedId] = useState(false);
  
  // HUD State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isEmoteOpen, setIsEmoteOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Track previous hand sizes to detect draws
  const prevHandSizes = useRef<number[]>([]);

  useEffect(() => {
      if(isChatOpen && chatEndRef.current) {
          chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  }, [chatMessages, isChatOpen]);

  const handleSendChatSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(chatInput.trim()) {
          onSendChat(chatInput.trim());
          setChatInput('');
      }
  }

  // Helper to determine visual position of any player index
  const getPlayerPosition = (index: number): 'bottom' | 'top' | 'left' | 'right' => {
    if (index === myPlayerId) return 'bottom';

    const totalPlayers = players.length;
    
    if (totalPlayers === 2) return 'top'; 
    
    if (totalPlayers === 3) {
        if (index === (myPlayerId + 1) % totalPlayers) return 'left';
        return 'right';
    }

    if (totalPlayers === 4) {
        const diff = (index - myPlayerId + totalPlayers) % totalPlayers;
        if (diff === 1) return 'left';
        if (diff === 2) return 'top';
        return 'right';
    }

    return 'top';
  };

  // --- Drawing Animation Logic ---
  useEffect(() => {
      if (status !== GameStatus.Playing) {
          prevHandSizes.current = players.map(p => p.hand.length);
          return;
      }

      players.forEach((p, i) => {
          const prev = prevHandSizes.current[i];
          // If hand size increased AND it wasn't a massive jump (initial deal)
          if (prev !== undefined && p.hand.length > prev && (p.hand.length - prev) < 5) {
              
              // Calculate Target Coordinates relative to Deck (Center)
              const w = window.innerWidth;
              const h = window.innerHeight;
              
              const startX = w / 2 - 60;
              const startY = h * 0.4;

              let destX = 0;
              let destY = 0;
              let rot = 0;

              const pos = getPlayerPosition(i);
              switch (pos) {
                  case 'bottom':
                      destX = w / 2;
                      destY = h - 50;
                      rot = 0;
                      break;
                  case 'top':
                      destX = w / 2;
                      destY = h * 0.02 + 40;
                      rot = 180;
                      break;
                  case 'left':
                      destX = w * 0.05 + 40;
                      destY = h * 0.15 + 40;
                      rot = -90;
                      break;
                  case 'right':
                      destX = w * 0.95 - 40;
                      destY = h * 0.15 + 40;
                      rot = 90;
                      break;
              }

              const tx = destX - startX;
              const ty = destY - startY;

              setDrawingCard({
                  id: Math.random().toString(),
                  toX: tx,
                  toY: ty,
                  rotation: rot
              });
              
              soundManager.play('whoosh');

              setTimeout(() => {
                  setDrawingCard(null);
              }, 600);
          }
      });

      prevHandSizes.current = players.map(p => p.hand.length);
  }, [players, status, myPlayerId]);


  // --- Playing/Discard Animation Logic ---
  useEffect(() => {
    if (discardTop.id !== visualDiscard.id) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      
      let startX = w / 2;
      let startY = h + 100; 
      let rot = 0;

      const originPos = lastActivePlayerId !== null ? getPlayerPosition(lastActivePlayerId) : 'bottom';
      
      switch (originPos) {
          case 'bottom':
              startX = w / 2; 
              startY = h - 50; 
              rot = 0;
              break;
          case 'top':
              startX = w / 2; 
              startY = h * 0.02 + 40; 
              rot = 180;
              break;
          case 'left':
              startX = w * 0.05 + 40; 
              startY = h * 0.15 + 40; 
              rot = 90;
              break;
          case 'right':
              startX = w * 0.95 - 40; 
              startY = h * 0.15 + 40; 
              rot = -90;
              break;
      }

      setFlyingCard({
        id: Math.random().toString(),
        card: discardTop,
        fromX: startX,
        fromY: startY,
        rotation: rot
      });
      
      soundManager.play('whoosh');
      
      setTimeout(() => {
        setFlyingCard(null);
        setVisualDiscard(discardTop);
        soundManager.play('land'); 
      }, 700); 
    }
  }, [discardTop.id, lastActivePlayerId, visualDiscard.id, myPlayerId, players.length]);


  const getAmbientGlow = () => {
    switch (activeColor) {
      case CardColor.Red: return 'from-red-900/40 via-slate-950 to-black';
      case CardColor.Blue: return 'from-blue-900/40 via-slate-950 to-black';
      case CardColor.Green: return 'from-green-900/40 via-slate-950 to-black';
      case CardColor.Yellow: return 'from-yellow-900/40 via-slate-950 to-black';
      default: return 'from-slate-900 via-slate-950 to-black';
    }
  };

  const handleCopyId = () => {
      if (roomId) {
          navigator.clipboard.writeText(roomId);
          setCopiedId(true);
          setTimeout(() => setCopiedId(false), 2000);
      }
  };

  const BotAvatar: React.FC<{ player: Player, index: number, position: 'top' | 'left' | 'right' | 'bottom' }> = ({ player, index, position }) => {
    const isTurn = currentPlayerIndex === index;
    const visibleCards = Math.min(player.hand.length, 5);
    const emote = activeEmotes[player.id];
    const bubble = activeBubbles[player.id];

    return (
      <div className="relative flex flex-col items-center transition-all duration-500 group">
        {isTurn && <div className="absolute inset-0 bg-white/30 blur-xl rounded-full scale-150 animate-pulse" />}
        
        {/* Emote Overlay */}
        {emote && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-[60] animate-bounce text-4xl drop-shadow-lg">
                {emote}
            </div>
        )}

        {/* Chat Bubble */}
        {bubble && (
            <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-[60] bg-white text-black text-xs md:text-sm font-bold px-3 py-2 rounded-xl shadow-lg border-2 border-slate-200 whitespace-nowrap animate-in fade-in zoom-in slide-in-from-bottom-2 max-w-[150px] truncate">
                {bubble}
                <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white transform rotate-45 border-r-2 border-b-2 border-slate-200"></div>
            </div>
        )}

        <div className={`
          w-14 h-14 md:w-16 md:h-16 rounded-full bg-slate-800 border-4 
          ${isTurn ? 'border-yellow-400 scale-110 shadow-[0_0_20px_rgba(250,204,21,0.5)]' : 'border-slate-600 opacity-80'}
          flex items-center justify-center relative z-30 shadow-2xl transition-all
        `}>
           {player.isBot ? <Bot size={28} className="text-slate-200" /> : <User size={28} className="text-blue-300" />}
           <div className="absolute -bottom-2 bg-black/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-white/10 z-50 whitespace-nowrap">
             {player.name}
           </div>
           {position !== 'bottom' && (
                <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-slate-900 shadow z-40">
                    {player.hand.length}
                </div>
           )}
        </div>
        
        {/* Cards always below avatar for clean uniform look (Hidden for self/bottom player) */}
        {position !== 'bottom' && (
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
        )}
        
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

  const renderBots = () => {
      const totalPlayers = players.length;
      const bots = [];
      for (let i = 0; i < totalPlayers; i++) {
          if (i === myPlayerId) continue;
          const pos = getPlayerPosition(i);
          if (pos === 'bottom') continue;

          let style: React.CSSProperties = {};
          if (pos === 'left') style = { left: '5%', top: '15%' };
          if (pos === 'right') style = { right: '5%', top: '15%' };
          if (pos === 'top') style = { top: '2%', left: '50%', transform: 'translateX(-50%)' };

          bots.push(<div key={i} className="absolute" style={style}><BotAvatar player={players[i]} index={i} position={pos as any} /></div>);
      }
      return bots;
  };

  return (
    <div className={`relative w-full h-full bg-gradient-to-br ${getAmbientGlow()} transition-colors duration-1000 overflow-hidden`}>
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] pointer-events-none"></div>
      
      {/* HUD Sidebar */}
      <div className="absolute right-4 top-20 flex flex-col gap-3 z-40 pointer-events-auto">
          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="w-10 h-10 md:w-12 md:h-12 rounded-full backdrop-blur-md flex items-center justify-center border border-white/10 shadow-lg transition-all active:scale-95 group relative bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500 hover:text-white"
          >
              <MessageCircle size={20} />
              {chatMessages.length > 0 && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>}
          </button>
          
          <div className="relative">
              <button 
                onClick={() => setIsEmoteOpen(!isEmoteOpen)}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full backdrop-blur-md flex items-center justify-center border border-white/10 shadow-lg transition-all active:scale-95 group relative bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500 hover:text-white"
              >
                  <Smile size={20} />
              </button>
              {/* Emote Picker */}
              {isEmoteOpen && (
                  <div className="absolute right-full top-0 mr-3 w-48 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2 grid grid-cols-4 gap-2 animate-in fade-in zoom-in slide-in-from-right-2 origin-top-right shadow-2xl">
                       {EMOTES.map(emoji => (
                           <button 
                            key={emoji}
                            onClick={() => { onSendEmote(emoji); setIsEmoteOpen(false); }}
                            className="text-2xl hover:scale-125 transition-transform p-1"
                           >
                               {emoji}
                           </button>
                       ))}
                  </div>
              )}
          </div>
          
          <button 
            onClick={onOpenSettings}
            className="w-10 h-10 md:w-12 md:h-12 rounded-full backdrop-blur-md flex items-center justify-center border border-white/10 shadow-lg transition-all active:scale-95 group relative bg-slate-500/20 text-slate-300 hover:bg-slate-500 hover:text-white"
          >
              <Settings size={20} />
          </button>
      </div>

      {/* Chat Overlay */}
      {isChatOpen && (
          <div className="absolute bottom-24 right-4 md:right-20 w-80 max-h-[400px] h-[50vh] bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5">
              <div className="p-3 border-b border-white/5 flex justify-between items-center bg-black/20">
                  <span className="font-bold text-white text-sm flex items-center gap-2"><MessageCircle size={14}/> Chat</span>
                  <button onClick={() => setIsChatOpen(false)} className="text-white/40 hover:text-white"><X size={16}/></button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                  {chatMessages.map(msg => (
                      <div key={msg.id} className="flex flex-col">
                          <span className={`text-[10px] font-bold ${msg.playerId === myPlayerId ? 'text-green-400 self-end' : 'text-indigo-400 self-start'}`}>{msg.playerName}</span>
                          <div className={`px-3 py-2 rounded-xl text-sm max-w-[85%] break-words ${msg.playerId === myPlayerId ? 'bg-green-500/20 text-green-100 self-end rounded-tr-none' : 'bg-indigo-500/20 text-indigo-100 self-start rounded-tl-none'}`}>
                              {msg.text}
                          </div>
                      </div>
                  ))}
                  <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleSendChatSubmit} className="p-2 border-t border-white/5 flex gap-2 bg-black/20">
                  <input 
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    placeholder="Say something..."
                    maxLength={50}
                  />
                  <button type="submit" disabled={!chatInput.trim()} className="p-2 bg-indigo-600 rounded-lg text-white disabled:opacity-50 hover:bg-indigo-500 transition-colors">
                      <Send size={16} />
                  </button>
              </form>
          </div>
      )}

      {roomId && (
         <div className="absolute top-4 left-20 z-50">
             <div 
                onClick={handleCopyId}
                className="glass-panel px-4 py-2 rounded-full flex items-center gap-2 cursor-pointer hover:bg-white/10 active:scale-95 transition-all group"
             >
                {copiedId ? <Check size={16} className="text-green-400" /> : <Copy size={16} className="text-white/60 group-hover:text-white" />}
                <span className="text-xs font-mono text-white/80 group-hover:text-white">ROOM: {roomId}</span>
                {copiedId && <span className="text-xs font-bold text-green-400 ml-1 animate-pulse">Copied!</span>}
             </div>
         </div>
      )}

      {/* Main Game Circle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-full flex flex-col items-center z-40">
         <div className="absolute -top-24 h-8 pointer-events-none">
            <span className="px-4 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white/80 text-sm font-medium shadow-lg whitespace-nowrap">{lastAction}</span>
         </div>
         <div className={`absolute w-[500px] h-[500px] border-[1px] border-white/5 rounded-full ${direction === 1 ? 'animate-spin-slow' : 'animate-spin-slow-reverse'} pointer-events-none flex items-center justify-center`}>
             <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 p-2 rounded-full"><RotateCw className="text-white/20" /></div>
             <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-slate-900 p-2 rounded-full"><RotateCw className="text-white/20 rotate-180" /></div>
         </div>
         <div className="flex gap-12 md:gap-16 items-center mt-4 relative">
            <div 
                className={`relative group transition-transform duration-200 ${mustDraw ? 'scale-110 cursor-pointer' : ''}`} 
                onClick={currentPlayerIndex === myPlayerId ? onDrawCard : undefined}
            >
               <div className="absolute -top-2 -left-1 w-full h-full bg-slate-800 rounded-xl border border-slate-600" />
               <div className="absolute -top-1 -left-0.5 w-full h-full bg-slate-800 rounded-xl border border-slate-600" />
               <CardView size="lg" flipped className={`relative shadow-2xl ${mustDraw ? 'ring-4 ring-yellow-400 animate-pulse' : ''}`} />
               
               {/* Drawing Animation Card (Overlay on Deck) */}
               {drawingCard && (
                   <div 
                    className="absolute top-0 left-0 z-50 animate-fly-target pointer-events-none"
                    style={{ '--tx': `${drawingCard.toX}px`, '--ty': `${drawingCard.toY}px`, '--rot': `${drawingCard.rotation}deg` } as React.CSSProperties}
                   >
                       <CardView size="lg" flipped className="shadow-2xl" />
                   </div>
               )}

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
      
      {/* Self Avatar (Invisible but useful for positioning if needed, currently separate from GameTable main layout for avatar, 
          but adding it here to support bubbles/emotes for self) */}
      <div className="absolute bottom-6 left-6 z-50">
           <BotAvatar player={players[myPlayerId]} index={myPlayerId} position="bottom" />
      </div>

      {renderBots()}
    </div>
  );
};

export default GameTable;
