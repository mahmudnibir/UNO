
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
}

// --- Multiplayer Types ---

export enum NetworkMode {
  Offline = 'OFFLINE',
  Host = 'HOST',
  Client = 'CLIENT'
}

export interface NetworkMessage {
  type: 'GAME_STATE' | 'PLAY_CARD' | 'DRAW_CARD' | 'SHOUT_UNO' | 'JOIN_REQUEST' | 'PLAYER_JOINED';
  payload?: any;
  playerId?: number;
}
