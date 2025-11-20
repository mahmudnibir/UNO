
import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, CardColor, CardValue, Player, GameState, GameStatus, NetworkMode, NetworkMessage 
} from './types';
import { 
  createDeck, shuffleDeck, getNextPlayerIndex, findBestMove, pickBestColorForBot, isValidPlay
} from './utils/gameLogic';
import { soundManager } from './utils/sound';
import { mpManager } from './utils/multiplayer';
import GameTable from './components/GameTable';
import PlayerHand from './components/PlayerHand';
import ColorPicker from './components/ColorPicker';
import CardView from './components/CardView';
import { Volume2, VolumeX, Play, Users, Trophy, Zap, User, Copy, Wifi, WifiOff } from 'lucide-react';

const INITIAL_HAND_SIZE = 7;

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingCardPlay, setPendingCardPlay] = useState<Card | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [lastAction, setLastAction] = useState<string>("Game Start");
  
  // Multiplayer State
  const [networkMode, setNetworkMode] = useState<NetworkMode>(NetworkMode.Offline);
  const [roomCode, setRoomCode] = useState<string>("");
  const [joinInput, setJoinInput] = useState<string>("");
  const [connectedPeers, setConnectedPeers] = useState<number>(0);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Settings
  const [botCount, setBotCount] = useState<number>(3);

  const playSound = (type: 'play' | 'draw' | 'uno' | 'win' | 'turn' | 'error' | 'shuffle') => {
    if (isSoundEnabled) {
      soundManager.play(type);
    }
  };

  // Initialize Multiplayer Listeners
  useEffect(() => {
    mpManager.initialize((data: NetworkMessage) => {
      
      if (networkMode === NetworkMode.Client) {
        // --- Client Logic ---
        if (data.type === 'GAME_STATE') {
          // Update local view based on Host
          setGameState(data.payload);
          if (data.payload.lastAction) setLastAction(data.payload.lastAction);
          playSound('turn'); // Generic sound update
        }
      } else if (networkMode === NetworkMode.Host) {
        // --- Host Logic ---
        if (data.type === 'PLAYER_JOINED') {
           setConnectedPeers(prev => prev + 1);
           playSound('draw');
        }
        if (data.type === 'PLAY_CARD') {
           const { playerId, card, wildColor } = data.payload;
           // Execute move on behalf of client
           executeMove(playerId, card, wildColor);
        }
        if (data.type === 'DRAW_CARD') {
           const { playerId } = data.payload;
           handleDrawCard(playerId);
        }
        if (data.type === 'SHOUT_UNO') {
            handleShoutUno(data.payload.playerId);
        }
      }
    });
  }, [networkMode]);

  // --- Hosting ---
  const startHost = async () => {
      setIsConnecting(true);
      try {
          const id = await mpManager.hostGame();
          setRoomCode(id);
          setNetworkMode(NetworkMode.Host);
          setConnectedPeers(0);
      } catch (e) {
          alert("Failed to host game. PeerJS server might be busy.");
          setNetworkMode(NetworkMode.Offline);
      }
      setIsConnecting(false);
  };

  // --- Joining ---
  const joinGame = async () => {
      if (!joinInput) return;
      setIsConnecting(true);
      try {
          await mpManager.joinGame(joinInput);
          setNetworkMode(NetworkMode.Client);
          setRoomCode(joinInput);
      } catch (e) {
          alert("Could not connect to room: " + joinInput);
          setNetworkMode(NetworkMode.Offline);
      }
      setIsConnecting(false);
  };

  // --- Game Initialization ---
  const startGame = () => {
    playSound('shuffle');
    const deck = createDeck();
    
    // Setup Players
    const players: Player[] = [];
    
    // Player 1 (Host/Local)
    players.push({ id: 0, name: networkMode === NetworkMode.Client ? 'Host' : 'You', hand: [], isBot: false, hasUno: false });

    if (networkMode === NetworkMode.Host) {
        // Add connected friend as Player 2
        if (connectedPeers > 0) {
            players.push({ id: 1, name: 'Friend', hand: [], isBot: false, hasUno: false });
        }
        
        // Fill rest with bots
        const botNames = ['Sarah', 'Mike', 'Jess'];
        let botIndex = 0;
        const totalDesired = connectedPeers > 0 ? botCount + 1 : botCount; // If friend joined, adjust total

        while(players.length < (connectedPeers > 0 ? 2 + Math.max(0, botCount - 1) : 1 + botCount)) {
             players.push({ id: players.length, name: botNames[botIndex++ % 3], hand: [], isBot: true, hasUno: false });
        }
    } else if (networkMode === NetworkMode.Offline) {
        // Standard Offline Setup
        const botNames = ['Sarah', 'Mike', 'Jess'];
        for (let i = 0; i < botCount; i++) {
            players.push({ id: i + 1, name: botNames[i], hand: [], isBot: true, hasUno: false });
        }
    }

    // Deal Cards
    players.forEach(player => {
      player.hand = deck.splice(0, INITIAL_HAND_SIZE);
    });

    let startCard = deck.shift()!;
    while (startCard.color === CardColor.Wild) {
       deck.push(startCard);
       deck.sort(() => Math.random() - 0.5);
       startCard = deck.shift()!;
    }

    const newGameState = {
      deck,
      discardPile: [startCard],
      players,
      currentPlayerIndex: 0,
      direction: 1,
      status: GameStatus.Playing,
      winner: null,
      activeColor: startCard.color,
      drawStack: 0,
      isUnoShouted: false,
      roomId: roomCode
    };

    setGameState(newGameState);
    setLastAction("Game Started!");
    playSound('turn');

    // Broadcast initial state if Host
    if (networkMode === NetworkMode.Host) {
        // Need to sanitize for client (client is player 1 usually if P2P logic was strict, but here we map IDs)
        // For simplicity, we send full state and Client figures out they are Player 1
        mpManager.broadcast({ type: 'GAME_STATE', payload: newGameState });
    }
  };

  // --- Sync Helper ---
  const updateGameState = (newState: GameState) => {
      setGameState(newState);
      if (networkMode === NetworkMode.Host) {
          mpManager.broadcast({ type: 'GAME_STATE', payload: newState });
      }
  };

  // --- Bot AI Loop ---
  useEffect(() => {
    if (!gameState || gameState.status !== GameStatus.Playing) return;
    
    // Only Host (or Offline) runs Bots
    if (networkMode === NetworkMode.Client) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    if (currentPlayer.isBot) {
      const baseDelay = 1000;
      const delay = Math.random() * 500 + baseDelay; 

      const timer = setTimeout(() => {
        if (gameState.drawStack > 0) {
          handleDrawCard(currentPlayer.id);
        } else {
          handleBotTurn(currentPlayer);
        }
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [gameState?.currentPlayerIndex, gameState?.drawStack, gameState?.status, networkMode]);

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
  // Identify who "You" are based on mode
  const myPlayerId = networkMode === NetworkMode.Client ? 1 : 0; 

  const handlePlayerCardClick = (card: Card) => {
    if (!gameState) return;
    
    // Validate Turn
    if (gameState.currentPlayerIndex !== myPlayerId) {
        playSound('error');
        return;
    }
    if (gameState.drawStack > 0) {
      playSound('error'); 
      setLastAction("Must draw penalty cards!");
      return;
    }

    // If Client, send request to Host
    if (networkMode === NetworkMode.Client) {
         if (card.color === CardColor.Wild) {
             setPendingCardPlay(card);
             setShowColorPicker(true);
         } else {
             mpManager.sendToHost({ type: 'PLAY_CARD', payload: { playerId: myPlayerId, card } });
         }
         return;
    }

    // If Host/Offline
    if (card.color === CardColor.Wild) {
      setPendingCardPlay(card);
      setShowColorPicker(true);
    } else {
      executeMove(myPlayerId, card);
    }
  };

  const handleColorSelect = (color: CardColor) => {
    if (pendingCardPlay) {
      if (networkMode === NetworkMode.Client) {
          mpManager.sendToHost({ type: 'PLAY_CARD', payload: { playerId: myPlayerId, card: pendingCardPlay, wildColor: color } });
      } else {
          executeMove(myPlayerId, pendingCardPlay, color);
      }
      setPendingCardPlay(null);
      setShowColorPicker(false);
    }
  };

  const handleClientDraw = () => {
      if (networkMode === NetworkMode.Client) {
          if (gameState?.currentPlayerIndex === myPlayerId) {
              mpManager.sendToHost({ type: 'DRAW_CARD', payload: { playerId: myPlayerId } });
          }
      } else {
          handleDrawCard(myPlayerId);
      }
  }

  const handleShoutUno = (playerId?: number) => {
    const id = playerId !== undefined ? playerId : myPlayerId;
    
    if (networkMode === NetworkMode.Client && id === myPlayerId) {
        mpManager.sendToHost({ type: 'SHOUT_UNO', payload: { playerId: id } });
        // Optimistic update
        playSound('uno');
        return;
    }

    playSound('uno');
    setGameState(prev => {
      if (!prev) return null;
      const newState = {
        ...prev,
        isUnoShouted: true,
        players: prev.players.map(p => p.id === id ? { ...p, hasUno: true } : p)
      };
      if (networkMode === NetworkMode.Host) mpManager.broadcast({ type: 'GAME_STATE', payload: newState });
      return newState;
    });
    
    const name = gameState?.players[id]?.name || "Player";
    setLastAction(`${name} shouted UNO!`);
  };

  // --- Core Game Logic (Host Only) ---
  const handleDrawCard = (playerId: number) => {
    playSound('draw');
    setGameState(prev => {
      if (!prev) return null;
      const newDeck = [...prev.deck];
      let newDiscard = [...prev.discardPile];
      
      if (newDeck.length === 0) {
        if (newDiscard.length <= 1) return prev; 
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

      let nextState: GameState;
      const playerName = prev.players[playerId].name;

      if (prev.drawStack > 0) {
        const newStack = prev.drawStack - 1;
        setLastAction(`${playerName} drawing penalty (${newStack} left)`);
        
        if (newStack === 0) {
           const nextIndex = getNextPlayerIndex(prev.currentPlayerIndex, prev.players.length, prev.direction);
           nextState = { ...prev, deck: newDeck, discardPile: newDiscard, players: newPlayers, drawStack: 0, currentPlayerIndex: nextIndex };
        } else {
           nextState = { ...prev, deck: newDeck, discardPile: newDiscard, players: newPlayers, drawStack: newStack };
        }
      } else {
          setLastAction(`${playerName} drew a card`);
          const nextIndex = getNextPlayerIndex(prev.currentPlayerIndex, prev.players.length, prev.direction);
          nextState = { ...prev, deck: newDeck, discardPile: newDiscard, players: newPlayers, currentPlayerIndex: nextIndex };
      }

      if (networkMode === NetworkMode.Host) mpManager.broadcast({ type: 'GAME_STATE', payload: nextState });
      return nextState;
    });
  };

  const executeMove = (playerId: number, card: Card, wildColor?: CardColor) => {
    setGameState(prev => {
      if (!prev) return null;

      // Check UNO failure
      const player = prev.players[playerId];
      if (player.hand.length === 2 && !player.hasUno) {
         if (Math.random() < 0.5) { 
             setLastAction("Forgot to shout UNO! +2 cards");
             playSound('error');
             // In a real implementation, we would trigger a +2 penalty here
         }
      }

      const newPlayers = prev.players.map(p => {
        if (p.id === playerId) {
          const newHand = p.hand.filter(c => c.id !== card.id);
          return { ...p, hand: [...newHand], hasUno: false };
        }
        return p;
      });

      if (newPlayers[playerId].hand.length === 0) {
        playSound('win');
        const winState = { ...prev, players: newPlayers, discardPile: [...prev.discardPile, card], status: GameStatus.GameOver, winner: prev.players[playerId] };
        if (networkMode === NetworkMode.Host) mpManager.broadcast({ type: 'GAME_STATE', payload: winState });
        return winState;
      }

      if (newPlayers[playerId].hand.length === 1) {
           playSound('uno');
      }

      let nextDirection = prev.direction;
      let nextActiveColor = wildColor || card.color;
      let skipNext = false;
      let stackToAdd = 0;
      let actionText = `${prev.players[playerId].name} played ${card.value}`;

      if (card.value === CardValue.Reverse) {
        nextDirection = (nextDirection * -1) as 1 | -1;
        actionText = "Reverse!";
        playSound('turn');
        if (prev.players.length === 2) skipNext = true;
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

      let nextIndex = getNextPlayerIndex(prev.currentPlayerIndex, prev.players.length, nextDirection);

      let nextState: GameState;

      if (stackToAdd > 0) {
          nextState = {
              ...prev, discardPile: [...prev.discardPile, card], players: newPlayers, 
              currentPlayerIndex: nextIndex, direction: nextDirection, activeColor: nextActiveColor, drawStack: prev.drawStack + stackToAdd
          };
      } else {
          if (skipNext) nextIndex = getNextPlayerIndex(nextIndex, prev.players.length, nextDirection);
          nextState = {
             ...prev, discardPile: [...prev.discardPile, card], players: newPlayers,
             currentPlayerIndex: nextIndex, direction: nextDirection, activeColor: nextActiveColor
          };
      }

      if (networkMode === NetworkMode.Host) mpManager.broadcast({ type: 'GAME_STATE', payload: nextState });
      return nextState;
    });
  };

  // --- Valid Move Check ---
  const hasValidMove = (() => {
    if (!gameState) return false;
    if (gameState.drawStack > 0) return false; 
    const playerHand = gameState.players[myPlayerId]?.hand;
    if (!playerHand) return false;
    const topCard = gameState.discardPile[gameState.discardPile.length - 1];
    return playerHand.some(c => isValidPlay(c, topCard, gameState.activeColor));
  })();

  const mustDraw = gameState 
    ? (gameState.currentPlayerIndex === myPlayerId && (!hasValidMove || gameState.drawStack > 0))
    : false;

  // --- Render Lobby ---
  if (!gameState) {
      const lobbyCards: any[] = [
        { id: 'l1', color: CardColor.Red, value: CardValue.DrawTwo, rot: -15, x: '10%', y: '20%', delay: '0s' },
        { id: 'l2', color: CardColor.Blue, value: CardValue.Reverse, rot: 15, x: '85%', y: '15%', delay: '1s' },
        { id: 'l3', color: CardColor.Yellow, value: CardValue.Wild, rot: -10, x: '20%', y: '80%', delay: '2s' },
      ];

      return (
          <div className="h-full w-full flex items-center justify-center bg-[#0f172a] relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(30,41,59,1)_0%,_rgba(15,23,42,1)_100%)]"></div>
            {lobbyCards.map((c) => (
               <div key={c.id} className="absolute animate-float blur-sm opacity-60"
                 style={{ left: c.x, top: c.y, '--rot': `${c.rot}deg` } as any}>
                  <CardView card={c} size="xl" className="shadow-2xl transform scale-75" />
               </div>
            ))}

            <div className="relative z-10 flex flex-col items-center animate-pop max-w-lg w-full px-4">
                <div className="relative mb-8 group cursor-default">
                    <h1 className="text-[6rem] md:text-[9rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-700 drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)] leading-none transform -rotate-3">
                      UNO
                    </h1>
                    <div className="absolute -bottom-2 md:-bottom-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-black font-black text-xl md:text-3xl px-4 py-1 transform -rotate-2 border-4 border-black shadow-xl tracking-widest">
                      MASTER
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 p-1 bg-slate-800/50 rounded-xl border border-white/10">
                    <button onClick={() => setNetworkMode(NetworkMode.Offline)} className={`px-6 py-2 rounded-lg font-bold transition-all ${networkMode === NetworkMode.Offline ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>Offline</button>
                    <button onClick={() => setNetworkMode(NetworkMode.Host)} className={`px-6 py-2 rounded-lg font-bold transition-all ${networkMode !== NetworkMode.Offline ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>Online</button>
                </div>

                {/* Mode Specific UI */}
                {networkMode === NetworkMode.Offline ? (
                    <div className="w-full bg-slate-900/50 backdrop-blur-md rounded-2xl p-6 border border-white/10 mb-6 animate-pop">
                        <h3 className="text-white/60 text-sm font-bold uppercase tracking-widest mb-4 text-center">Single Player</h3>
                        <div className="flex justify-center gap-4 mb-6">
                            {[1, 2, 3].map(count => (
                                <button key={count} onClick={() => setBotCount(count)} className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all w-20 ${botCount === count ? 'bg-red-600 text-white shadow-lg' : 'bg-white/5 text-white/50'}`}>
                                    <Users size={16} />
                                    <span className="font-bold">{count} Bot{count > 1 ? 's' : ''}</span>
                                </button>
                            ))}
                        </div>
                        <button onClick={startGame} className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-600 rounded-xl font-black text-xl shadow-lg hover:scale-105 transition-transform">START GAME</button>
                    </div>
                ) : (
                   <div className="w-full bg-slate-900/50 backdrop-blur-md rounded-2xl p-6 border border-white/10 mb-6 animate-pop">
                       <div className="flex flex-col gap-4">
                          {/* Host Section */}
                          {networkMode === NetworkMode.Host && (
                             <div className="text-center">
                                {roomCode ? (
                                    <div className="mb-4">
                                        <p className="text-white/60 text-xs font-bold uppercase mb-2">Room Code</p>
                                        <div className="flex items-center justify-center gap-2 bg-black/40 p-3 rounded-lg border border-yellow-400/30 cursor-pointer hover:bg-black/60" onClick={() => navigator.clipboard.writeText(roomCode)}>
                                            <span className="text-2xl font-mono text-yellow-400 tracking-widest">{roomCode}</span>
                                            <Copy size={16} className="text-white/40" />
                                        </div>
                                        <p className="text-green-400 text-sm mt-2 font-bold animate-pulse">
                                            {connectedPeers > 0 ? `${connectedPeers} Friend Joined!` : "Waiting for friend..."}
                                        </p>
                                    </div>
                                ) : (
                                    <button onClick={startHost} disabled={isConnecting} className="w-full py-3 bg-indigo-600 rounded-xl font-bold shadow-lg hover:bg-indigo-500 mb-4">
                                        {isConnecting ? "Creating..." : "Create Room"}
                                    </button>
                                )}
                                {roomCode && (
                                   <button onClick={startGame} className="w-full py-4 bg-green-600 rounded-xl font-black text-xl shadow-lg hover:scale-105 transition-transform">
                                       START GAME
                                   </button>
                                )}
                             </div>
                          )}

                          {/* Client Join Section */}
                          {networkMode !== NetworkMode.Host && (
                              <div className="text-center">
                                  <div className="flex gap-2 mb-4">
                                    <button onClick={() => setNetworkMode(NetworkMode.Client)} className={`flex-1 py-2 rounded-lg text-sm font-bold ${networkMode === NetworkMode.Client ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/50'}`}>Join Room</button>
                                    <button onClick={() => setNetworkMode(NetworkMode.Host)} className={`flex-1 py-2 rounded-lg text-sm font-bold ${networkMode === NetworkMode.Host ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/50'}`}>Create Room</button>
                                  </div>

                                  {networkMode === NetworkMode.Client && (
                                      <>
                                      <input 
                                        type="text" 
                                        placeholder="Enter Room Code" 
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-center font-mono text-lg mb-4 text-white focus:border-blue-500 outline-none"
                                        value={joinInput}
                                        onChange={(e) => setJoinInput(e.target.value)}
                                      />
                                      {isConnecting ? (
                                         <div className="text-yellow-400 font-bold animate-pulse">Connecting...</div>
                                      ) : (
                                         <button onClick={joinGame} className="w-full py-3 bg-blue-600 rounded-xl font-bold shadow-lg hover:scale-105 transition-transform">
                                            JOIN GAME
                                         </button>
                                      )}
                                      </>
                                  )}
                              </div>
                          )}
                       </div>
                   </div>
                )}
                
                <div className="text-white/30 text-xs font-mono">v2.0 • Multiplayer Beta</div>
            </div>
          </div>
      );
  }

  // --- Game Render ---
  return (
    <div className="h-full w-full overflow-hidden relative flex flex-col bg-[#0f172a]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(30,41,59,1)_0%,_rgba(15,23,42,1)_100%)]"></div>
      
      {/* Header */}
      <div className="absolute top-4 left-4 right-4 z-50 flex justify-between items-start">
         <button onClick={() => { mpManager.disconnect(); setGameState(null); }} className="glass-panel px-4 py-2 rounded-full text-sm font-bold hover:bg-red-500/50 transition-colors">EXIT</button>
         
         <div className="flex gap-4">
             {gameState.roomId && (
                 <div className="glass-panel px-4 py-2 rounded-full flex items-center gap-2">
                    <Wifi size={16} className="text-green-400" />
                    <span className="text-xs font-mono text-white/80">ROOM: {gameState.roomId}</span>
                 </div>
             )}
             <button onClick={() => setIsSoundEnabled(!isSoundEnabled)} className="glass-panel p-2 rounded-full hover:bg-white/20">
                {isSoundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
             </button>
         </div>
      </div>

      <GameTable 
        deckCount={gameState.deck.length}
        discardTop={gameState.discardPile[gameState.discardPile.length - 1]}
        activeColor={gameState.activeColor}
        direction={gameState.direction}
        players={gameState.players}
        currentPlayerIndex={gameState.currentPlayerIndex}
        onDrawCard={handleClientDraw}
        status={gameState.status}
        winner={gameState.winner}
        onRestart={() => setGameState(null)}
        lastAction={lastAction}
        mustDraw={mustDraw}
      />

      <PlayerHand 
        hand={gameState.players[myPlayerId]?.hand || []}
        isCurrentTurn={gameState.currentPlayerIndex === myPlayerId}
        activeColor={gameState.activeColor}
        discardTop={gameState.discardPile[gameState.discardPile.length - 1]}
        onPlayCard={handlePlayerCardClick}
        onShoutUno={() => handleShoutUno()}
        hasShoutedUno={gameState.players[myPlayerId]?.hasUno || false}
        mustDraw={mustDraw}
      />

      {/* Draw Stack Indicator */}
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
