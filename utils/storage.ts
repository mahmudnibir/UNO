
import { GameStats, Achievement, LeaderboardEntry } from '../types';

const STATS_KEY = 'uno_master_stats';
const ACHIEVEMENTS_KEY = 'uno_master_achievements';
const LEADERBOARD_KEY = 'uno_master_leaderboard';

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_win', title: 'First Blood', description: 'Win your first game', icon: 'Trophy', unlocked: false },
  { id: 'streak_3', title: 'On Fire', description: 'Win 3 games in a row', icon: 'Flame', unlocked: false },
  { id: 'bot_slayer', title: 'Bot Slayer', description: 'Win a game against 3 bots', icon: 'Bot', unlocked: false },
  { id: 'veteran', title: 'Veteran', description: 'Play 10 games', icon: 'Star', unlocked: false },
  { id: 'speedster', title: 'Speedster', description: 'Win in under 15 turns', icon: 'Zap', unlocked: false }
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

export const saveGameEnd = (isWin: boolean, turns: number, botCount: number, mode: string) => {
    // Update Stats
    const stats = getStats();
    stats.gamesPlayed++;
    if (isWin) {
        stats.wins++;
        stats.currentStreak++;
        if (stats.bestTurnCount === null || turns < stats.bestTurnCount) {
            stats.bestTurnCount = turns;
        }
    } else {
        stats.currentStreak = 0;
    }
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));

    // Update Leaderboard (Keep top 10 local)
    if (isWin) {
        const lb = getLeaderboard();
        lb.push({ date: Date.now(), winnerName: 'You', turns, mode });
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

    if (isWin) unlock('first_win');
    if (stats.currentStreak >= 3) unlock('streak_3');
    if (isWin && botCount >= 3 && mode === 'Offline') unlock('bot_slayer');
    if (stats.gamesPlayed >= 10) unlock('veteran');
    if (isWin && turns < 15) unlock('speedster');

    if (changed) {
        localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achs));
    }
    
    return { stats, achievements: achs, newUnlocks: changed };
};
