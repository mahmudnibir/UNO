
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
import { Volume2, VolumeX, Play, Users, Trophy, Zap, User, Copy, Wifi, WifiOff, ArrowRight, Check, Loader2 } from 'lucide-react';

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
  const [copiedId, setCopiedId] = useState(false);
  const [lobbyState, setLobbyState] = useState<'main' | 'host_setup' | 'join_setup' | 'client_waiting'>('main');
  
  // Settings
  const [botCount, setBotCount] = useState<number>(3);
  const [enableOnlineBots, setEnableOnlineBots] = useState<boolean>(false);

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
          setGameState(data.payload);
          if (data.payload.lastAction) setLastAction(data.payload.lastAction);
          playSound('turn'); 
        }
      } else if (networkMode === NetworkMode.Host) {
        // --- Host Logic ---
        if (data.type === 'PLAYER_JOINED') {
           setConnectedPeers(prev => prev + 1);
           playSound('draw');
        }
        if (data.type === 'PLAY_CARD') {
           const { playerId, card, wildColor } = data.payload;
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
          setLobbyState('main');
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
          setLobbyState('client_waiting'); // Move to waiting screen
          playSound('play');
      } catch (e) {
          alert("Could not connect to room: " + joinInput);
          setNetworkMode(NetworkMode.Offline);
          setLobbyState('main');
      }
      setIsConnecting(false);
  };

  const handleCopyCode = () => {
      navigator.clipboard.writeText(roomCode);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
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
        // Add connected friend(s) - currently just one supported strictly, but logic supports simpler IDs
        if (connectedPeers > 0) {
            players.push({ id: 1, name: 'Friend', hand: [], isBot: false, hasUno: false });
        }
        
        // Fill rest with bots ONLY if enabled or if not enough humans
        const minPlayers = 2;
        const humans = players.length;
        const slotsToFill = enableOnlineBots ? (4 - humans) : (humans < minPlayers ? (minPlayers - humans) : 0);
        
        const botNames = ['Sarah', 'Mike', 'Jess'];
        let botIndex = 0;

        for (let i = 0; i < slotsToFill; i++) {
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
  const myPlayerId = networkMode === NetworkMode.Client ? 1 : 0; 

  const handlePlayerCardClick = (card: Card) => {
    if (!gameState) return;
    
    if (gameState.currentPlayerIndex !== myPlayerId) {
        playSound('error');
        return;
    }
    if (gameState.drawStack > 0) {
      playSound('error'); 
      setLastAction("Must draw penalty cards!");
      return;
    }

    if (networkMode === NetworkMode.Client) {
         if (card.color === CardColor.Wild) {
             setPendingCardPlay(card);
             setShowColorPicker(true);
         } else {
             mpManager.sendToHost({ type: 'PLAY_CARD', payload: { playerId: myPlayerId, card } });
         }
         return;
    }

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
      const player = prev.players[playerId];
      if (player.hand.length === 2 && !player.hasUno) {
         if (Math.random() < 0.5) { 
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
                <div className="relative mb-8 group cursor-default select-none">
                    <h1 className="text-[6rem] md:text-[9rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-700 drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)] leading-none transform -rotate-3">
                      UNO
                    </h1>
                    <div className="absolute -bottom-2 md:-bottom-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-black font-black text-xl md:text-3xl px-4 py-1 transform -rotate-2 border-4 border-black shadow-xl tracking-widest">
                      MASTER
                    </div>
                </div>

                <div className="w-full bg-slate-900/60 backdrop-blur-xl rounded-3xl p-1 border border-white/10 shadow-2xl flex mb-6">
                    <button 
                        onClick={() => { setNetworkMode(NetworkMode.Offline); setLobbyState('main'); }} 
                        className={`flex-1 py-3 rounded-2xl font-bold text-sm uppercase tracking-wider transition-all ${networkMode === NetworkMode.Offline ? 'bg-white text-black shadow-lg' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
                    >
                        Single Player
                    </button>
                    <button 
                        onClick={() => { setNetworkMode(NetworkMode.Host); setLobbyState('main'); }} 
                        className={`flex-1 py-3 rounded-2xl font-bold text-sm uppercase tracking-wider transition-all ${networkMode !== NetworkMode.Offline ? 'bg-white text-black shadow-lg' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
                    >
                        Multiplayer
                    </button>
                </div>

                {networkMode === NetworkMode.Offline ? (
                    <div className="w-full bg-slate-900/50 backdrop-blur-md rounded-3xl p-8 border border-white/10 mb-6 animate-pop">
                        <h3 className="text-white/60 text-xs font-bold uppercase tracking-widest mb-6 text-center">Choose Opponents</h3>
                        <div className="flex justify-center gap-4 mb-8">
                            {[1, 2, 3].map(count => (
                                <button key={count} onClick={() => setBotCount(count)} className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all w-24 border-2 ${botCount === count ? 'bg-red-600 border-red-400 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)] scale-110' : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'}`}>
                                    <Users size={24} />
                                    <span className="font-black text-lg">{count}</span>
                                </button>
                            ))}
                        </div>
                        <button onClick={startGame} className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl font-black text-xl shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2">
                            PLAY OFFLINE <ArrowRight size={24} />
                        </button>
                    </div>
                ) : (
                   <div className="w-full bg-slate-900/50 backdrop-blur-md rounded-3xl p-6 border border-white/10 mb-6 animate-pop overflow-hidden relative min-h-[300px]">
                       
                       {/* Mode Selection */}
                       {lobbyState === 'main' && (
                           <div className="flex flex-col gap-4 h-full justify-center pt-4">
                               <button 
                                   onClick={() => { setLobbyState('host_setup'); startHost(); }}
                                   className="group relative w-full h-24 bg-indigo-600 rounded-2xl flex items-center px-6 overflow-hidden hover:scale-105 transition-all shadow-lg border border-indigo-400/30"
                               >
                                   <div className="absolute right-0 bottom-0 opacity-20 transform translate-x-4 translate-y-4">
                                       <Wifi size={100} />
                                   </div>
                                   <div className="flex flex-col items-start z-10">
                                       <span className="text-2xl font-black text-white group-hover:text-indigo-100">HOST GAME</span>
                                       <span className="text-indigo-200 text-sm font-medium">Create a room for friends</span>
                                   </div>
                               </button>

                               <button 
                                   onClick={() => { setLobbyState('join_setup'); setNetworkMode(NetworkMode.Client); }}
                                   className="group relative w-full h-24 bg-emerald-600 rounded-2xl flex items-center px-6 overflow-hidden hover:scale-105 transition-all shadow-lg border border-emerald-400/30"
                               >
                                    <div className="absolute right-0 bottom-0 opacity-20 transform translate-x-4 translate-y-4">
                                       <Users size={100} />
                                   </div>
                                   <div className="flex flex-col items-start z-10">
                                       <span className="text-2xl font-black text-white group-hover:text-emerald-100">JOIN GAME</span>
                                       <span className="text-emerald-200 text-sm font-medium">Enter code to connect</span>
                                   </div>
                               </button>
                           </div>
                       )}

                       {/* Host Setup */}
                       {lobbyState === 'host_setup' && (
                           <div className="flex flex-col h-full">
                               <button onClick={() => setLobbyState('main')} className="self-start text-white/40 hover:text-white text-sm font-bold mb-4 flex items-center gap-1">← BACK</button>
                               
                               <div className="flex-1 flex flex-col items-center justify-center mb-4">
                                    {!roomCode ? (
                                        <div className="animate-pulse text-center">
                                            <div className="w-12 h-12 border-4 border-t-yellow-400 border-white/10 rounded-full animate-spin mx-auto mb-4"/>
                                            <p className="text-white/60 font-bold">Creating Room...</p>
                                        </div>
                                    ) : (
                                        <div className="w-full text-center animate-pop">
                                            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">Room Code</p>
                                            <div 
                                                onClick={handleCopyCode}
                                                className="bg-black/40 border-2 border-dashed border-yellow-400/30 rounded-xl p-4 mb-6 cursor-pointer hover:bg-black/60 hover:border-yellow-400 transition-all group relative"
                                            >
                                                <span className="text-3xl font-mono font-bold text-yellow-400 tracking-widest">{roomCode}</span>
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                                                    <span className="text-white font-bold flex items-center gap-2"><Copy size={16} /> CLICK TO COPY</span>
                                                </div>
                                                {copiedId && <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-green-500 text-black text-xs font-bold px-2 py-1 rounded animate-bounce">COPIED!</div>}
                                            </div>

                                            <div className="bg-white/5 rounded-xl p-4 mb-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-white/60 text-sm font-bold">Connected Players</span>
                                                    <span className="bg-blue-500/20 text-blue-300 text-xs font-bold px-2 py-0.5 rounded-full">{connectedPeers + 1}/4</span>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 text-white font-medium text-sm">
                                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> You (Host)
                                                    </div>
                                                    {connectedPeers > 0 ? (
                                                        <div className="flex items-center gap-2 text-blue-300 font-medium text-sm animate-pop">
                                                            <div className="w-2 h-2 bg-blue-400 rounded-full" /> Player 2 (Friend)
                                                        </div>
                                                    ) : (
                                                        <div className="text-white/20 text-sm italic pl-4">Waiting for friend...</div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg mb-6">
                                                <span className="text-sm font-bold text-white/80">Fill empty slots with AI?</span>
                                                <button 
                                                    onClick={() => setEnableOnlineBots(!enableOnlineBots)}
                                                    className={`w-12 h-6 rounded-full transition-colors relative ${enableOnlineBots ? 'bg-green-500' : 'bg-slate-700'}`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${enableOnlineBots ? 'left-7' : 'left-1'}`} />
                                                </button>
                                            </div>

                                            <button 
                                                onClick={startGame} 
                                                disabled={connectedPeers === 0 && !enableOnlineBots}
                                                className={`w-full py-4 rounded-xl font-black text-xl transition-all flex items-center justify-center gap-2 ${connectedPeers > 0 || enableOnlineBots ? 'bg-gradient-to-r from-green-600 to-emerald-600 shadow-lg hover:scale-105 text-white' : 'bg-white/10 text-white/30 cursor-not-allowed'}`}
                                            >
                                                START GAME
                                            </button>
                                        </div>
                                    )}
                               </div>
                           </div>
                       )}

                       {/* Join Setup */}
                       {lobbyState === 'join_setup' && (
                           <div className="flex flex-col h-full">
                               <button onClick={() => setLobbyState('main')} className="self-start text-white/40 hover:text-white text-sm font-bold mb-6 flex items-center gap-1">← BACK</button>
                               
                               <div className="flex-1 flex flex-col justify-center">
                                   <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-2 text-center">Enter Room Code</p>
                                   <input 
                                        type="text" 
                                        placeholder="e.g. a7x9b2" 
                                        className="w-full bg-black/40 border-2 border-white/10 rounded-xl px-4 py-4 text-center font-mono text-2xl mb-6 text-white focus:border-blue-500 outline-none placeholder:text-white/10 uppercase transition-all"
                                        value={joinInput}
                                        onChange={(e) => setJoinInput(e.target.value)}
                                    />
                                    
                                    {isConnecting ? (
                                         <div className="w-full py-4 bg-white/10 rounded-xl font-bold text-center text-white/50 animate-pulse flex items-center justify-center gap-2">
                                             <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Connecting...
                                         </div>
                                      ) : (
                                         <button 
                                            onClick={joinGame} 
                                            disabled={!joinInput}
                                            className={`w-full py-4 rounded-xl font-black text-xl shadow-lg transition-all flex items-center justify-center gap-2 ${joinInput ? 'bg-blue-600 hover:bg-blue-500 hover:scale-105 text-white' : 'bg-white/10 text-white/30'}`}
                                         >
                                            JOIN ROOM
                                         </button>
                                      )}
                               </div>
                           </div>
                       )}
                       
                       {/* Client Waiting Room */}
                       {lobbyState === 'client_waiting' && (
                           <div className="flex flex-col h-full items-center justify-center animate-pop">
                               <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,197,94,0.6)] animate-bounce">
                                   <Check size={40} className="text-black" strokeWidth={4} />
                               </div>
                               <h2 className="text-3xl font-black text-white mb-2 tracking-wide">CONNECTED!</h2>
                               <p className="text-white/60 font-medium mb-8">Waiting for host to start...</p>
                               
                               <div className="bg-white/5 rounded-xl p-6 border border-white/10 text-center w-full max-w-xs relative overflow-hidden">
                                   <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">ROOM CODE</p>
                                   <div className="text-4xl font-mono font-bold text-yellow-400 tracking-widest relative z-10">{roomCode}</div>
                                   <div className="absolute inset-0 bg-white/5 animate-pulse pointer-events-none" />
                               </div>
                               
                               <div className="mt-8 flex items-center gap-2 text-white/40 text-sm font-mono">
                                    <Loader2 className="animate-spin" size={16} /> SYNCING WITH HOST...
                               </div>
                               
                               <button onClick={() => { mpManager.disconnect(); setLobbyState('join_setup'); setNetworkMode(NetworkMode.Offline); }} className="mt-8 text-white/30 hover:text-white text-sm font-bold uppercase tracking-wider transition-colors">
                                   Cancel & Leave
                               </button>
                           </div>
                       )}

                   </div>
                )}
                
                <div className="text-white/30 text-xs font-mono">v2.1 • Multiplayer Beta</div>
            </div>
          </div>
      );
  }

  return (
    <div className="h-full w-full overflow-hidden relative flex flex-col bg-[#0f172a]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(30,41,59,1)_0%,_rgba(15,23,42,1)_100%)]"></div>
      
      <div className="absolute top-4 left-4 right-4 z-50 flex justify-between items-start">
         <button onClick={() => { mpManager.disconnect(); setGameState(null); setLobbyState('main'); setNetworkMode(NetworkMode.Offline); }} className="glass-panel px-4 py-2 rounded-full text-sm font-bold hover:bg-red-500/50 transition-colors">EXIT</button>
         
         <div className="flex gap-4">
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
        roomId={gameState.roomId}
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
