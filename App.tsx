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
  HelpCircle, Share, Smartphone, Monitor, Menu, AlertTriangle, BookOpen, Mail, Clipboard, Bot,
  ShoppingBag, Gift, Star, Award
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
  const [wakeLock, setWakeLock] = useState<any>(null);
  
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

  // Wake Lock Manager to prevent screen sleep during multiplayer
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        setWakeLock(lock);
        console.log('Screen Wake Lock active');
      } catch (err) {
        console.log('Wake Lock error:', err);
      }
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLock) {
      try {
        await wakeLock.release();
        setWakeLock(null);
        console.log('Screen Wake Lock released');
      } catch (e) {
        console.log('Error releasing lock', e);
      }
    }
  };

  useEffect(() => {
      // Cleanup wake lock on unmount
      return () => {
          if (wakeLock) wakeLock.release();
      };
  }, [wakeLock]);

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
            handleBackToLobby();
            setKickMessage("You were disconnected by the host.");
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

  // --- Navigation Logic ---
  const handleBackToLobby = () => {
      mpManager.disconnect();
      releaseWakeLock(); // Allow screen to sleep again
      setRoomCode("");
      setHostRoomName("");
      setConnectedPeerCount(0);
      setJoinInput("");
      setKickMessage(null);
      setLobbyState('main');
      // We don't necessarily change networkMode to offline here immediately if we are just navigating panels,
      // but usually going back to main menu means exiting multiplayer setup.
      setNetworkMode(NetworkMode.Offline);
      setEnableOnlineBots(false);
  };

  // --- Hosting ---
  const startHost = async () => {
      setIsConnecting(true);
      try {
          mpManager.setRoomName(roomName);
          const id = await mpManager.hostGame();
          setRoomCode(id);
          setNetworkMode(NetworkMode.Host);
          setConnectedPeerCount(0);
          requestWakeLock(); // Keep screen on for host
      } catch (e) {
          alert("Failed to host game. PeerJS server might be busy.");
          handleBackToLobby();
      }
      setIsConnecting(false);
  };

  // --- Joining ---
  const joinGame = async () => {
      if (!joinInput) return;
      const code = joinInput.trim().toUpperCase();
      setIsConnecting(true);
      setKickMessage(null);
      try {
          await mpManager.joinGame(code); 
          setNetworkMode(NetworkMode.Client);
          setRoomCode(code);
          setLobbyState('client_waiting'); // Move to waiting screen
          requestWakeLock(); // Keep screen on for client
          playSound('play');
      } catch (e: any) {
          // Show specific error from mpManager (timeout or peer-unavailable)
          alert(e.message || "Could not connect to room: " + code);
          handleBackToLobby();
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

  const handleShareCode = async () => {
      if (navigator.share) {
          try {
              await navigator.share({
                  title: 'Join my UNO Master Game!',
                  text: `Join my UNO room with code: ${roomCode}`,
              });
          } catch (err) { console.log('Share failed', err); }
      } else {
          handleCopyCode();
      }
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

    const newGameState: GameState = {
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
              handleBackToLobby();
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
        { id: 'l4', color: CardColor.Green, value: CardValue.Skip, rot: 5, x: '80%', y: '75%', delay: '1.5s' },
      ];

      return (
          <div className="fixed inset-0 bg-[#0f172a] overflow-hidden flex flex-col font-sans select-none">
            {/* --- Cinematic Background Layers --- */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                {/* Deep Gradient Base */}
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-[#0f172a] to-black"></div>
                
                {/* Animated Glow Orbs */}
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }}></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '10s' }}></div>

                {/* Grid Pattern */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>
                
                {/* Floating 3D Cards (Desktop Only) */}
                <div className="hidden lg:block">
                    {lobbyCards.map((c) => (
                    <div key={c.id} className="absolute animate-float transition-all duration-1000 ease-in-out"
                        style={{ left: c.x, top: c.y, animationDelay: c.delay, '--rot': `${c.rot}deg` } as any}>
                        <div className="transform hover:scale-110 transition-transform duration-500 hover:rotate-12">
                             <CardView card={c} size="xl" className="shadow-[0_20px_50px_rgba(0,0,0,0.5)] brightness-75" />
                        </div>
                    </div>
                    ))}
                </div>
            </div>

            {/* PWA Install Help Modal */}
            {showInstallHelp && (
                <div className="fixed bottom-4 right-4 max-w-[calc(100vw-2rem)] md:max-w-md bg-slate-900/95 backdrop-blur-xl p-6 rounded-2xl border border-yellow-400/30 shadow-[0_0_50px_rgba(0,0,0,0.8)] z-[100] animate-pop">
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

            {/* --- UI Content --- */}
            
            {/* Header Bar */}
            <div className="relative z-20 w-full px-4 py-3 flex justify-between items-center bg-slate-900/50 backdrop-blur-md border-b border-white/5 shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-400 to-orange-500 border-2 border-white/20 shadow-lg flex items-center justify-center overflow-hidden">
                        <User size={20} className="text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-white font-bold text-sm leading-none">Guest Player</span>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 rounded font-bold border border-blue-500/20 tracking-wider">LVL 5</div>
                            <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden border border-white/5">
                                <div className="w-[60%] h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="hidden md:flex items-center gap-1.5 bg-slate-800/80 px-3 py-1 rounded-full border border-white/5 hover:bg-slate-800 transition-colors">
                        <div className="w-4 h-4 rounded-full bg-yellow-400 border border-yellow-200 shadow-[0_0_10px_rgba(250,204,21,0.5)]"></div>
                        <span className="text-white font-bold text-xs tracking-wide">1,250</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1 rounded-full border border-white/5 hover:bg-slate-800 transition-colors">
                        <div className="w-4 h-4 rounded-full bg-purple-500 border border-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
                        <span className="text-white font-bold text-xs tracking-wide">50</span>
                    </div>
                </div>
            </div>

            {/* Scrollable Main Area */}
            <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
                <div className="max-w-4xl mx-auto flex flex-col items-center gap-8 pb-24">
                
                    {/* Status Messages */}
                    {kickMessage && (
                        <div className="w-full max-w-lg bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-5">
                            <X size={18} /> {kickMessage}
                            <button onClick={() => setKickMessage(null)} className="ml-auto hover:text-white"><X size={14} /></button>
                        </div>
                    )}

                    {/* Logo Section */}
                    <div className="mt-2 md:mt-6 flex flex-col items-center group scale-90 md:scale-100 transition-transform">
                        <div className="flex items-center justify-center -space-x-4 md:-space-x-8 relative z-10">
                            <div className="w-16 h-24 md:w-32 md:h-44 bg-gradient-to-br from-red-500 to-red-700 rounded-2xl md:rounded-3xl shadow-lg border-4 border-white/10 flex items-center justify-center transform -rotate-12 hover:-rotate-6 transition-transform duration-300 origin-bottom-right group-hover:-translate-y-2">
                                <span className="text-5xl md:text-9xl font-black text-white drop-shadow-md italic font-outline-2">U</span>
                            </div>
                            <div className="w-16 h-24 md:w-32 md:h-44 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl md:rounded-3xl shadow-lg border-4 border-white/10 flex items-center justify-center transform -translate-y-4 hover:-translate-y-8 transition-transform duration-300 z-20">
                                <span className="text-5xl md:text-9xl font-black text-white drop-shadow-md italic">N</span>
                            </div>
                            <div className="w-16 h-24 md:w-32 md:h-44 bg-gradient-to-br from-green-500 to-green-700 rounded-2xl md:rounded-3xl shadow-lg border-4 border-white/10 flex items-center justify-center transform rotate-12 hover:rotate-6 transition-transform duration-300 origin-bottom-left group-hover:-translate-y-2">
                                <span className="text-5xl md:text-9xl font-black text-white drop-shadow-md italic">O</span>
                            </div>
                        </div>
                        <div className="absolute -bottom-4 md:-bottom-6 bg-white text-slate-950 font-black text-[10px] md:text-base tracking-[0.5em] px-6 md:px-8 py-2 md:py-3 rounded-full shadow-[0_10px_20px_rgba(0,0,0,0.3)] z-30 border-4 border-slate-900 transform skew-x-[-10deg]">
                            MASTER
                        </div>
                    </div>

                    {/* MAIN INTERFACE CARD */}
                    <div className="w-full max-w-lg bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-pop ring-1 ring-white/5">
                        
                        {/* Mode Toggle (Tabs) */}
                        <div className="p-2 bg-black/20">
                            <div className="relative flex bg-black/40 rounded-2xl p-1">
                                <button 
                                    onClick={() => { handleBackToLobby(); }}
                                    className={`flex-1 py-3 md:py-4 rounded-xl font-black text-xs md:text-sm uppercase tracking-wider transition-all duration-300 relative z-10 flex items-center justify-center gap-2 ${networkMode === NetworkMode.Offline ? 'bg-slate-800 text-white shadow-lg ring-1 ring-white/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                                >
                                    <User size={16} md:size={18} /> Solo
                                </button>
                                <button 
                                    onClick={() => { if(!isOffline) { setNetworkMode(NetworkMode.Host); setLobbyState('main'); }}}
                                    disabled={isOffline}
                                    className={`flex-1 py-3 md:py-4 rounded-xl font-black text-xs md:text-sm uppercase tracking-wider transition-all duration-300 relative z-10 flex items-center justify-center gap-2 ${networkMode !== NetworkMode.Offline ? 'bg-indigo-600 text-white shadow-lg ring-1 ring-white/10' : 'text-white/40 hover:text-white hover:bg-white/5'} ${isOffline ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <Wifi size={16} md:size={18} /> Online
                                </button>
                            </div>
                        </div>

                        {/* Dynamic Content Area */}
                        <div className="p-6 md:p-8 flex flex-col relative min-h-[300px]">
                            
                            {/* --- SINGLE PLAYER CONTENT --- */}
                            {networkMode === NetworkMode.Offline && (
                            <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="text-center mb-6">
                                        <h2 className="text-xl md:text-2xl font-black text-white mb-1">VS COMPUTER</h2>
                                        <p className="text-white/40 text-xs md:text-sm font-medium">Select opponent count</p>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-3 mb-6">
                                        {[1, 2, 3].map(num => (
                                            <button 
                                                key={num}
                                                onClick={() => setBotCount(num)}
                                                className={`group relative aspect-[3/4] rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-2 overflow-hidden ${botCount === num ? 'bg-gradient-to-b from-red-500/20 to-red-900/20 border-red-500 shadow-[0_0_30px_rgba(220,38,38,0.3)] scale-105' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'}`}
                                            >
                                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-colors ${botCount === num ? 'bg-red-500 text-white' : 'bg-white/10 text-white/30 group-hover:text-white'}`}>
                                                    <Bot size={20} md:size={24} />
                                                </div>
                                                <div className="text-center">
                                                    <span className={`block text-xl md:text-2xl font-black ${botCount === num ? 'text-white' : 'text-white/30 group-hover:text-white'}`}>{num}</span>
                                                    <span className="text-[10px] uppercase font-bold text-white/20 group-hover:text-white/40">Bots</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    <button 
                                        onClick={startGame}
                                        className="mt-auto w-full py-4 md:py-5 rounded-2xl bg-gradient-to-r from-red-600 to-orange-600 text-white font-black text-lg md:text-xl tracking-widest shadow-lg hover:shadow-red-600/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group relative overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                                        <span>PLAY NOW</span>
                                        <Play size={20} md:size={24} fill="currentColor" />
                                    </button>
                            </div>
                            )}

                            {/* --- MULTIPLAYER CONTENT --- */}
                            {networkMode !== NetworkMode.Offline && (
                                <div className="flex flex-col h-full w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {lobbyState === 'main' && (
                                        <div className="flex flex-col gap-4 h-full justify-center">
                                            <button 
                                                onClick={() => setLobbyState('host_setup')}
                                                className="group relative p-4 md:p-6 bg-gradient-to-br from-indigo-900/50 to-slate-900 border border-indigo-500/30 hover:border-indigo-400 rounded-2xl flex items-center gap-4 transition-all hover:shadow-[0_0_40px_rgba(99,102,241,0.2)] hover:-translate-y-1"
                                            >
                                                <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform shrink-0 text-white">
                                                    <Monitor size={24} md:size={32} />
                                                </div>
                                                <div className="text-left">
                                                    <h3 className="text-white font-black text-lg md:text-xl tracking-wide">CREATE ROOM</h3>
                                                    <p className="text-indigo-200/60 text-[10px] md:text-xs font-bold uppercase mt-1">Host a match for friends</p>
                                                </div>
                                                <ArrowRight className="ml-auto text-white/20 group-hover:text-white transition-colors" />
                                            </button>

                                            <button 
                                                onClick={() => { setLobbyState('join_setup'); setNetworkMode(NetworkMode.Client); }}
                                                className="group relative p-4 md:p-6 bg-gradient-to-br from-emerald-900/50 to-slate-900 border border-emerald-500/30 hover:border-emerald-400 rounded-2xl flex items-center gap-4 transition-all hover:shadow-[0_0_40px_rgba(16,185,129,0.2)] hover:-translate-y-1"
                                            >
                                                <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform shrink-0 text-white">
                                                    <Users size={24} md:size={32} />
                                                </div>
                                                <div className="text-left">
                                                    <h3 className="text-white font-black text-lg md:text-xl tracking-wide">JOIN ROOM</h3>
                                                    <p className="text-emerald-200/60 text-[10px] md:text-xs font-bold uppercase mt-1">Enter code to connect</p>
                                                </div>
                                                <ArrowRight className="ml-auto text-white/20 group-hover:text-white transition-colors" />
                                            </button>
                                        </div>
                                    )}

                                    {lobbyState === 'host_setup' && (
                                        <div className="flex flex-col h-full">
                                            <div className="flex items-center mb-4">
                                                <button onClick={handleBackToLobby} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors">
                                                    <ArrowRight size={16} className="rotate-180" />
                                                </button>
                                                <span className="ml-3 text-white/40 text-xs font-bold uppercase tracking-widest">Setup Room</span>
                                            </div>

                                            {!roomCode ? (
                                                <div className="flex-1 flex flex-col justify-center">
                                                    <div className="mb-6">
                                                        <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider ml-1 block mb-2">Room Name</label>
                                                        <input 
                                                            value={roomName}
                                                            onChange={(e) => setRoomName(e.target.value)}
                                                            className="w-full bg-black/40 border border-white/10 focus:border-indigo-500 focus:bg-black/60 rounded-xl p-4 text-white font-bold text-lg outline-none transition-all placeholder:text-white/10"
                                                            placeholder="e.g. Friday Night UNO"
                                                            maxLength={15}
                                                        />
                                                    </div>

                                                    <button 
                                                        onClick={startHost}
                                                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-black text-lg text-white shadow-lg hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 active:scale-95"
                                                    >
                                                        {isConnecting ? <Loader2 className="animate-spin" /> : 'GENERATE CODE'}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col h-full">
                                                    <div className="bg-black/40 rounded-xl p-4 border border-white/10 mb-4 text-center relative group cursor-pointer" onClick={handleCopyCode}>
                                                        <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-1">Share this Code</p>
                                                        <p className="text-4xl font-mono font-black text-yellow-400 tracking-[0.1em]">{roomCode}</p>
                                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 p-2 rounded-lg">
                                                            <Copy size={16} className="text-white" />
                                                        </div>
                                                        {copiedId && <div className="absolute inset-0 bg-green-500/90 flex items-center justify-center rounded-xl z-10 font-bold text-black">COPIED!</div>}
                                                    </div>

                                                    <div className="flex-1 bg-white/5 rounded-xl p-4 mb-4 overflow-y-auto custom-scrollbar">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Lobby ({connectedPeerCount + 1}/4)</span>
                                                            
                                                        </div>
                                                        
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-3 p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                                                                <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]"></div>
                                                                <span className="text-white font-bold text-sm flex-1">You (Host)</span>
                                                                <Zap size={14} className="text-yellow-400" />
                                                            </div>

                                                            {Array.from({ length: connectedPeerCount }).map((_, i) => (
                                                                <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/5 animate-in slide-in-from-left-2">
                                                                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                                                    <span className="text-white/80 font-medium text-sm flex-1">Guest {i + 1}</span>
                                                                    <button onClick={() => handleKickPlayer(i)} className="text-white/20 hover:text-red-400 transition-colors p-1 hover:bg-white/5 rounded"><X size={14} /></button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center justify-between mb-4 px-1">
                                                        <span className="text-xs font-bold text-white/60 uppercase">Fill Empty Slots with Bots</span>
                                                        <button onClick={() => setEnableOnlineBots(!enableOnlineBots)} className={`w-12 h-7 rounded-full relative transition-colors border border-white/10 ${enableOnlineBots ? 'bg-green-500' : 'bg-black/40'}`}>
                                                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${enableOnlineBots ? 'left-6' : 'left-1'}`}></div>
                                                        </button>
                                                    </div>

                                                    <button 
                                                        onClick={startGame}
                                                        disabled={connectedPeerCount === 0 && !enableOnlineBots}
                                                        className={`w-full py-4 rounded-xl font-black text-lg transition-all flex items-center justify-center gap-2 ${connectedPeerCount > 0 || enableOnlineBots ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg hover:shadow-green-500/30' : 'bg-white/10 text-white/20 cursor-not-allowed'}`}
                                                    >
                                                        START MATCH
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {lobbyState === 'join_setup' && (
                                        <div className="flex flex-col h-full">
                                            <div className="flex items-center mb-6">
                                                <button onClick={handleBackToLobby} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors">
                                                    <ArrowRight size={16} className="rotate-180" />
                                                </button>
                                                <span className="ml-3 text-white/40 text-xs font-bold uppercase tracking-widest">Join Room</span>
                                            </div>

                                            <div className="flex-1 flex flex-col justify-center items-center text-center gap-6">
                                                <div className="relative w-full">
                                                    <input 
                                                        value={joinInput}
                                                        onChange={(e) => setJoinInput(e.target.value)}
                                                        className="w-full bg-black/40 border border-white/10 focus:border-emerald-500 focus:bg-black/60 rounded-xl p-6 text-center text-white font-mono font-black text-4xl tracking-[0.2em] uppercase outline-none transition-all placeholder:text-white/5"
                                                        placeholder="CODE"
                                                        maxLength={6}
                                                    />
                                                    <button 
                                                        onClick={async () => {
                                                            try {
                                                                const text = await navigator.clipboard.readText();
                                                                setJoinInput(text);
                                                            } catch(e) {}
                                                        }}
                                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/20 hover:text-white transition-colors"
                                                    >
                                                        <Clipboard size={20} />
                                                    </button>
                                                </div>

                                                <button 
                                                    onClick={joinGame}
                                                    disabled={!joinInput || isConnecting}
                                                    className={`w-full py-4 rounded-xl font-black text-lg transition-all flex items-center justify-center gap-2 ${joinInput && !isConnecting ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg hover:shadow-emerald-500/30' : 'bg-white/10 text-white/20 cursor-not-allowed'}`}
                                                >
                                                    {isConnecting ? <Loader2 size={24} className="animate-spin" /> : 'CONNECT'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {lobbyState === 'client_waiting' && (
                                        <div className="flex flex-col h-full items-center justify-center text-center gap-6 animate-in zoom-in-95 duration-300">
                                            <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.2)] border border-emerald-500/50">
                                                <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                                                    <Check size={32} className="text-white" strokeWidth={4} />
                                                </div>
                                            </div>
                                            <div>
                                                <h2 className="text-3xl font-black text-white mb-1 tracking-tight">YOU'RE IN!</h2>
                                                <p className="text-emerald-400/80 font-bold text-sm uppercase tracking-wide">Waiting for host to start...</p>
                                            </div>
                                            
                                            <div className="bg-white/5 rounded-xl p-6 w-full border border-white/5">
                                                <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-2">Connected to Room</p>
                                                <p className="text-4xl font-mono font-black text-white tracking-widest uppercase">{roomCode}</p>
                                                {hostRoomName && <p className="text-sm text-emerald-400 font-bold mt-2 border-t border-white/5 pt-2">{hostRoomName}</p>}
                                            </div>

                                            <button 
                                                onClick={handleBackToLobby}
                                                className="mt-4 px-8 py-3 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all text-xs font-bold uppercase tracking-wider"
                                            >
                                                Leave Room
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Features Grid (Placeholders) */}
                    <div className="w-full max-w-lg grid grid-cols-2 gap-3 md:gap-4 animate-in slide-in-from-bottom-8 duration-700 delay-100">
                        {/* Daily Bonus */}
                        <button className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 p-4 rounded-2xl flex flex-col gap-2 relative overflow-hidden group hover:scale-[1.02] transition-transform shadow-lg">
                            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex justify-between items-start">
                                <div className="bg-yellow-500/20 p-2 rounded-lg text-yellow-400"><Gift size={20} /></div>
                                <span className="text-[10px] font-bold text-slate-400 bg-black/20 px-2 py-0.5 rounded-full border border-white/5">New</span>
                            </div>
                            <div className="text-left mt-1">
                                <div className="text-white font-bold text-sm md:text-base">Daily Bonus</div>
                                <div className="text-slate-400 text-[10px] md:text-xs">Claim your rewards</div>
                            </div>
                        </button>

                        {/* Shop */}
                        <button className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 p-4 rounded-2xl flex flex-col gap-2 relative overflow-hidden group hover:scale-[1.02] transition-transform shadow-lg">
                            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex justify-between items-start">
                                <div className="bg-pink-500/20 p-2 rounded-lg text-pink-400"><ShoppingBag size={20} /></div>
                                <span className="text-[10px] font-bold text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">Sale</span>
                            </div>
                            <div className="text-left mt-1">
                                <div className="text-white font-bold text-sm md:text-base">Item Shop</div>
                                <div className="text-slate-400 text-[10px] md:text-xs">Customize cards</div>
                            </div>
                        </button>
                        
                        {/* Leaderboard */}
                        <button className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 p-4 rounded-2xl flex flex-col gap-2 relative overflow-hidden group hover:scale-[1.02] transition-transform shadow-lg">
                            <div className="flex justify-between items-start">
                                <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400"><Trophy size={20} /></div>
                            </div>
                            <div className="text-left mt-1">
                                <div className="text-white font-bold text-sm md:text-base">Leaderboard</div>
                                <div className="text-slate-400 text-[10px] md:text-xs">Global Rank #1203</div>
                            </div>
                        </button>

                        {/* Settings/Profile */}
                        <button className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 p-4 rounded-2xl flex flex-col gap-2 relative overflow-hidden group hover:scale-[1.02] transition-transform shadow-lg">
                            <div className="flex justify-between items-start">
                                <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-400"><Award size={20} /></div>
                            </div>
                            <div className="text-left mt-1">
                                <div className="text-white font-bold text-sm md:text-base">Achievements</div>
                                <div className="text-slate-400 text-[10px] md:text-xs">12/50 Unlocked</div>
                            </div>
                        </button>
                    </div>

                    {/* Footer Links - Moved inside scroll area */}
                    <div className="flex gap-6 mt-2 opacity-50 pb-8">
                        <button onClick={handleInstallClick} className="flex items-center gap-2 group hover:opacity-100 transition-opacity">
                            <Download size={14} className="text-white" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white">Install App</span>
                        </button>

                         <a href="mailto:nibirbbkr@gmail.com" className="flex items-center gap-2 group hover:opacity-100 transition-opacity">
                            <Mail size={14} className="text-white" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white">Support</span>
                        </a>
                    </div>

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
                className="bg-slate-800/80 text-white px-6 py-2 rounded-full font-bold hover:bg-red-600 hover:shadow-[0_0_15px_rgba(220,38,38,0.5)] transition-all border border-white/10 backdrop-blur-md shadow-lg"
            >
                EXIT
            </button>
        </div>
        
        <div className="flex items-center gap-3 pointer-events-auto">
             {/* Help / Rules Button */}
             <button 
                onClick={() => setShowRules(true)}
                className="w-10 h-10 bg-slate-800/80 rounded-full flex items-center justify-center hover:bg-white/20 transition-all border border-white/10 shadow-lg text-white"
                title="How to Play"
             >
                <HelpCircle size={20} />
             </button>

             {/* Shuffle/New Game Button - Only for Host or Offline */}
             {(networkMode === NetworkMode.Offline || networkMode === NetworkMode.Host) && (
                 <button 
                    onClick={triggerRestartConfirm}
                    className="w-10 h-10 bg-slate-800/80 rounded-full flex items-center justify-center hover:bg-blue-600 hover:rotate-180 transition-all duration-500 border border-white/10 shadow-lg group text-white"
                    title="Shuffle / New Game"
                 >
                    <Shuffle size={20} />
                 </button>
             )}

             <button 
                onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                className="w-10 h-10 bg-slate-800/80 rounded-full flex items-center justify-center hover:bg-white/20 transition-all border border-white/10 shadow-lg text-white"
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