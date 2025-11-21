
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
import { 
  Volume2, VolumeX, Play, Users, Trophy, Zap, User, Copy, Wifi, WifiOff, 
  ArrowRight, Check, Loader2, X, Trash2, Edit3, Shuffle, Download, 
  HelpCircle, Share, Smartphone, Monitor, Menu, AlertTriangle, BookOpen 
} from 'lucide-react';

const INITIAL_HAND_SIZE = 7;

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingCardPlay, setPendingCardPlay] = useState<Card | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [lastAction, setLastAction] = useState<string>("Game Start");
  const [lastActivePlayerId, setLastActivePlayerId] = useState<number | null>(null);
  
  // UI States
  const [showRules, setShowRules] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
      type: 'danger' | 'neutral';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'neutral' });

  // Ref to track latest state inside closures/callbacks
  const gameStateRef = useRef<GameState | null>(null);

  // Multiplayer State
  const [networkMode, setNetworkMode] = useState<NetworkMode>(NetworkMode.Offline);
  const [roomCode, setRoomCode] = useState<string>("");
  const [roomName, setRoomName] = useState<string>("My UNO Room");
  const [hostRoomName, setHostRoomName] = useState<string>(""); // What client sees
  const [joinInput, setJoinInput] = useState<string>("");
  const [connectedPeerCount, setConnectedPeerCount] = useState<number>(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [lobbyState, setLobbyState] = useState<'main' | 'host_setup' | 'join_setup' | 'client_waiting'>('main');
  const [kickMessage, setKickMessage] = useState<string | null>(null);
  
  // PWA State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  
  // Settings
  const [botCount, setBotCount] = useState<number>(3);
  const [enableOnlineBots, setEnableOnlineBots] = useState<boolean>(false);

  // Keep Ref updated
  useEffect(() => {
      gameStateRef.current = gameState;
  }, [gameState]);

  const playSound = (type: 'play' | 'draw' | 'uno' | 'win' | 'turn' | 'error' | 'shuffle') => {
    if (isSoundEnabled) {
      soundManager.play(type);
    }
  };

  useEffect(() => {
      // Detect iOS
      const checkIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      setIsIOS(checkIOS);

      // PWA Install Prompt Listener
      const handler = (e: any) => {
          e.preventDefault();
          setDeferredPrompt(e);
      };
      window.addEventListener('beforeinstallprompt', handler);
      
      // Offline Status Listener
      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
          window.removeEventListener('beforeinstallprompt', handler);
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
      };
  }, []);

  const handleInstallClick = async () => {
      // If the browser captured the event, try to trigger it
      if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') {
              setDeferredPrompt(null);
          } else {
              // User dismissed, show manual help just in case
              setShowInstallHelp(true);
          }
          return;
      }
      
      // Otherwise, show the manual help
      setShowInstallHelp(true);
  };

  // Initialize Multiplayer Listeners
  useEffect(() => {
    mpManager.initialize((data: NetworkMessage) => {
      
      if (networkMode === NetworkMode.Client) {
        // --- Client Logic ---
        if (data.type === 'GAME_STATE') {
          setGameState(data.payload);
          if (data.payload.lastAction) setLastAction(data.payload.lastAction);
          if ((data.payload as any).lastActivePlayerId !== undefined) {
              setLastActivePlayerId((data.payload as any).lastActivePlayerId);
          }
          playSound('turn'); 
        }
        if (data.type === 'ROOM_INFO') {
            setHostRoomName(data.payload.name);
        }
        if (data.type === 'KICKED') {
            setLobbyState('main');
            setNetworkMode(NetworkMode.Offline);
            setKickMessage("You were disconnected by the host.");
            mpManager.disconnect();
        }
      } else if (networkMode === NetworkMode.Host) {
        // --- Host Logic ---
        if (data.type === 'PLAYER_JOINED') {
           setConnectedPeerCount(data.payload.count);
           playSound('draw');
        }
        if (data.type === 'PLAYER_LEFT') {
           setConnectedPeerCount(data.payload.count);
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
  }, [networkMode, gameState]); // Re-bind when gameState changes to avoid stale closures, or rely on Ref

  // --- Hosting ---
  const startHost = async () => {
      setIsConnecting(true);
      try {
          mpManager.setRoomName(roomName);
          const id = await mpManager.hostGame();
          setRoomCode(id);
          setNetworkMode(NetworkMode.Host);
          setConnectedPeerCount(0);
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
      setKickMessage(null);
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

  const handleKickPlayer = (index: number) => {
      mpManager.kickClient(index);
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
    
    // Player 0 (Host/Local)
    players.push({ id: 0, name: networkMode === NetworkMode.Client ? 'Host' : 'You', hand: [], isBot: false, hasUno: false });

    if (networkMode === NetworkMode.Host) {
        // Add connected friends
        // Logic: We have connectedPeerCount. We assign IDs 1..N to them.
        for (let i = 0; i < connectedPeerCount; i++) {
             players.push({ id: i + 1, name: `Guest ${i + 1}`, hand: [], isBot: false, hasUno: false });
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
    setLastActivePlayerId(null);
    playSound('turn');

    // Broadcast initial state if Host
    if (networkMode === NetworkMode.Host) {
        mpManager.broadcast({ type: 'GAME_STATE', payload: { ...newGameState, lastActivePlayerId: null } });
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

  const handleColorCancel = () => {
      setPendingCardPlay(null);
      setShowColorPicker(false);
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
      if (networkMode === NetworkMode.Host) mpManager.broadcast({ type: 'GAME_STATE', payload: { ...newState, lastActivePlayerId: id } });
      return newState;
    });
    
    const currentName = gameStateRef.current?.players[id]?.name || "Player";
    setLastAction(`${currentName} shouted UNO!`);

    // Auto-hide the visual popup after 2 seconds
    setTimeout(() => {
        setGameState(prev => {
             if (!prev) return null;
             if (!prev.isUnoShouted) return prev; // Already cleared
             
             const newState = { ...prev, isUnoShouted: false };
             if (networkMode === NetworkMode.Host) {
                 mpManager.broadcast({ type: 'GAME_STATE', payload: { ...newState, lastActivePlayerId: null } });
             }
             return newState;
        });
    }, 2000);
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

      setLastActivePlayerId(playerId);
      if (networkMode === NetworkMode.Host) mpManager.broadcast({ type: 'GAME_STATE', payload: { ...nextState, lastActivePlayerId: playerId } });
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
        if (networkMode === NetworkMode.Host) mpManager.broadcast({ type: 'GAME_STATE', payload: { ...winState, lastActivePlayerId: playerId } });
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
      setLastActivePlayerId(playerId);
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

      if (networkMode === NetworkMode.Host) mpManager.broadcast({ type: 'GAME_STATE', payload: { ...nextState, lastActivePlayerId: playerId } });
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

  // --- Modal Handlers ---
  const triggerExitConfirm = () => {
      setConfirmModal({
          isOpen: true,
          title: 'Exit Game?',
          message: 'Are you sure you want to exit? All progress will be lost.',
          type: 'danger',
          onConfirm: () => {
              setGameState(null);
              setLobbyState('main');
              if (networkMode === NetworkMode.Host || networkMode === NetworkMode.Client) {
                    mpManager.disconnect();
                    setNetworkMode(NetworkMode.Offline);
              }
              setConfirmModal(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const triggerRestartConfirm = () => {
      setConfirmModal({
          isOpen: true,
          title: 'Restart Game?',
          message: 'Are you sure you want to start a new game? Current progress will be lost.',
          type: 'neutral',
          onConfirm: () => {
              startGame();
              setConfirmModal(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

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

            {/* PWA Install Help Modal - Fixed Bottom Right */}
            {showInstallHelp && (
                <div className="fixed bottom-4 right-4 max-w-xs md:max-w-md bg-slate-900/95 backdrop-blur-xl p-6 rounded-2xl border border-yellow-400/30 shadow-[0_0_50px_rgba(0,0,0,0.8)] z-[100] animate-pop">
                    <button 
                        onClick={() => setShowInstallHelp(false)} 
                        className="absolute top-2 right-2 text-white/40 hover:text-white bg-white/5 hover:bg-white/20 rounded-full p-1 transition-colors"
                    >
                        <X size={16}/>
                    </button>
                    
                    <h3 className="font-black text-yellow-400 mb-4 flex items-center gap-2 uppercase tracking-wide">
                        <Download size={20}/> How to Install
                    </h3>
                    
                    {isIOS ? (
                        <div className="text-sm text-slate-300 space-y-4">
                            <p>To install on iOS/iPad, follow these steps:</p>
                            <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg">
                                <Share className="text-blue-400 shrink-0" size={24} />
                                <span>1. Tap the <strong>Share</strong> button in your browser menu.</span>
                            </div>
                            <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg">
                                <div className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center shrink-0"><span className="text-black font-bold">+</span></div>
                                <span>2. Scroll down and tap <strong>"Add to Home Screen"</strong>.</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-slate-300 space-y-4">
                           <p className="leading-relaxed">If you don't see the install icon in the address bar, follow these manual steps:</p>
                           
                           <div className="bg-white/5 p-3 rounded-lg flex gap-3 items-start">
                                <div className="shrink-0 mt-0.5 bg-white/10 p-1 rounded">
                                    <Menu className="text-white" size={16} />
                                </div>
                                <div>
                                    <strong className="text-white block mb-1">Chrome / Edge (Desktop):</strong>
                                    Click the <strong className="text-white">Three Dots (⋮)</strong> in the top right corner &rarr; <strong>Save and Share</strong> &rarr; <strong>Install UNO Master</strong>.
                                </div>
                           </div>

                           <div className="bg-white/5 p-3 rounded-lg flex gap-3 items-start">
                                <div className="shrink-0 mt-0.5 bg-white/10 p-1 rounded">
                                    <Smartphone className="text-green-400" size={16} />
                                </div>
                                <div>
                                    <strong className="text-white block mb-1">Android (Chrome):</strong>
                                    Tap the <strong className="text-white">Three Dots (⋮)</strong> &rarr; <strong>Add to Home Screen</strong> or <strong>Install App</strong>.
                                </div>
                           </div>
                        </div>
                    )}
                </div>
            )}

            <div className="relative z-10 flex flex-col items-center animate-pop max-w-lg w-full px-4">
                
                {/* Logo Section */}
                <div className="relative mb-8 group cursor-default select-none">
                    <h1 className="text-[6rem] md:text-[9rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-700 drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)] leading-none transform -rotate-3">
                      UNO
                    </h1>
                    <div className="absolute -bottom-2 md:-bottom-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-black font-black text-xl md:text-3xl px-4 py-1 transform -rotate-2 border-4 border-black shadow-xl tracking-widest">
                      MASTER
                    </div>
                </div>

                {/* Offline Indicator */}
                {isOffline && (
                    <div className="bg-orange-500/20 border border-orange-500/50 px-3 py-1 rounded-full mb-4 flex items-center gap-2">
                        <WifiOff size={14} className="text-orange-400" />
                        <span className="text-orange-300 text-xs font-bold uppercase">Offline Mode</span>
                    </div>
                )}

                {/* Kick Message Notification */}
                {kickMessage && (
                    <div className="w-full bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-xl mb-6 flex items-center gap-2 animate-pulse">
                        <X size={20} /> {kickMessage}
                    </div>
                )}

                <div className="w-full bg-slate-900/60 backdrop-blur-xl rounded-3xl p-1 border border-white/10 shadow-2xl flex mb-6">
                    <button 
                        onClick={() => { setNetworkMode(NetworkMode.Offline); setLobbyState('main'); }} 
                        className={`flex-1 py-3 rounded-2xl font-bold text-sm uppercase tracking-wider transition-all ${networkMode === NetworkMode.Offline ? 'bg-white text-black shadow-lg' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
                    >
                        Single Player
                    </button>
                    <button 
                        onClick={() => { if (!isOffline) { setNetworkMode(NetworkMode.Host); setLobbyState('main'); } }} 
                        disabled={isOffline}
                        className={`flex-1 py-3 rounded-2xl font-bold text-sm uppercase tracking-wider transition-all ${networkMode !== NetworkMode.Offline ? 'bg-white text-black shadow-lg' : 'text-white/50 hover:text-white hover:bg-white/5'} ${isOffline ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                        
                        {/* Install Button */}
                        <div className="mt-4 flex flex-col gap-2">
                            <button 
                                onClick={handleInstallClick} 
                                className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 text-white/60 hover:text-white"
                            >
                                <Download size={18} /> {deferredPrompt ? "Install App" : "Install / Help"}
                            </button>
                        </div>
                    </div>
                ) : (
                   <div className="w-full bg-slate-900/50 backdrop-blur-md rounded-3xl p-6 border border-white/10 mb-6 animate-pop overflow-hidden relative min-h-[350px]">
                       
                       {/* Mode Selection */}
                       {lobbyState === 'main' && (
                           <div className="flex flex-col gap-4 h-full justify-center pt-4">
                               <button 
                                   onClick={() => { setLobbyState('host_setup'); }}
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
                                        <div className="w-full">
                                            <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-2">Set Room Name</p>
                                            <div className="relative mb-6">
                                                <input 
                                                    type="text"
                                                    maxLength={15}
                                                    value={roomName}
                                                    onChange={(e) => setRoomName(e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-indigo-500 transition-all"
                                                    placeholder="My Room"
                                                />
                                                <Edit3 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30" />
                                            </div>
                                            <button 
                                                onClick={startHost}
                                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2"
                                            >
                                                CREATE LOBBY
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-full text-center animate-pop">
                                            <div className="flex items-center justify-center gap-2 mb-1">
                                                 <h3 className="text-xl font-bold text-white">{roomName}</h3>
                                                 <span className="bg-indigo-500 text-xs px-2 py-0.5 rounded font-bold">HOST</span>
                                            </div>
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

                                            <div className="bg-white/5 rounded-xl p-4 mb-4 text-left">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-white/60 text-sm font-bold">Connected Players</span>
                                                    <span className="bg-blue-500/20 text-blue-300 text-xs font-bold px-2 py-0.5 rounded-full">{connectedPeerCount + 1}/4</span>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 text-white font-medium text-sm bg-white/5 p-2 rounded-lg">
                                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> You (Host)
                                                    </div>
                                                    {connectedPeerCount > 0 ? (
                                                        Array.from({ length: connectedPeerCount }).map((_, idx) => (
                                                            <div key={idx} className="flex items-center justify-between bg-white/5 p-2 rounded-lg animate-pop group">
                                                                <div className="flex items-center gap-2 text-blue-300 font-medium text-sm">
                                                                    <div className="w-2 h-2 bg-blue-400 rounded-full" /> Guest {idx + 1}
                                                                </div>
                                                                <button 
                                                                    onClick={() => handleKickPlayer(idx)}
                                                                    className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-200 hover:bg-red-500/20 p-1 rounded transition-all"
                                                                    title="Kick Player"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="text-white/20 text-sm italic pl-4 py-2">Waiting for guests...</div>
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
                                                disabled={connectedPeerCount === 0 && !enableOnlineBots}
                                                className={`w-full py-4 rounded-xl font-black text-xl transition-all flex items-center justify-center gap-2 ${connectedPeerCount > 0 || enableOnlineBots ? 'bg-gradient-to-r from-green-600 to-emerald-600 shadow-lg hover:scale-105 text-white' : 'bg-white/10 text-white/30 cursor-not-allowed'}`}
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
                               
                               {hostRoomName && <div className="text-xl font-bold text-yellow-400 mb-1">{hostRoomName}</div>}
                               
                               <p className="text-white/60 font-medium mb-8">Waiting for host to start...</p>
                               
                               <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-lg">
                                   <span className="text-xs font-bold text-white/40 uppercase">Room Code</span>
                                   <span className="font-mono font-bold text-white">{roomCode}</span>
                               </div>
                           </div>
                       )}
                   </div>
                )}

                <div className="text-center text-white/20 text-[10px] font-bold tracking-widest uppercase">
                  © 2024 UNO Master
                </div>
            </div>
          </div>
      );
  }

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 z-50 p-4 flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto flex gap-2">
            <button 
                onClick={triggerExitConfirm}
                className="bg-slate-800/80 text-white px-6 py-2 rounded-full font-bold hover:bg-red-600 hover:shadow-[0_0_15px_rgba(220,38,38,0.5)] transition-all border border-white/10 backdrop-blur-md"
            >
                EXIT
            </button>
        </div>
        
        <div className="flex items-center gap-3 pointer-events-auto">
             {/* Help / Rules Button */}
             <button 
                onClick={() => setShowRules(true)}
                className="w-10 h-10 bg-slate-800/80 rounded-full flex items-center justify-center hover:bg-white/20 transition-all border border-white/10 shadow-lg"
                title="How to Play"
             >
                <HelpCircle size={20} className="text-white" />
             </button>

             {/* Shuffle/New Game Button - Only for Host or Offline */}
             {(networkMode === NetworkMode.Offline || networkMode === NetworkMode.Host) && (
                 <button 
                    onClick={triggerRestartConfirm}
                    className="w-10 h-10 bg-slate-800/80 rounded-full flex items-center justify-center hover:bg-blue-600 hover:rotate-180 transition-all duration-500 border border-white/10 shadow-lg group"
                    title="Shuffle / New Game"
                 >
                    <Shuffle size={20} className="text-white group-hover:text-white" />
                 </button>
             )}

             <button 
                onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                className="w-10 h-10 bg-slate-800/80 rounded-full flex items-center justify-center hover:bg-white/20 transition-all border border-white/10 shadow-lg"
            >
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
        roomId={networkMode === NetworkMode.Host ? roomCode : undefined}
        myPlayerId={myPlayerId}
        lastActivePlayerId={lastActivePlayerId}
      />
      
      <PlayerHand 
        hand={gameState.players[myPlayerId].hand}
        isCurrentTurn={gameState.currentPlayerIndex === myPlayerId}
        activeColor={gameState.activeColor}
        discardTop={gameState.discardPile[gameState.discardPile.length - 1]}
        onPlayCard={handlePlayerCardClick}
        onShoutUno={handleShoutUno}
        hasShoutedUno={gameState.players[myPlayerId].hasUno}
        mustDraw={mustDraw}
      />

      {showColorPicker && (
        <ColorPicker onSelect={handleColorSelect} onCancel={handleColorCancel} />
      )}
      
      {gameState.isUnoShouted && (
          <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
              <div className="animate-pop scale-150">
                   <div className="bg-red-600 text-white font-black text-6xl px-8 py-4 rounded-3xl border-8 border-white shadow-2xl rotate-[-12deg] animate-bounce">
                       UNO!
                   </div>
              </div>
          </div>
      )}

      {/* --- Confirmation Modal --- */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-pop">
            <div className={`glass-panel p-8 rounded-3xl max-w-sm w-full mx-4 text-center border border-white/10 shadow-2xl relative ${confirmModal.type === 'danger' ? 'shadow-red-900/20' : 'shadow-blue-900/20'}`}>
                <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${confirmModal.type === 'danger' ? 'bg-red-500/20 text-red-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                    <AlertTriangle size={32} strokeWidth={2.5} />
                </div>
                
                <h3 className="text-2xl font-bold text-white mb-2">{confirmModal.title}</h3>
                <p className="text-slate-300 mb-8 leading-relaxed">{confirmModal.message}</p>
                
                <div className="flex gap-4">
                    <button 
                        onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                        className="flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wider bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={confirmModal.onConfirm}
                        className={`flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wider shadow-lg hover:scale-105 transition-all ${confirmModal.type === 'danger' ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- Rules / Help Modal --- */}
      {showRules && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-pop">
             <div className="bg-slate-900/95 border border-white/10 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden">
                 
                 {/* Header */}
                 <div className="sticky top-0 bg-slate-900/95 p-5 border-b border-white/10 flex justify-between items-center z-10 backdrop-blur-xl">
                    <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 tracking-widest flex items-center gap-3 uppercase">
                      <BookOpen className="text-yellow-400" /> Rules & Guide
                    </h2>
                    <button 
                        onClick={() => setShowRules(false)}
                        className="w-8 h-8 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-all"
                    >
                        <X size={20} />
                    </button>
                 </div>

                 {/* Content Scrollable */}
                 <div className="overflow-y-auto p-6 space-y-8 custom-scrollbar">
                     
                     {/* Section 1: Goal */}
                     <section>
                         <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                            <Trophy size={20} className="text-yellow-400" /> The Goal
                         </h3>
                         <p className="text-slate-400 leading-relaxed">
                             Be the first player to get rid of all your cards in each round. 
                             When you have one card left, you <strong className="text-red-400">MUST</strong> shout "UNO"!
                         </p>
                     </section>

                     {/* Section 2: Gameplay */}
                     <section>
                         <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                            <Play size={20} className="text-green-400" /> Gameplay
                         </h3>
                         <ul className="space-y-3 text-slate-400">
                             <li className="flex gap-3">
                                 <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2.5 shrink-0" />
                                 <span>Match the top card on the Discard Pile by <strong>Color</strong>, <strong>Number</strong>, or <strong>Symbol</strong>.</span>
                             </li>
                             <li className="flex gap-3">
                                 <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2.5 shrink-0" />
                                 <span>If you have no matches, you must <strong className="text-blue-400">Draw a Card</strong> from the deck.</span>
                             </li>
                             <li className="flex gap-3">
                                 <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2.5 shrink-0" />
                                 <span>Play moves clockwise until a Reverse card is played.</span>
                             </li>
                         </ul>
                     </section>

                     {/* Section 3: Action Cards */}
                     <section>
                         <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Zap size={20} className="text-red-400" /> Action Cards
                         </h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                 <strong className="text-white block mb-1">🚫 Skip</strong>
                                 <span className="text-slate-400 text-sm">Next player loses their turn.</span>
                             </div>
                             <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                 <strong className="text-white block mb-1">🔄 Reverse</strong>
                                 <span className="text-slate-400 text-sm">Reverses direction of play.</span>
                             </div>
                             <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                 <strong className="text-white block mb-1">✨ Wild</strong>
                                 <span className="text-slate-400 text-sm">Change the color to anything you want.</span>
                             </div>
                             <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                 <strong className="text-white block mb-1">🃏 Draw Two (+2)</strong>
                                 <span className="text-slate-400 text-sm">Next player draws 2 cards and loses turn.</span>
                             </div>
                             <div className="bg-white/5 p-4 rounded-xl border border-white/5 md:col-span-2">
                                 <strong className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-purple-400 font-black block mb-1">🌈 Wild Draw Four (+4)</strong>
                                 <span className="text-slate-400 text-sm">Change color, next player draws 4 cards and loses turn.</span>
                             </div>
                         </div>
                     </section>
                     
                     {/* Footer */}
                     <div className="pt-4 border-t border-white/10 text-center">
                         <p className="text-slate-500 text-sm italic">Tip: Save your Wild cards for when you really need them!</p>
                     </div>
                 </div>
             </div>
          </div>
      )}
    </div>
  );
};

export default App;
