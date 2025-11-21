
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
  HelpCircle, Share, Smartphone, Monitor, Menu, AlertTriangle, BookOpen, Mail 
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
          <div className="h-full w-full flex flex-col items-center justify-center bg-[#0f172a] relative overflow-hidden">
            {/* Background Elements (Cards, gradients) */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(51,65,85,0.4)_0%,_rgba(15,23,42,1)_100%)]"></div>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
            
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

            {/* Main Content Wrapper */}
            <div className="relative z-10 w-full max-w-md px-6 py-8 flex flex-col items-center h-full md:h-auto justify-center">
               
               {/* Logo with better animation */}
               <div className="relative mb-12 group cursor-default select-none animate-float">
                  <div className="absolute inset-0 bg-red-500 blur-[60px] opacity-20 rounded-full"></div>
                  <h1 className="text-[5rem] md:text-[7rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-700 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] leading-none transform -rotate-6 relative z-10">
                    UNO
                  </h1>
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-black text-xl tracking-[0.5em] px-6 py-1 transform -rotate-3 skew-x-12 shadow-xl border-2 border-white/20 z-20 whitespace-nowrap">
                    MASTER
                  </div>
               </div>

               {/* Offline Tag */}
               {isOffline && (
                    <div className="bg-orange-500/20 border border-orange-500/50 px-3 py-1 rounded-full mb-4 flex items-center gap-2 absolute top-4 right-4 md:relative md:top-auto md:right-auto">
                        <WifiOff size={14} className="text-orange-400" />
                        <span className="text-orange-300 text-xs font-bold uppercase">Offline Mode</span>
                    </div>
               )}

               {/* Kick Message Notification */}
               {kickMessage && (
                   <div className="w-full bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-xl mb-6 flex items-center gap-2 animate-pulse absolute top-20 md:relative md:top-auto">
                       <X size={20} /> {kickMessage}
                   </div>
               )}

               {/* MENU CARD */}
               <div className="w-full bg-slate-900/70 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden ring-1 ring-white/5">
                  
                  {/* TABS */}
                  <div className="flex p-2 gap-2 bg-black/20">
                     <button 
                       onClick={() => { setNetworkMode(NetworkMode.Offline); setLobbyState('main'); }}
                       className={`flex-1 py-3 rounded-xl font-black text-xs md:text-sm uppercase tracking-widest transition-all duration-300 ${networkMode === NetworkMode.Offline ? 'bg-white text-slate-900 shadow-lg scale-100' : 'text-white/40 hover:bg-white/5 hover:text-white scale-95'}`}
                     >
                       Single Player
                     </button>
                     <button 
                       onClick={() => { if(!isOffline) { setNetworkMode(NetworkMode.Host); setLobbyState('main'); }}}
                       disabled={isOffline}
                       className={`flex-1 py-3 rounded-xl font-black text-xs md:text-sm uppercase tracking-widest transition-all duration-300 ${networkMode !== NetworkMode.Offline ? 'bg-white text-slate-900 shadow-lg scale-100' : 'text-white/40 hover:bg-white/5 hover:text-white scale-95'} ${isOffline ? 'opacity-30 cursor-not-allowed' : ''}`}
                     >
                       Multiplayer
                     </button>
                  </div>

                  {/* CONTENT BODY */}
                  <div className="p-6 relative min-h-[320px] flex flex-col">
                     
                     {/* SINGLE PLAYER VIEW */}
                     {networkMode === NetworkMode.Offline && (
                        <div className="flex-1 flex flex-col animate-pop">
                            <div className="text-center mb-8">
                               <h3 className="text-white/90 text-lg font-bold mb-1">Select Opponents</h3>
                               <p className="text-white/40 text-xs uppercase tracking-widest">Challenge AI Bots</p>
                            </div>

                            <div className="grid grid-cols-3 gap-4 mb-auto">
                               {[1, 2, 3].map(num => (
                                  <button 
                                    key={num} 
                                    onClick={() => setBotCount(num)}
                                    className={`relative aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all duration-300 group ${botCount === num ? 'bg-red-600/20 border-red-500 shadow-[0_0_30px_rgba(220,38,38,0.3)]' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
                                  >
                                     {botCount === num && <div className="absolute inset-0 bg-red-500/10 animate-pulse rounded-2xl"></div>}
                                     <Users size={28} className={botCount === num ? 'text-red-400' : 'text-white/20 group-hover:text-white/60'} />
                                     <span className={`font-black text-2xl ${botCount === num ? 'text-white' : 'text-white/40'}`}>{num}</span>
                                  </button>
                               ))}
                            </div>

                            <button 
                              onClick={startGame}
                              className="w-full py-5 bg-gradient-to-r from-red-600 to-orange-600 rounded-xl font-black text-xl text-white shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group mt-6"
                            >
                               <span>START GAME</span>
                               <Play size={24} fill="currentColor" className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                     )}

                     {/* MULTIPLAYER VIEW */}
                     {networkMode !== NetworkMode.Offline && (
                        <div className="flex-1 flex flex-col h-full animate-pop">
                           {/* Modes: Main, Host, Join, Lobby */}
                           {lobbyState === 'main' && (
                              <div className="flex flex-col gap-4 h-full justify-center">
                                 <button 
                                   onClick={() => setLobbyState('host_setup')}
                                   className="group relative w-full p-6 bg-gradient-to-br from-indigo-600/20 to-indigo-900/20 border border-indigo-500/30 hover:border-indigo-400 rounded-2xl flex items-center gap-4 transition-all hover:shadow-[0_0_30px_rgba(99,102,241,0.3)] hover:-translate-y-1"
                                 >
                                    <div className="w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                       <Wifi size={28} className="text-white" />
                                    </div>
                                    <div className="text-left">
                                       <h3 className="text-white font-black text-xl tracking-wide">HOST GAME</h3>
                                       <p className="text-indigo-200/60 text-xs font-bold uppercase">Create a room</p>
                                    </div>
                                 </button>

                                 <button 
                                   onClick={() => { setLobbyState('join_setup'); setNetworkMode(NetworkMode.Client); }}
                                   className="group relative w-full p-6 bg-gradient-to-br from-emerald-600/20 to-emerald-900/20 border border-emerald-500/30 hover:border-emerald-400 rounded-2xl flex items-center gap-4 transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:-translate-y-1"
                                 >
                                    <div className="w-14 h-14 rounded-full bg-emerald-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                       <Users size={28} className="text-white" />
                                    </div>
                                    <div className="text-left">
                                       <h3 className="text-white font-black text-xl tracking-wide">JOIN GAME</h3>
                                       <p className="text-emerald-200/60 text-xs font-bold uppercase">Enter Code</p>
                                    </div>
                                 </button>
                              </div>
                           )}

                           {/* Host Setup Screen */}
                           {lobbyState === 'host_setup' && (
                              <div className="flex flex-col h-full">
                                  {/* Header */}
                                  <div className="flex items-center justify-between mb-6">
                                     <button onClick={() => setLobbyState('main')} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
                                        <ArrowRight size={16} className="rotate-180" />
                                     </button>
                                     <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Lobby Settings</span>
                                     <div className="w-8" />
                                  </div>

                                  {!roomCode ? (
                                      <div className="flex-1 flex flex-col justify-center">
                                          <div className="mb-8 text-center">
                                              <div className="w-20 h-20 bg-indigo-600/20 rounded-full mx-auto mb-4 flex items-center justify-center border border-indigo-500/50 text-indigo-400">
                                                  <Edit3 size={32} />
                                              </div>
                                              <h3 className="text-white font-bold text-xl">Name Your Room</h3>
                                          </div>
                                          
                                          <input 
                                            value={roomName}
                                            onChange={(e) => setRoomName(e.target.value)}
                                            className="w-full bg-black/30 border-2 border-white/10 focus:border-indigo-500 rounded-xl p-4 text-center text-white font-bold text-lg outline-none transition-all mb-6"
                                            placeholder="e.g. Friday Night UNO"
                                            maxLength={15}
                                          />

                                          <button 
                                            onClick={startHost}
                                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-black text-lg text-white shadow-lg transition-all flex items-center justify-center gap-2"
                                          >
                                              CREATE ROOM
                                          </button>
                                      </div>
                                  ) : (
                                      <div className="flex-1 flex flex-col">
                                          <div className="bg-black/40 rounded-xl p-4 border border-white/10 mb-6 relative group cursor-pointer" onClick={handleCopyCode}>
                                              <div className="text-center">
                                                  <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">Room Code</p>
                                                  <p className="text-3xl font-mono font-bold text-yellow-400 tracking-widest">{roomCode}</p>
                                              </div>
                                              {copiedId && <div className="absolute inset-0 bg-green-500/90 flex items-center justify-center rounded-xl animate-in fade-in duration-200"><span className="font-black text-black">COPIED!</span></div>}
                                              <div className="absolute inset-0 border-2 border-dashed border-white/10 group-hover:border-yellow-400/50 rounded-xl transition-colors pointer-events-none"></div>
                                          </div>

                                          <div className="flex-1 bg-white/5 rounded-xl p-4 mb-4 overflow-y-auto custom-scrollbar">
                                              <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-3">Players ({connectedPeerCount + 1}/4)</p>
                                              
                                              {/* Host */}
                                              <div className="flex items-center gap-3 p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20 mb-2">
                                                  <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_10px_currentColor]"></div>
                                                  <span className="text-white font-bold text-sm flex-1">You (Host)</span>
                                                  <Zap size={14} className="text-yellow-400" />
                                              </div>

                                              {/* Guests */}
                                              {Array.from({ length: connectedPeerCount }).map((_, i) => (
                                                  <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/5 mb-2 animate-in slide-in-from-left-2">
                                                      <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                                      <span className="text-white/80 font-medium text-sm flex-1">Guest {i + 1}</span>
                                                      <button onClick={() => handleKickPlayer(i)} className="text-white/20 hover:text-red-400 transition-colors"><X size={14} /></button>
                                                  </div>
                                              ))}

                                              {/* Empty Slots */}
                                              {Array.from({ length: 3 - connectedPeerCount }).map((_, i) => (
                                                  <div key={`empty-${i}`} className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-white/5 mb-2 opacity-50">
                                                      <div className="w-2 h-2 rounded-full bg-white/10"></div>
                                                      <span className="text-white/20 font-medium text-sm italic">Waiting...</span>
                                                  </div>
                                              ))}
                                          </div>
                                          
                                          <div className="flex items-center justify-between mb-4 px-2">
                                              <span className="text-xs font-bold text-white/60 uppercase">Fill with Bots?</span>
                                              <button onClick={() => setEnableOnlineBots(!enableOnlineBots)} className={`w-10 h-6 rounded-full relative transition-colors ${enableOnlineBots ? 'bg-green-500' : 'bg-white/10'}`}>
                                                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${enableOnlineBots ? 'left-5' : 'left-1'}`}></div>
                                              </button>
                                          </div>

                                          <button 
                                              onClick={startGame}
                                              disabled={connectedPeerCount === 0 && !enableOnlineBots}
                                              className={`w-full py-4 rounded-xl font-black text-lg transition-all flex items-center justify-center gap-2 ${connectedPeerCount > 0 || enableOnlineBots ? 'bg-green-500 text-black hover:bg-green-400 shadow-[0_0_20px_rgba(34,197,94,0.4)]' : 'bg-white/10 text-white/20 cursor-not-allowed'}`}
                                          >
                                              START GAME
                                          </button>
                                      </div>
                                  )}
                              </div>
                           )}

                           {/* Join Setup Screen */}
                           {lobbyState === 'join_setup' && (
                               <div className="flex flex-col h-full">
                                  <div className="flex items-center justify-between mb-8">
                                     <button onClick={() => setLobbyState('main')} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
                                        <ArrowRight size={16} className="rotate-180" />
                                     </button>
                                     <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Join Room</span>
                                     <div className="w-8" />
                                  </div>

                                  <div className="flex-1 flex flex-col justify-center items-center text-center">
                                      <div className="mb-8">
                                          <div className="w-20 h-20 bg-emerald-600/20 rounded-full mx-auto mb-4 flex items-center justify-center border border-emerald-500/50 text-emerald-400 animate-pulse">
                                              <Wifi size={32} />
                                          </div>
                                          <p className="text-white/60 text-sm">Enter the 6-character code from the host</p>
                                      </div>

                                      <input 
                                        value={joinInput}
                                        onChange={(e) => setJoinInput(e.target.value)}
                                        className="w-full bg-black/30 border-2 border-white/10 focus:border-emerald-500 rounded-xl p-5 text-center text-white font-mono font-bold text-3xl outline-none transition-all mb-8 placeholder:text-white/5 uppercase tracking-widest"
                                        placeholder="CODE"
                                        maxLength={10}
                                      />

                                      <button 
                                        onClick={joinGame}
                                        disabled={!joinInput || isConnecting}
                                        className={`w-full py-4 rounded-xl font-black text-lg transition-all flex items-center justify-center gap-2 ${joinInput && !isConnecting ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg' : 'bg-white/10 text-white/20 cursor-not-allowed'}`}
                                      >
                                          {isConnecting ? <Loader2 size={24} className="animate-spin" /> : 'JOIN LOBBY'}
                                      </button>
                                  </div>
                               </div>
                           )}

                           {/* Waiting Screen */}
                           {lobbyState === 'client_waiting' && (
                               <div className="flex flex-col h-full items-center justify-center text-center">
                                   <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(34,197,94,0.5)] animate-bounce">
                                      <Check size={48} className="text-white drop-shadow-md" strokeWidth={4} />
                                   </div>
                                   <h2 className="text-3xl font-black text-white mb-2 tracking-tight">YOU'RE IN!</h2>
                                   <p className="text-emerald-200 mb-8 font-medium">Waiting for host to start...</p>
                                   
                                   <div className="bg-white/5 rounded-xl p-4 w-full border border-white/5">
                                       <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-1">Connected to Room</p>
                                       <p className="text-xl font-mono font-bold text-white">{roomCode}</p>
                                       {hostRoomName && <p className="text-sm text-emerald-400 font-bold mt-1">{hostRoomName}</p>}
                                   </div>
                               </div>
                           )}

                        </div>
                     )}

                  </div>
               </div>

               {/* Footer Links */}
               <div className="mt-8 flex items-center gap-4 opacity-60 hover:opacity-100 transition-opacity">
                   <a href="mailto:nibirbbkr@gmail.com" className="text-white/60 hover:text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><Mail size={14} /></div>
                      Contact
                   </a>
                   <div className="w-1 h-1 bg-white/20 rounded-full"></div>
                   <button onClick={handleInstallClick} className="text-white/60 hover:text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><Download size={14} /></div>
                      Install
                   </button>
               </div>

               <div className="mt-6 text-white/20 text-[10px] font-bold tracking-[0.2em] uppercase">
                  © 2025 Nibir. All rights reserved.
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
