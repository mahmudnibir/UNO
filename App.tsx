
import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, CardColor, CardValue, Player, GameState, GameStatus 
} from './types';
import { 
  createDeck, shuffleDeck, getNextPlayerIndex, findBestMove, pickBestColorForBot, isValidPlay
} from './utils/gameLogic';
import { soundManager } from './utils/sound';
import GameTable from './components/GameTable';
import PlayerHand from './components/PlayerHand';
import ColorPicker from './components/ColorPicker';
import CardView from './components/CardView';
import { Volume2, VolumeX, Play, Users, Trophy, Zap, User } from 'lucide-react';

const INITIAL_HAND_SIZE = 7;

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingCardPlay, setPendingCardPlay] = useState<Card | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [lastAction, setLastAction] = useState<string>("Game Start");
  const [botCount, setBotCount] = useState<number>(3);

  // Sound wrapper
  const playSound = (type: 'play' | 'draw' | 'uno' | 'win' | 'turn' | 'error' | 'shuffle') => {
    if (isSoundEnabled) {
      soundManager.play(type);
    }
  };

  // --- Game Initialization ---
  const startGame = () => {
    playSound('shuffle');
    const deck = createDeck();
    
    const humans = [{ id: 0, name: 'You', hand: [], isBot: false, hasUno: false }];
    const botNames = ['Sarah', 'Mike', 'Jess'];
    const bots: Player[] = [];

    for (let i = 0; i < botCount; i++) {
        bots.push({
            id: i + 1,
            name: botNames[i],
            hand: [],
            isBot: true,
            hasUno: false
        });
    }

    const players: Player[] = [...humans, ...bots];

    players.forEach(player => {
      player.hand = deck.splice(0, INITIAL_HAND_SIZE);
    });

    let startCard = deck.shift()!;
    while (startCard.color === CardColor.Wild) {
       deck.push(startCard);
       deck.sort(() => Math.random() - 0.5);
       startCard = deck.shift()!;
    }

    setGameState({
      deck,
      discardPile: [startCard],
      players,
      currentPlayerIndex: 0,
      direction: 1,
      status: GameStatus.Playing,
      winner: null,
      activeColor: startCard.color,
      drawStack: 0,
      isUnoShouted: false
    });
    setLastAction("Game Started!");
    playSound('turn');
  };

  // --- Bot AI Loop ---
  useEffect(() => {
    if (!gameState || gameState.status !== GameStatus.Playing) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    if (currentPlayer.isBot) {
      const baseDelay = 1000;
      const delay = Math.random() * 500 + baseDelay; 

      const timer = setTimeout(() => {
        // If there is a draw stack, bot must draw
        if (gameState.drawStack > 0) {
          handleDrawCard(currentPlayer.id);
        } else {
          handleBotTurn(currentPlayer);
        }
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [gameState?.currentPlayerIndex, gameState?.drawStack, gameState?.status]);

  const handleBotTurn = (bot: Player) => {
    if (!gameState) return;
    
    const { discardPile, activeColor } = gameState;
    const topCard = discardPile[discardPile.length - 1];
    
    const bestMove = findBestMove(bot.hand, topCard, activeColor);

    if (bestMove) {
      if (bestMove.color === CardColor.Wild) {
        const chosenColor = pickBestColorForBot(bot.hand);
        executeMove(bot.id, bestMove, chosenColor);
      } else {
        executeMove(bot.id, bestMove);
      }
    } else {
      handleDrawCard(bot.id);
    }
  };

  // --- Player Interactions ---
  const handlePlayerCardClick = (card: Card) => {
    if (!gameState) return;
    
    // Prevent playing if it's not your turn OR if you have penalty cards to draw
    if (gameState.currentPlayerIndex !== 0) {
        playSound('error');
        return;
    }
    if (gameState.drawStack > 0) {
      playSound('error'); // Must draw first
      setLastAction("Must draw penalty cards!");
      return;
    }

    if (card.color === CardColor.Wild) {
      setPendingCardPlay(card);
      setShowColorPicker(true);
      // Removed playSound('play') here to avoid double sound.
      // GameTable will handle sound when discard updates.
    } else {
      executeMove(0, card);
    }
  };

  const handleColorSelect = (color: CardColor) => {
    if (pendingCardPlay) {
      executeMove(0, pendingCardPlay, color);
      setPendingCardPlay(null);
      setShowColorPicker(false);
    }
  };

  const handleDrawCard = (playerId: number) => {
    // Validation for human clicks
    if (playerId === 0 && gameState?.currentPlayerIndex !== 0) return;

    playSound('draw');
    setGameState(prev => {
      if (!prev) return null;
      const newDeck = [...prev.deck];
      let newDiscard = [...prev.discardPile];
      
      // Reshuffle if empty
      if (newDeck.length === 0) {
        if (newDiscard.length <= 1) return prev; // Cannot draw
        const top = newDiscard.pop()!;
        const recycled = shuffleDeck(newDiscard);
        newDeck.push(...recycled);
        newDiscard = [top];
        playSound('shuffle');
      }

      const drawnCard = newDeck.shift()!;
      const newPlayers = prev.players.map(p => 
        p.id === playerId ? { ...p, hand: [...p.hand, drawnCard], hasUno: false } : p
      );

      // Logic for Draw Stack (Penalties)
      if (prev.drawStack > 0) {
        const newStack = prev.drawStack - 1;
        
        // Log
        setLastAction(`${prev.players[playerId].name} drawing penalty (${newStack} left)`);

        // If stack is cleared, Turn ENDS immediately for the victim
        if (newStack === 0) {
           const nextIndex = getNextPlayerIndex(prev.currentPlayerIndex, prev.players.length, prev.direction);
           return {
             ...prev,
             deck: newDeck,
             discardPile: newDiscard,
             players: newPlayers,
             drawStack: 0,
             currentPlayerIndex: nextIndex, // Turn passes after penalty paid
           };
        } else {
           // Still needs to draw more
           return {
             ...prev,
             deck: newDeck,
             discardPile: newDiscard,
             players: newPlayers,
             drawStack: newStack,
             // Player index stays same until stack is 0
           };
        }
      }

      // Normal Draw (No Stack)
      setLastAction(`${prev.players[playerId].name} drew a card`);
      
      const nextIndex = getNextPlayerIndex(prev.currentPlayerIndex, prev.players.length, prev.direction);

      return {
        ...prev,
        deck: newDeck,
        discardPile: newDiscard,
        players: newPlayers,
        currentPlayerIndex: nextIndex
      };
    });
  };

  const handleShoutUno = () => {
    playSound('uno');
    setGameState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        isUnoShouted: true,
        players: prev.players.map(p => p.id === 0 ? { ...p, hasUno: true } : p)
      };
    });
    setLastAction("You shouted UNO!");
  };

  const executeMove = (playerId: number, card: Card, wildColor?: CardColor) => {
    // Removed playSound('play') here. GameTable handles the 'whoosh' and 'land'.
    
    setGameState(prev => {
      if (!prev) return null;

      // Check UNO failure
      let penaltyCards: Card[] = [];
      const player = prev.players[playerId];
      if (playerId === 0 && player.hand.length === 2 && !player.hasUno) {
         if (Math.random() < 0.5) { // 50% chance to get caught
             setLastAction("Forgot to shout UNO! +2 cards");
             playSound('error');
         }
      }

      const newPlayers = prev.players.map(p => {
        if (p.id === playerId) {
          const newHand = p.hand.filter(c => c.id !== card.id);
          return { ...p, hand: [...newHand], hasUno: false };
        }
        return p;
      });

      // Winner Check
      if (newPlayers[playerId].hand.length === 0) {
        playSound('win');
        return {
          ...prev,
          players: newPlayers,
          discardPile: [...prev.discardPile, card],
          status: GameStatus.GameOver,
          winner: prev.players[playerId],
        };
      }

      if (newPlayers[playerId].hand.length === 1) {
          if (playerId !== 0) playSound('uno');
      }

      // Resolve Card Effects
      let nextDirection = prev.direction;
      let nextActiveColor = wildColor || card.color;
      let skipNext = false; // Pure skip
      let stackToAdd = 0;
      let actionText = `${prev.players[playerId].name} played ${card.value}`;

      if (card.value === CardValue.Reverse) {
        nextDirection = (nextDirection * -1) as 1 | -1;
        actionText = "Reverse!";
        playSound('turn');
        // In 2 player game, Reverse acts like Skip
        if (prev.players.length === 2) {
            skipNext = true; // But we handle skip by logic below
        }
      } else if (card.value === CardValue.Skip) {
        skipNext = true;
        actionText = "Skip!";
        playSound('error');
      } else if (card.value === CardValue.DrawTwo) {
        stackToAdd = 2;
        actionText = "+2 Cards!";
        playSound('draw');
      } else if (card.value === CardValue.WildDrawFour) {
        stackToAdd = 4;
        actionText = "Wild +4!";
        playSound('draw');
      }

      setLastAction(actionText);

      // Calculate Next Player
      let nextIndex = getNextPlayerIndex(prev.currentPlayerIndex, prev.players.length, nextDirection);

      // Apply Effects
      if (stackToAdd > 0) {
          // If we add to stack, the next player becomes the victim.
          // They DO NOT get skipped immediately. They get the turn, but are locked into drawing.
          return {
              ...prev,
              discardPile: [...prev.discardPile, card],
              players: newPlayers,
              currentPlayerIndex: nextIndex,
              direction: nextDirection,
              activeColor: nextActiveColor,
              drawStack: prev.drawStack + stackToAdd,
          };
      }

      if (skipNext) {
        nextIndex = getNextPlayerIndex(nextIndex, prev.players.length, nextDirection);
      }

      return {
        ...prev,
        discardPile: [...prev.discardPile, card],
        players: newPlayers,
        currentPlayerIndex: nextIndex,
        direction: nextDirection,
        activeColor: nextActiveColor
      };
    });
  };

  // --- UI Helpers ---
  const hasValidMove = (() => {
    if (!gameState) return false;
    if (gameState.drawStack > 0) return false; // Must draw if stack exists
    const playerHand = gameState.players[0].hand;
    const topCard = gameState.discardPile[gameState.discardPile.length - 1];
    return playerHand.some(c => isValidPlay(c, topCard, gameState.activeColor));
  })();

  const mustDraw = gameState 
    ? (gameState.currentPlayerIndex === 0 && (!hasValidMove || gameState.drawStack > 0))
    : false;

  if (!gameState) {
      // Mock cards for lobby background
      const lobbyCards: {id: string, color: CardColor, value: CardValue, rot: number, x: string, y: string, delay: string}[] = [
        { id: 'l1', color: CardColor.Red, value: CardValue.DrawTwo, rot: -15, x: '10%', y: '20%', delay: '0s' },
        { id: 'l2', color: CardColor.Blue, value: CardValue.Reverse, rot: 15, x: '85%', y: '15%', delay: '1s' },
        { id: 'l3', color: CardColor.Yellow, value: CardValue.Wild, rot: -10, x: '20%', y: '80%', delay: '2s' },
        { id: 'l4', color: CardColor.Green, value: CardValue.Seven, rot: 20, x: '80%', y: '75%', delay: '3s' },
        { id: 'l5', color: CardColor.Wild, value: CardValue.WildDrawFour, rot: 5, x: '50%', y: '15%', delay: '0.5s' },
      ];

      return (
          <div className="h-full w-full flex items-center justify-center bg-[#0f172a] relative overflow-hidden">
            {/* Dynamic Background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 to-black opacity-80"></div>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>

            {/* Floating Cards */}
            {lobbyCards.map((c) => (
               <div 
                 key={c.id} 
                 className="absolute animate-float blur-sm opacity-60 hover:opacity-100 hover:blur-0 transition-all duration-500"
                 style={{ 
                   left: c.x, 
                   top: c.y, 
                   '--rot': `${c.rot}deg`,
                   animationDelay: c.delay 
                 } as React.CSSProperties}
               >
                  <CardView card={c} size="xl" className="shadow-2xl transform scale-75 md:scale-100" />
               </div>
            ))}

            {/* Main Content */}
            <div className="relative z-10 flex flex-col items-center animate-pop max-w-lg w-full px-4">
                
                {/* Logo */}
                <div className="relative mb-8 group cursor-default">
                    <div className="absolute inset-0 bg-yellow-400 blur-[60px] opacity-20 rounded-full group-hover:opacity-30 transition-opacity"></div>
                    <h1 className="text-[6rem] md:text-[10rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-700 drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)] leading-none transform -rotate-3 hover:scale-105 transition-transform duration-500">
                      UNO
                    </h1>
                    <div className="absolute -bottom-2 md:-bottom-6 left-1/2 -translate-x-1/2 bg-yellow-400 text-black font-black text-xl md:text-3xl px-4 py-1 transform -rotate-2 skew-x-[-10deg] border-4 border-black shadow-xl tracking-widest">
                      MASTER
                    </div>
                </div>

                {/* Opponent Selector */}
                <div className="w-full mb-8 bg-slate-900/50 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                    <h3 className="text-white/60 text-sm font-bold uppercase tracking-widest mb-4 text-center">Select Opponents</h3>
                    <div className="flex justify-center gap-4">
                        {[1, 2, 3].map(count => (
                            <button 
                                key={count}
                                onClick={() => setBotCount(count)}
                                className={`
                                    flex flex-col items-center gap-2 px-4 py-3 rounded-xl transition-all w-24
                                    ${botCount === count 
                                        ? 'bg-red-600 text-white shadow-lg scale-105 ring-2 ring-red-400' 
                                        : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                                    }
                                `}
                            >
                                <div className="flex -space-x-2">
                                    {Array.from({length: count}).map((_, i) => (
                                        <User key={i} size={16} />
                                    ))}
                                </div>
                                <span className="font-bold text-lg">{count}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Play Button */}
                <button 
                  onClick={startGame} 
                  className="w-full group relative px-12 py-6 bg-gradient-to-br from-red-600 to-red-800 rounded-3xl shadow-[0_10px_30px_rgba(220,38,38,0.4)] transition-all hover:scale-105 active:scale-95 overflow-hidden"
                >
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                    
                    <div className="relative flex items-center justify-center gap-4">
                      <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                        <Play size={32} fill="currentColor" className="text-white ml-1" />
                      </div>
                      <div className="text-left">
                        <div className="text-white font-black text-3xl tracking-tight leading-none">PLAY NOW</div>
                        <div className="text-red-200 text-sm font-bold uppercase tracking-widest">VS {botCount} BOT{botCount > 1 ? 'S' : ''}</div>
                      </div>
                    </div>
                </button>

                {/* Settings / Footer */}
                <div className="mt-8 flex gap-6">
                   <button onClick={() => setIsSoundEnabled(!isSoundEnabled)} className="glass-panel px-6 py-3 rounded-full flex items-center gap-2 text-white hover:bg-white/10 transition-colors">
                      {isSoundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                      <span className="font-bold text-sm">{isSoundEnabled ? 'SOUND ON' : 'SOUND OFF'}</span>
                   </button>
                </div>
            </div>
          </div>
      );
  }

  return (
    <div className="h-full w-full overflow-hidden relative flex flex-col bg-[#0f172a]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(30,41,59,1)_0%,_rgba(15,23,42,1)_100%)]"></div>
      
      {/* Controls */}
      <div className="absolute top-4 left-4 right-4 z-50 flex justify-between">
         <button onClick={() => setGameState(null)} className="glass-panel px-4 py-2 rounded-full text-sm font-bold hover:bg-red-500/50 transition-colors">EXIT</button>
         <button onClick={() => setIsSoundEnabled(!isSoundEnabled)} className="glass-panel p-2 rounded-full hover:bg-white/20">
           {isSoundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
         </button>
      </div>

      {/* Game Table */}
      <GameTable 
        deckCount={gameState.deck.length}
        discardTop={gameState.discardPile[gameState.discardPile.length - 1]}
        activeColor={gameState.activeColor}
        direction={gameState.direction}
        players={gameState.players}
        currentPlayerIndex={gameState.currentPlayerIndex}
        onDrawCard={() => handleDrawCard(0)}
        status={gameState.status}
        winner={gameState.winner}
        onRestart={startGame}
        lastAction={lastAction}
        mustDraw={mustDraw}
      />

      {/* Player Hand */}
      <PlayerHand 
        hand={gameState.players[0].hand}
        isCurrentTurn={gameState.currentPlayerIndex === 0}
        activeColor={gameState.activeColor}
        discardTop={gameState.discardPile[gameState.discardPile.length - 1]}
        onPlayCard={handlePlayerCardClick}
        onShoutUno={handleShoutUno}
        hasShoutedUno={gameState.players[0].hasUno}
        mustDraw={mustDraw}
      />

      {/* Draw Stack Indicator (Overlay) - Moved Lower */}
      {gameState.drawStack > 0 && (
          <div className="absolute top-[65%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
             <div className="bg-red-600 text-white font-black text-xl px-6 py-2 rounded-full shadow-xl animate-bounce border-2 border-white">
                PENALTY: +{gameState.drawStack}
             </div>
          </div>
      )}

      {showColorPicker && <ColorPicker onSelect={handleColorSelect} />}
    </div>
  );
};

export default App;
