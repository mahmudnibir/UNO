
import { GameStats, Achievement, LeaderboardEntry, MatchStats, CardColor, CardValue } from '../types';

const STATS_KEY = 'uno_master_stats';
const ACHIEVEMENTS_KEY = 'uno_master_achievements';
const LEADERBOARD_KEY = 'uno_master_leaderboard';

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  // Basics
  { id: 'first_win', title: 'First Blood', description: 'Win your first game', icon: 'Trophy', unlocked: false },
  { id: 'streak_3', title: 'On Fire', description: 'Win 3 games in a row', icon: 'Flame', unlocked: false },
  { id: 'veteran', title: 'Veteran', description: 'Play 10 games', icon: 'Star', unlocked: false },
  { id: 'century_club', title: 'Century Club', description: 'Play 50 total games', icon: 'Crown', unlocked: false },
  
  // Skill / Style
  { id: 'bot_slayer', title: 'Bot Slayer', description: 'Win a game against 3 bots', icon: 'Bot', unlocked: false },
  { id: 'speedster', title: 'Speedster', description: 'Win in under 10 turns', icon: 'Zap', unlocked: false },
  { id: 'marathon_runner', title: 'Marathon', description: 'Win a game that lasts over 30 turns', icon: 'Timer', unlocked: false },
  { id: 'hoarder', title: 'The Hoarder', description: 'Have 15 or more cards in your hand at once', icon: 'Layers', unlocked: false },
  { id: 'chromatic', title: 'Chromatic', description: 'Play cards of all 4 colors in a single game', icon: 'Palette', unlocked: false },
  
  // Specific Wins
  { id: 'master_strategist', title: 'Master Strategist', description: 'Win with a +4 Wild card', icon: 'Swords', unlocked: false },
  { id: 'wild_winner', title: 'Wild Side', description: 'Win with a standard Wild card', icon: 'Sparkles', unlocked: false },
  { id: 'zero_hero', title: 'Zero Hero', description: 'Win with a Number 0 card', icon: 'Circle', unlocked: false },
  { id: 'peacekeeper', title: 'Peacekeeper', description: 'Win without playing any +2 or +4 cards', icon: 'ShieldCheck', unlocked: false },

  // Action Mastery
  { id: 'draw_master', title: 'Draw Master', description: 'Play 5 +2 or +4 cards in one game', icon: 'PlusSquare', unlocked: false },
  { id: 'reverse_uno', title: 'No U', description: 'Play 5 Reverse cards in one game', icon: 'RefreshCw', unlocked: false },
  { id: 'skipper', title: 'Cant Touch This', description: 'Play 5 Skip cards in one game', icon: 'Ban', unlocked: false },

  // Color Mastery
  { id: 'red_baron', title: 'Red Baron', description: 'Play 10 Red cards in a single game', icon: 'Flame', unlocked: false },
  { id: 'deep_blue', title: 'Deep Blue', description: 'Play 10 Blue cards in a single game', icon: 'Droplet', unlocked: false },
  { id: 'forest_ranger', title: 'Forest Ranger', description: 'Play 10 Green cards in a single game', icon: 'Trees', unlocked: false },
  { id: 'sun_worshipper', title: 'Sun Worshipper', description: 'Play 10 Yellow cards in a single game', icon: 'Sun', unlocked: false },
];

export const getStats = (): GameStats => {
  try {
    const s = localStorage.getItem(STATS_KEY);
    return s ? JSON.parse(s) : { gamesPlayed: 0, wins: 0, bestTurnCount: null, currentStreak: 0 };
  } catch (e) {
    return { gamesPlayed: 0, wins: 0, bestTurnCount: null, currentStreak: 0 };
  }
};

export const getAchievements = (): Achievement[] => {
  try {
    const s = localStorage.getItem(ACHIEVEMENTS_KEY);
    if (!s) return INITIAL_ACHIEVEMENTS;
    const stored = JSON.parse(s) as Achievement[];
    // Merge with initial in case we added new ones in code but user has old data
    return INITIAL_ACHIEVEMENTS.map(init => {
      const found = stored.find(x => x.id === init.id);
      return found ? found : init;
    });
  } catch (e) {
    return INITIAL_ACHIEVEMENTS;
  }
};

export const getLeaderboard = (): LeaderboardEntry[] => {
  try {
    const s = localStorage.getItem(LEADERBOARD_KEY);
    return s ? JSON.parse(s) : [];
  } catch (e) {
    return [];
  }
};

export const saveGameEnd = (isWin: boolean, matchStats: MatchStats, botCount: number, mode: string) => {
    // Update Stats
    const stats = getStats();
    stats.gamesPlayed++;
    if (isWin) {
        stats.wins++;
        stats.currentStreak++;
        if (stats.bestTurnCount === null || matchStats.turns < stats.bestTurnCount) {
            stats.bestTurnCount = matchStats.turns;
        }
    } else {
        stats.currentStreak = 0;
    }
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));

    // Update Leaderboard (Keep top 10 local)
    if (isWin) {
        const lb = getLeaderboard();
        lb.push({ date: Date.now(), winnerName: 'You', turns: matchStats.turns, mode });
        lb.sort((a, b) => a.turns - b.turns); // Sort by fewest turns
        const top10 = lb.slice(0, 10);
        localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(top10));
    }

    // Check Achievements
    const achs = getAchievements();
    let changed = false;
    
    // Helper to unlock
    const unlock = (id: string) => {
        const a = achs.find(x => x.id === id);
        if (a && !a.unlocked) {
            a.unlocked = true;
            a.unlockedAt = Date.now();
            changed = true;
        }
    };

    // --- LOGIC CHECKS ---
    
    // Win based
    if (isWin) unlock('first_win');
    if (stats.currentStreak >= 3) unlock('streak_3');
    if (isWin && botCount >= 3 && mode === 'Offline') unlock('bot_slayer');
    if (isWin && matchStats.turns < 10) unlock('speedster');
    if (isWin && matchStats.turns > 30) unlock('marathon_runner');
    
    if (isWin && matchStats.finalCardValue === CardValue.WildDrawFour) unlock('master_strategist');
    if (isWin && matchStats.finalCardValue === CardValue.Wild) unlock('wild_winner');
    if (isWin && matchStats.finalCardValue === CardValue.Zero) unlock('zero_hero');
    if (isWin && matchStats.plus2Played === 0 && matchStats.plus4Played === 0) unlock('peacekeeper');

    // Stats based (win or lose)
    if (stats.gamesPlayed >= 10) unlock('veteran');
    if (stats.gamesPlayed >= 50) unlock('century_club');
    
    if (matchStats.maxHandSize >= 15) unlock('hoarder');
    
    if (matchStats.redPlayed > 0 && matchStats.bluePlayed > 0 && matchStats.greenPlayed > 0 && matchStats.yellowPlayed > 0) {
        unlock('chromatic');
    }

    if ((matchStats.plus2Played + matchStats.plus4Played) >= 5) unlock('draw_master');
    if (matchStats.reversesPlayed >= 5) unlock('reverse_uno');
    if (matchStats.skipsPlayed >= 5) unlock('skipper');

    if (matchStats.redPlayed >= 10) unlock('red_baron');
    if (matchStats.bluePlayed >= 10) unlock('deep_blue');
    if (matchStats.greenPlayed >= 10) unlock('forest_ranger');
    if (matchStats.yellowPlayed >= 10) unlock('sun_worshipper');

    if (changed) {
        localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achs));
    }
    
    return { stats, achievements: achs, newUnlocks: changed };
};
