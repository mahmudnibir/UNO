
import React, { useEffect, useState } from 'react';
import { 
    X, Trophy, BookOpen, AlertTriangle, Star, Calendar, Zap, Flame, Bot, Heart, Shield,
    Swords, Sparkles, Circle, Layers, Timer, PlusSquare, Palette, ShieldCheck, Crown, Droplet, Trees, Sun,
    RefreshCw, Ban, Settings, Volume2, VolumeX, LogOut, Music
} from 'lucide-react';
import { Achievement, LeaderboardEntry } from '../types';
import { getAchievements, getLeaderboard } from '../utils/storage';

// --- Icon Mapping Helper ---
const IconMap: Record<string, any> = {
  Trophy, Star, Flame, Bot, Heart, Zap, Shield,
  Swords, Sparkles, Circle, Layers, Timer, PlusSquare, Palette, ShieldCheck, Crown, Droplet, Trees, Sun,
  RefreshCw, Ban
};

// --- MODAL WRAPPER ---
const ModalWrapper: React.FC<{ onClose: () => void; children: React.ReactNode; title: React.ReactNode; colorClass?: string }> = ({ onClose, children, title, colorClass = "from-slate-800 to-slate-900" }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
        <div className={`w-full max-w-lg bg-gradient-to-b ${colorClass} border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300`}>
            {/* Header */}
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-black/20">
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-white flex items-center gap-3">
                    {title}
                </h2>
                <button 
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
                >
                    <X size={20} />
                </button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {children}
            </div>
        </div>
    </div>
);

// --- SETTINGS MODAL ---
interface SettingsModalProps {
    onClose: () => void;
    isSoundEnabled: boolean;
    toggleSound: () => void;
    onExitGame: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, isSoundEnabled, toggleSound, onExitGame }) => {
    return (
        <ModalWrapper onClose={onClose} title={<><Settings className="text-slate-400" /> Settings</>} colorClass="from-slate-900 to-black">
            <div className="space-y-6">
                <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isSoundEnabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {isSoundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
                        </div>
                        <div>
                            <h3 className="font-bold text-white">Sound Effects</h3>
                            <p className="text-xs text-slate-400">Game audio and feedback</p>
                        </div>
                    </div>
                    <button 
                        onClick={toggleSound}
                        className={`w-14 h-8 rounded-full relative transition-colors duration-300 ${isSoundEnabled ? 'bg-green-500' : 'bg-slate-700'}`}
                    >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${isSoundEnabled ? 'left-7' : 'left-1'}`} />
                    </button>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center justify-between opacity-50 cursor-not-allowed">
                     <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                            <Music size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white">Background Music</h3>
                            <p className="text-xs text-slate-400">Coming soon</p>
                        </div>
                    </div>
                    <div className="w-14 h-8 rounded-full bg-slate-700 relative">
                        <div className="absolute top-1 left-1 w-6 h-6 bg-slate-500 rounded-full" />
                    </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                    <button 
                        onClick={onExitGame}
                        className="w-full py-4 bg-red-600/10 hover:bg-red-600 border border-red-600/50 hover:border-red-600 text-red-500 hover:text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 group"
                    >
                        <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
                        EXIT GAME
                    </button>
                    <p className="text-center text-xs text-slate-500 mt-2">Any unsaved progress will be lost.</p>
                </div>
            </div>
        </ModalWrapper>
    );
};

// --- RULES MODAL ---
export const RulesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <ModalWrapper onClose={onClose} title={<><BookOpen className="text-yellow-400" /> Rules</>}>
         <div className="space-y-6 text-slate-300">
             <section>
                 <h3 className="text-lg font-bold text-white mb-2">The Goal</h3>
                 <p className="text-sm leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
                     Be the first player to get rid of all your cards. When you have one card left, you must shout <strong>"UNO"</strong>!
                 </p>
             </section>
             <section>
                 <h3 className="text-lg font-bold text-white mb-2">Action Cards</h3>
                 <div className="grid grid-cols-2 gap-3">
                     {[
                         { label: 'Skip', desc: 'Next player loses turn', color: 'text-red-400' },
                         { label: 'Reverse', desc: 'Reverses direction', color: 'text-blue-400' },
                         { label: '+2 Draw', desc: 'Next draws 2 cards', color: 'text-green-400' },
                         { label: 'Wild', desc: 'Change color', color: 'text-purple-400' },
                         { label: 'Wild +4', desc: 'Change color & +4 cards', color: 'text-yellow-400' },
                     ].map((c, i) => (
                         <div key={i} className="bg-black/20 p-3 rounded-xl border border-white/5">
                             <div className={`font-black uppercase text-xs ${c.color} mb-1`}>{c.label}</div>
                             <div className="text-[10px] text-white/60">{c.desc}</div>
                         </div>
                     ))}
                 </div>
             </section>
         </div>
    </ModalWrapper>
);

// --- CONFIRM MODAL ---
interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    type: 'danger' | 'neutral';
}
export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, title, message, onConfirm, onCancel, type }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
            <div className={`bg-slate-900 border border-white/10 p-6 rounded-3xl max-w-sm w-full text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] ${type === 'danger' ? 'shadow-red-900/20' : ''}`}>
                <div className={`w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center ${type === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                    <AlertTriangle size={28} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                <p className="text-slate-400 text-sm mb-6">{message}</p>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold text-xs uppercase bg-white/5 hover:bg-white/10 text-white transition-colors">Cancel</button>
                    <button onClick={onConfirm} className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase shadow-lg transition-transform active:scale-95 ${type === 'danger' ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>Confirm</button>
                </div>
            </div>
        </div>
    );
}

// --- ACHIEVEMENTS MODAL ---
export const AchievementsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    
    useEffect(() => {
        setAchievements(getAchievements());
    }, []);

    const unlockedCount = achievements.filter(a => a.unlocked).length;
    const progress = Math.round((unlockedCount / achievements.length) * 100);

    return (
        <ModalWrapper onClose={onClose} title={<><Star className="text-yellow-400" /> Achievements</>} colorClass="from-indigo-950 to-slate-950">
             <div className="mb-6">
                 <div className="flex justify-between text-xs font-bold text-indigo-300 uppercase mb-2">
                     <span>Progress</span>
                     <span>{unlockedCount} / {achievements.length}</span>
                 </div>
                 <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                     <div className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
                 </div>
             </div>

             <div className="space-y-3">
                 {achievements.map(ach => {
                     const Icon = IconMap[ach.icon] || Star;
                     return (
                        <div key={ach.id} className={`relative p-4 rounded-xl border flex items-center gap-4 transition-all ${ach.unlocked ? 'bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'bg-white/5 border-white/5 opacity-60 grayscale'}`}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${ach.unlocked ? 'bg-indigo-500 text-white shadow-lg' : 'bg-white/10 text-white/20'}`}>
                                <Icon size={24} />
                            </div>
                            <div className="flex-1">
                                <h4 className={`font-bold ${ach.unlocked ? 'text-white' : 'text-slate-400'}`}>{ach.title}</h4>
                                <p className="text-xs text-slate-500">{ach.description}</p>
                            </div>
                            {ach.unlocked && <div className="text-green-400"><Zap size={16} fill="currentColor"/></div>}
                        </div>
                     );
                 })}
             </div>
        </ModalWrapper>
    );
};

// --- LEADERBOARD MODAL ---
export const LeaderboardModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [scores, setScores] = useState<LeaderboardEntry[]>([]);

    useEffect(() => {
        setScores(getLeaderboard());
    }, []);

    return (
        <ModalWrapper onClose={onClose} title={<><Trophy className="text-yellow-400" /> Hall of Fame</>} colorClass="from-slate-900 to-black">
             {scores.length === 0 ? (
                 <div className="text-center py-10 opacity-50">
                     <Trophy size={48} className="mx-auto mb-4 text-slate-600" />
                     <p>No games won yet. Be the first!</p>
                 </div>
             ) : (
                 <div className="space-y-2">
                     {scores.map((score, index) => (
                         <div key={index} className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                             <div className={`w-8 h-8 flex items-center justify-center font-black text-sm rounded-lg ${index === 0 ? 'bg-yellow-400 text-black' : index === 1 ? 'bg-slate-300 text-black' : index === 2 ? 'bg-orange-400 text-black' : 'bg-slate-800 text-slate-400'}`}>
                                 {index + 1}
                             </div>
                             <div className="flex-1">
                                 <div className="font-bold text-white text-sm">{score.winnerName}</div>
                                 <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                     <span className="bg-white/10 px-1.5 rounded">{score.mode}</span>
                                     <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(score.date).toLocaleDateString()}</span>
                                 </div>
                             </div>
                             <div className="text-right">
                                 <div className="font-black text-lg text-emerald-400 leading-none">{score.turns}</div>
                                 <div className="text-[10px] text-slate-500 uppercase font-bold">Turns</div>
                             </div>
                         </div>
                     ))}
                 </div>
             )}
        </ModalWrapper>
    );
};