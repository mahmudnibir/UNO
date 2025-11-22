
import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, CardColor, CardValue, Player, GameState, GameStatus, NetworkMode, NetworkMessage, MatchStats 
} from './types';
import { 
  createDeck, shuffleDeck, getNextPlayerIndex, findBestMove, pickBestColorForBot, isValidPlay
} from './utils/gameLogic';
import { soundManager } from './utils/sound';
import { mpManager } from './utils/multiplayer';
import { saveGameEnd } from './utils/storage';
import GameTable from './components/GameTable';
import PlayerHand from './components/PlayerHand';
import ColorPicker from './components/ColorPicker';
import Lobby from './components/Lobby';
import { ConfirmModal, RulesModal } from './components/Modals';
import { 
  Volume2, VolumeX, Shuffle, HelpCircle, Download, Share, X
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
  
  // Stats tracking for achievements
  const matchStatsRef = useRef<MatchStats>({
      turns: 0, maxHandSize: 7, plus4Played: 0, plus2Played: 0, skipsPlayed: 0, reversesPlayed: 0,
      wildsPlayed: 0, redPlayed: 0, bluePlayed: 0, greenPlayed: 0, yellowPlayed: 0
  });

  // Multiplayer State
  const [networkMode, setNetworkMode] = useState<NetworkMode>(NetworkMode.Offline);
  const [roomCode, setRoomCode] = useState<string>("");
  const [roomName, setRoomName] = useState<string>("My UNO Room");
  const [hostRoomName, setHostRoomName] = useState<string>(""); 
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

  // Wake Lock Manager
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        setWakeLock(lock);
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
      } catch (e) {
        console.log('Error releasing lock', e);
      }
    }
  };

  useEffect(() => {
      return () => { if (wakeLock) wakeLock.release(); };
  }, [wakeLock]);

  useEffect(() => {
      const checkIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      setIsIOS(checkIOS);
      const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
      window.addEventListener('beforeinstallprompt', handler);
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
      if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') setDeferredPrompt(null);
          else setShowInstallHelp(true);
          return;
      }
      setShowInstallHelp(true);
  };

  // Initialize Multiplayer Listeners
  useEffect(() => {
    mpManager.initialize((data: NetworkMessage) => {
      if (networkMode === NetworkMode.Client) {
        if (data.type === 'GAME_STATE') {
          setGameState(data.payload);
          if (data.payload.lastAction) setLastAction(data.payload.lastAction);
          if ((data.payload as any).lastActivePlayerId !== undefined) {
              setLastActivePlayerId((data.payload as any).lastActivePlayerId);
          }
          if (data.payload.status === GameStatus.GameOver && data.payload.winner?.id === 1) { // 1 is me as client
              // Note: Clients handle stats locally in saveGameEnd when they detect win
          }
          playSound('turn'); 
        }
        if (data.type === 'ROOM_INFO') setHostRoomName(data.payload.name);
        if (data.type === 'KICKED') {
            handleBackToLobby();
            setKickMessage("You were disconnected by the host.");
        }
      } else if (networkMode === NetworkMode.Host) {
        if (data.type === 'PLAYER_JOINED') {
           setConnectedPeerCount(data.payload.count);
           playSound('draw');
        }
        if (data.type === 'PLAYER_LEFT') setConnectedPeerCount(data.payload.count);
        if (data.type === 'PLAY_CARD') {
           const { playerId, card, wildColor } = data.payload;
           executeMove(playerId, card, wildColor);
        }
        if (data.type === 'DRAW_CARD') {
           const { playerId } = data.payload;
           handleDrawCard(playerId);
        }
        if (data.type === 'SHOUT_UNO') handleShoutUno(data.payload.playerId);
      }
    });
  }, [networkMode, gameState]);

  // --- Navigation Logic ---
  const handleBackToLobby = () => {
      mpManager.disconnect();
      releaseWakeLock();
      setRoomCode("");
      setHostRoomName("");
      setConnectedPeerCount(0);
      setJoinInput("");
      setKickMessage(null);
      setLobbyState('main');
      setNetworkMode(NetworkMode.Offline);
      setEnableOnlineBots(false);
  };

  const startHost = async () => {
      setIsConnecting(true);
      try {
          mpManager.setRoomName(roomName);
          const id = await mpManager.hostGame();
          setRoomCode(id);
          setNetworkMode(NetworkMode.Host);
          setConnectedPeerCount(0);
          requestWakeLock();
      } catch (e) {
          alert("Failed to host game. PeerJS server might be busy.");
          handleBackToLobby();
      }
      setIsConnecting(false);
  };

  const joinGame = async () => {
      if (!joinInput) return;
      const code = joinInput.trim().toUpperCase();
      setIsConnecting(true);
      setKickMessage(null);
      try {
          await mpManager.joinGame(code); 
          setNetworkMode(NetworkMode.Client);
          setRoomCode(code);
          setLobbyState('client_waiting');
          requestWakeLock();
          playSound('play');
      } catch (e: any) {
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

  // --- Game Initialization ---
  const startGame = () => {
    playSound('shuffle');
    // Reset match stats
    matchStatsRef.current = {
        turns: 0, maxHandSize: 7, plus4Played: 0, plus2Played: 0, skipsPlayed: 0, reversesPlayed: 0,
        wildsPlayed: 0, redPlayed: 0, bluePlayed: 0, greenPlayed: 0, yellowPlayed: 0
    };

    const deck = createDeck();
    const players: Player[] = [];
    
    players.push({ id: 0, name: networkMode === NetworkMode.Client ? 'Host' : 'You', hand: [], isBot: false, hasUno: false });

    if (networkMode === NetworkMode.Host) {
        for (let i = 0; i < connectedPeerCount; i++) {
             players.push({ id: i + 1, name: `Guest ${i + 1}`, hand: [], isBot: false, hasUno: false });
        }
        const minPlayers = 2;
        const humans = players.length;
        const slotsToFill = enableOnlineBots ? (4 - humans) : (humans < minPlayers ? (minPlayers - humans) : 0);
        const botNames = ['Sarah', 'Mike', 'Jess'];
        let botIndex = 0;
        for (let i = 0; i < slotsToFill; i++) {
             players.push({ id: players.length, name: botNames[botIndex++ % 3], hand: [], isBot: true, hasUno: false });
        }
    } else if (networkMode === NetworkMode.Offline) {
        const botNames = ['Sarah', 'Mike', 'Jess'];
        for (let i = 0; i < botCount; i++) {
            players.push({ id: i + 1, name: botNames[i], hand: [], isBot: true, hasUno: false });
        }
    }

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
      roomId: roomCode,
      turnCount: 0
    };

    setGameState(newGameState);
    setLastAction("Game Started!");
    setLastActivePlayerId(null);
    playSound('turn');

    if (networkMode === NetworkMode.Host) {
        mpManager.broadcast({ type: 'GAME_STATE', payload: { ...newGameState, lastActivePlayerId: null } });
    }
  };

  // --- Bot AI Loop ---
  useEffect(() => {
    if (!gameState || gameState.status !== GameStatus.Playing) return;
    if (networkMode === NetworkMode.Client) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.isBot) {
      const baseDelay = 1000;
      const delay = Math.random() * 500 + baseDelay; 
      const timer = setTimeout(() => {
        if (gameState.drawStack > 0) handleDrawCard(currentPlayer.id);
        else handleBotTurn(currentPlayer);
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
    if (gameState.currentPlayerIndex !== myPlayerId) { playSound('error'); return; }
    if (gameState.drawStack > 0) { playSound('error'); setLastAction("Must draw penalty cards!"); return; }

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
        ...prev, isUnoShouted: true, players: prev.players.map(p => p.id === id ? { ...p, hasUno: true } : p)
      };
      if (networkMode === NetworkMode.Host) mpManager.broadcast({ type: 'GAME_STATE', payload: { ...newState, lastActivePlayerId: id } });
      return newState;
    });
    
    const currentName = gameStateRef.current?.players[id]?.name || "Player";
    setLastAction(`${currentName} shouted UNO!`);
    setTimeout(() => {
        setGameState(prev => {
             if (!prev) return null;
             if (!prev.isUnoShouted) return prev; 
             const newState = { ...prev, isUnoShouted: false };
             if (networkMode === NetworkMode.Host) mpManager.broadcast({ type: 'GAME_STATE', payload: { ...newState, lastActivePlayerId: null } });
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
      const newPlayers = prev.players.map(p => p.id === playerId ? { ...p, hand: [...p.hand, drawnCard], hasUno: false } : p);
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
      
      // Update max hand size for self stats
      if (playerId === myPlayerId) {
          const currentSize = newPlayers[myPlayerId].hand.length;
          if (currentSize > matchStatsRef.current.maxHandSize) {
              matchStatsRef.current.maxHandSize = currentSize;
          }
      }

      setLastActivePlayerId(playerId);
      if (networkMode === NetworkMode.Host) mpManager.broadcast({ type: 'GAME_STATE', payload: { ...nextState, lastActivePlayerId: playerId } });
      return nextState;
    });
  };

  const executeMove = (playerId: number, card: Card, wildColor?: CardColor) => {
    // Track stats for Self
    if (playerId === myPlayerId) {
        matchStatsRef.current.turns++;
        if (card.value === CardValue.DrawTwo) matchStatsRef.current.plus2Played++;
        if (card.value === CardValue.WildDrawFour) matchStatsRef.current.plus4Played++;
        if (card.value === CardValue.Skip) matchStatsRef.current.skipsPlayed++;
        if (card.value === CardValue.Reverse) matchStatsRef.current.reversesPlayed++;
        if (card.color === CardColor.Wild) matchStatsRef.current.wildsPlayed++;
        
        // Count colors (use actual color for standard, chosen for wild not counted as played color usually, but let's count played card ink)
        if (card.color === CardColor.Red) matchStatsRef.current.redPlayed++;
        if (card.color === CardColor.Blue) matchStatsRef.current.bluePlayed++;
        if (card.color === CardColor.Green) matchStatsRef.current.greenPlayed++;
        if (card.color === CardColor.Yellow) matchStatsRef.current.yellowPlayed++;
    }

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
        
        // --- SAVE STATS ---
        if (networkMode !== NetworkMode.Client) {
            // I am host or offline player
            if (playerId === 0) {
                // I won
                matchStatsRef.current.finalCardValue = card.value;
                matchStatsRef.current.finalCardColor = card.color;
                saveGameEnd(true, matchStatsRef.current, botCount, networkMode === NetworkMode.Host ? 'Online Host' : 'Offline');
            } else if (playerId !== 0 && networkMode === NetworkMode.Offline) {
                // I lost against bots
                saveGameEnd(false, matchStatsRef.current, botCount, 'Offline');
            }
        }
        
        const winState = { ...prev, players: newPlayers, discardPile: [...prev.discardPile, card], status: GameStatus.GameOver, winner: prev.players[playerId] };
        if (networkMode === NetworkMode.Host) mpManager.broadcast({ type: 'GAME_STATE', payload: { ...winState, lastActivePlayerId: playerId } });
        return winState;
      }

      if (newPlayers[playerId].hand.length === 1) playSound('uno');

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

      // Increment turn count every time it goes back to player 0 (approximately) or just every move
      const newTurnCount = prev.turnCount + 1;

      if (stackToAdd > 0) {
          nextState = {
              ...prev, discardPile: [...prev.discardPile, card], players: newPlayers, 
              currentPlayerIndex: nextIndex, direction: nextDirection, activeColor: nextActiveColor, drawStack: prev.drawStack + stackToAdd, turnCount: newTurnCount
          };
      } else {
          if (skipNext) nextIndex = getNextPlayerIndex(nextIndex, prev.players.length, nextDirection);
          nextState = {
             ...prev, discardPile: [...prev.discardPile, card], players: newPlayers,
             currentPlayerIndex: nextIndex, direction: nextDirection, activeColor: nextActiveColor, turnCount: newTurnCount
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
      return (
          <>
            {showInstallHelp && (
                <div className="fixed bottom-4 right-4 max-w-[calc(100vw-2rem)] md:max-w-md bg-slate-900/95 backdrop-blur-xl p-6 rounded-2xl border border-yellow-400/30 shadow-[0_0_50px_rgba(0,0,0,0.8)] z-[100] animate-pop">
                    <button onClick={() => setShowInstallHelp(false)} className="absolute top-2 right-2 text-white/40 hover:text-white bg-white/5 hover:bg-white/20 rounded-full p-1 transition-colors"><X size={16}/></button>
                    <h3 className="font-black text-yellow-400 mb-4 flex items-center gap-2 uppercase tracking-wide"><Download size={20}/> How to Install</h3>
                    {isIOS ? (
                        <div className="text-sm text-slate-300 space-y-4">
                            <p>To install on iOS/iPad:</p>
                            <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg"><Share className="text-blue-400 shrink-0" size={24} /><span>Tap <strong>Share</strong></span></div>
                            <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg"><div className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center shrink-0"><span className="text-black font-bold">+</span></div><span>Tap <strong>"Add to Home Screen"</strong></span></div>
                        </div>
                    ) : (
                        <div className="text-sm text-slate-300 space-y-4"><p>Tap the <strong>Three Dots (⋮)</strong> &rarr; <strong>Add to Home Screen</strong> or <strong>Install App</strong>.</p></div>
                    )}
                </div>
            )}
            
            <Lobby 
                networkMode={networkMode} setNetworkMode={setNetworkMode}
                lobbyState={lobbyState} setLobbyState={setLobbyState}
                roomName={roomName} setRoomName={setRoomName}
                joinInput={joinInput} setJoinInput={setJoinInput}
                roomCode={roomCode}
                connectedPeerCount={connectedPeerCount}
                isConnecting={isConnecting}
                enableOnlineBots={enableOnlineBots} setEnableOnlineBots={setEnableOnlineBots}
                kickMessage={kickMessage} setKickMessage={setKickMessage}
                botCount={botCount} setBotCount={setBotCount}
                onStartSolo={startGame}
                onStartHost={startHost}
                onJoinGame={joinGame}
                onBackToLobby={handleBackToLobby}
                onCopyCode={handleCopyCode}
                onKickPlayer={handleKickPlayer}
                copiedId={copiedId}
                isOffline={isOffline}
                hostRoomName={hostRoomName}
            />
            
            <div className="fixed bottom-4 left-4 z-50">
               <button onClick={handleInstallClick} className="bg-white/10 hover:bg-white/20 text-white/50 hover:text-white p-3 rounded-full transition-colors"><Download size={16} /></button>
            </div>
          </>
      );
  }

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 z-50 p-4 flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto flex gap-2">
            <button onClick={triggerExitConfirm} className="bg-slate-800/80 text-white px-6 py-2 rounded-full font-bold hover:bg-red-600 hover:shadow-[0_0_15px_rgba(220,38,38,0.5)] transition-all border border-white/10 backdrop-blur-md shadow-lg">EXIT</button>
        </div>
        <div className="flex items-center gap-3 pointer-events-auto">
             <button onClick={() => setShowRules(true)} className="w-10 h-10 bg-slate-800/80 rounded-full flex items-center justify-center hover:bg-white/20 transition-all border border-white/10 shadow-lg text-white"><HelpCircle size={20} /></button>
             {(networkMode === NetworkMode.Offline || networkMode === NetworkMode.Host) && (
                 <button onClick={triggerRestartConfirm} className="w-10 h-10 bg-slate-800/80 rounded-full flex items-center justify-center hover:bg-blue-600 hover:rotate-180 transition-all duration-500 border border-white/10 shadow-lg group text-white"><Shuffle size={20} /></button>
             )}
             <button onClick={() => setIsSoundEnabled(!isSoundEnabled)} className="w-10 h-10 bg-slate-800/80 rounded-full flex items-center justify-center hover:bg-white/20 transition-all border border-white/10 shadow-lg text-white">{isSoundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
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

      {showColorPicker && <ColorPicker onSelect={handleColorSelect} onCancel={() => {setPendingCardPlay(null); setShowColorPicker(false);}} />}
      
      {gameState.isUnoShouted && (
          <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
              <div className="animate-pop scale-150">
                   <div className="bg-red-600 text-white font-black text-6xl px-8 py-4 rounded-3xl border-8 border-white shadow-2xl rotate-[-12deg] animate-bounce">UNO!</div>
              </div>
          </div>
      )}

      {/* Modals */}
      <ConfirmModal 
        isOpen={confirmModal.isOpen} 
        title={confirmModal.title} 
        message={confirmModal.message} 
        onConfirm={confirmModal.onConfirm} 
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} 
        type={confirmModal.type} 
      />
      
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
};

export default App;
