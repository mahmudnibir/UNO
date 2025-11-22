
export enum CardColor {
  Red = 'RED',
  Blue = 'BLUE',
  Green = 'GREEN',
  Yellow = 'YELLOW',
  Wild = 'WILD' // Used for black cards before they are played
}

export enum CardValue {
  Zero = '0',
  One = '1',
  Two = '2',
  Three = '3',
  Four = '4',
  Five = '5',
  Six = '6',
  Seven = '7',
  Eight = '8',
  Nine = '9',
  Skip = 'SKIP',
  Reverse = 'REVERSE',
  DrawTwo = '+2',
  Wild = 'WILD',
  WildDrawFour = '+4'
}

export interface Card {
  id: string;
  color: CardColor;
  value: CardValue;
  // The 'active' color of a wild card once played
  tempColor?: CardColor; 
}

export interface Player {
  id: number;
  name: string;
  hand: Card[];
  isBot: boolean;
  hasUno: boolean; // If they shouted UNO (or auto-marked)
}

export enum GameStatus {
  Lobby = 'LOBBY',
  Playing = 'PLAYING',
  GameOver = 'GAME_OVER'
}

export interface GameState {
  deck: Card[];
  discardPile: Card[];
  players: Player[];
  currentPlayerIndex: number;
  direction: 1 | -1; // 1 for clockwise, -1 for counter-clockwise
  status: GameStatus;
  winner: Player | null;
  activeColor: CardColor; // The color that must be matched (handles Wilds)
  drawStack: number; // Accumulates +2 or +4 penalties
  isUnoShouted: boolean; // UI state for player
  roomId?: string; // Multiplayer room ID
  turnCount: number; // Added to track turns for stats
}

// --- Multiplayer Types ---

export enum NetworkMode {
  Offline = 'OFFLINE',
  Host = 'HOST',
  Client = 'CLIENT'
}

export interface NetworkMessage {
  type: 'GAME_STATE' | 'PLAY_CARD' | 'DRAW_CARD' | 'SHOUT_UNO' | 'JOIN_REQUEST' | 'PLAYER_JOINED' | 'ROOM_INFO' | 'KICKED' | 'PLAYER_LEFT';
  payload?: any;
  playerId?: number;
}

// --- Stats & Persistence ---

export interface GameStats {
  gamesPlayed: number;
  wins: number;
  bestTurnCount: number | null; // Fewest turns to win
  currentStreak: number;
}

export interface MatchStats {
  turns: number;
  maxHandSize: number;
  plus4Played: number;
  plus2Played: number;
  skipsPlayed: number;
  reversesPlayed: number;
  wildsPlayed: number;
  redPlayed: number;
  bluePlayed: number;
  greenPlayed: number;
  yellowPlayed: number;
  finalCardValue?: CardValue;
  finalCardColor?: CardColor;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // lucide icon name
  unlocked: boolean;
  unlockedAt?: number;
}

export interface LeaderboardEntry {
  date: number;
  winnerName: string;
  turns: number;
  mode: string;
}
