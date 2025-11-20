import { Card, CardColor, CardValue, Player } from '../types';

// Generate a unique ID
const uid = () => Math.random().toString(36).substr(2, 9);

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  const colors = [CardColor.Red, CardColor.Blue, CardColor.Green, CardColor.Yellow];
  
  colors.forEach(color => {
    // 1 zero
    deck.push({ id: uid(), color, value: CardValue.Zero });
    
    // 2 of each 1-9, Skip, Reverse, DrawTwo
    const values = [
      CardValue.One, CardValue.Two, CardValue.Three, CardValue.Four,
      CardValue.Five, CardValue.Six, CardValue.Seven, CardValue.Eight, CardValue.Nine,
      CardValue.Skip, CardValue.Reverse, CardValue.DrawTwo
    ];

    values.forEach(value => {
      deck.push({ id: uid(), color, value });
      deck.push({ id: uid(), color, value });
    });
  });

  // Wilds
  for (let i = 0; i < 4; i++) {
    deck.push({ id: uid(), color: CardColor.Wild, value: CardValue.Wild });
    deck.push({ id: uid(), color: CardColor.Wild, value: CardValue.WildDrawFour });
  }

  return shuffleDeck(deck);
};

export const shuffleDeck = (deck: Card[]): Card[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

export const isValidPlay = (card: Card, topCard: Card, activeColor: CardColor): boolean => {
  // Wilds are always playable
  if (card.color === CardColor.Wild) return true;
  
  // Match color (use activeColor which accounts for played Wilds)
  if (card.color === activeColor) return true;
  
  // Match value/symbol
  if (card.value === topCard.value) return true;

  return false;
};

export const getNextPlayerIndex = (current: number, total: number, direction: 1 | -1): number => {
  return (current + direction + total) % total;
};

export const calculatePoints = (hand: Card[]): number => {
  return hand.reduce((acc, card) => {
    if (card.value === CardValue.Wild || card.value === CardValue.WildDrawFour) return acc + 50;
    if (card.value === CardValue.Skip || card.value === CardValue.Reverse || card.value === CardValue.DrawTwo) return acc + 20;
    return acc + parseInt(card.value, 10);
  }, 0);
};

// Bot AI: Simple heuristic
export const findBestMove = (hand: Card[], topCard: Card, activeColor: CardColor): Card | null => {
  // 1. Try to match color or value (prioritize non-wilds to save wilds)
  const playables = hand.filter(c => isValidPlay(c, topCard, activeColor));
  
  if (playables.length === 0) return null;

  // Heuristic: Play action cards if possible, otherwise highest number, save Wilds for last
  const nonWilds = playables.filter(c => c.color !== CardColor.Wild);
  
  if (nonWilds.length > 0) {
    // Try to play actions first to mess up others
    const action = nonWilds.find(c => [CardValue.DrawTwo, CardValue.Skip, CardValue.Reverse].includes(c.value));
    if (action) return action;
    
    // Otherwise matching color
    const matchingColor = nonWilds.find(c => c.color === activeColor);
    if (matchingColor) return matchingColor;
    
    return nonWilds[0];
  }

  // Only wilds left
  return playables[0];
};

export const pickBestColorForBot = (hand: Card[]): CardColor => {
  const counts = {
    [CardColor.Red]: 0,
    [CardColor.Blue]: 0,
    [CardColor.Green]: 0,
    [CardColor.Yellow]: 0,
  };
  
  hand.forEach(c => {
    if (c.color !== CardColor.Wild) {
      counts[c.color as keyof typeof counts]++;
    }
  });

  // Return color with max count
  const maxColor = Object.keys(counts).reduce((a, b) => counts[a as keyof typeof counts] > counts[b as keyof typeof counts] ? a : b);
  return maxColor as CardColor;
};
