
import React, { useState } from 'react';
import { 
  Play, Users, Wifi, ArrowRight, Loader2, X, Clipboard, 
  Copy, Check, Bot, Monitor, Award, Trophy, User, Edit3
} from 'lucide-react';
import { NetworkMode } from '../types';
import CardView from './CardView';
import { CardColor, CardValue } from '../types';
import { AchievementsModal, LeaderboardModal } from './Modals';

interface LobbyProps {
    networkMode: NetworkMode;
    setNetworkMode: (mode: NetworkMode) => void;
    lobbyState: 'main' | 'host_setup' | 'join_setup' | 'client_waiting';
    setLobbyState: (state: 'main' | 'host_setup' | 'join_setup' | 'client_waiting') => void;
    roomName: string;
    setRoomName: (name: string) => void;
    joinInput: string;
    setJoinInput: (val: string) => void;
    roomCode: string;
    connectedPeerCount: number;
    isConnecting: boolean;
    enableOnlineBots: boolean;
    setEnableOnlineBots: (val: boolean) => void;
    kickMessage: string | null;
    setKickMessage: (msg: string | null) => void;
    botCount: number;
    setBotCount: (count: number) => void;
    onStartSolo: () => void;
    onStartHost: () => void;
    onJoinGame: () => void;
    onBackToLobby: () => void;
    onCopyCode: () => void;
    onKickPlayer: (idx: number) => void;
    copiedId: boolean;
    isOffline: boolean;
    hostRoomName: string;
    playerName: string;
    setPlayerName: (name: string) => void;
}

const Lobby: React.FC<LobbyProps> = (props) => {
    const [showAchievements, setShowAchievements] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(false);

    // Cinematic background elements
    const lobbyCards = [
        { id: 'l1', color: CardColor.Red, value: CardValue.DrawTwo, rot: -15, x: '10%', y: '20%', delay: '0s' },
        { id: 'l2', color: CardColor.Blue, value: CardValue.Reverse, rot: 15, x: '85%', y: '15%', delay: '1s' },
        { id: 'l3', color: CardColor.Yellow, value: CardValue.Wild, rot: -10, x: '20%', y: '80%', delay: '2s' },
        { id: 'l4', color: CardColor.Green, value: CardValue.Skip, rot: 5, x: '80%', y: '75%', delay: '1.5s' },
    ];

    return (
        <div className="fixed inset-0 bg-[#0f172a] overflow-hidden flex flex-col font-sans select-none">
            
            {/* --- Modals --- */}
            {showAchievements && <AchievementsModal onClose={() => setShowAchievements(false)} />}
            {showLeaderboard && <LeaderboardModal onClose={() => setShowLeaderboard(false)} />}

            {/* --- Background --- */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-[#0f172a] to-black"></div>
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>
                
                {/* Desktop Floating Cards */}
                <div className="hidden lg:block">
                    {lobbyCards.map((c) => (
                    <div key={c.id} className="absolute animate-float transition-all duration-1000 ease-in-out"
                        style={{ left: c.x, top: c.y, animationDelay: c.delay, '--rot': `${c.rot}deg` } as any}>
                        <div className="transform hover:scale-110 transition-transform duration-500 hover:rotate-12">
                             <CardView card={c as any} size="xl" className="shadow-[0_20px_50px_rgba(0,0,0,0.5)] brightness-75" />
                        </div>
                    </div>
                    ))}
                </div>
            </div>

            {/* --- Main Scrollable Area --- */}
            <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 pb-20">
                <div className="max-w-4xl mx-auto flex flex-col items-center gap-8 min-h-[90vh] justify-center">
                
                    {/* Error Message */}
                    {props.kickMessage && (
                        <div className="w-full max-w-lg bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-5">
                            <X size={18} /> {props.kickMessage}
                            <button onClick={() => props.setKickMessage(null)} className="ml-auto hover:text-white"><X size={14} /></button>
                        </div>
                    )}

                    {/* Logo */}
                    <div className="flex flex-col items-center group scale-90 md:scale-100 transition-transform mt-8">
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

                    {/* --- MAIN GAME CARD --- */}
                    <div className="w-full max-w-lg bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-pop ring-1 ring-white/5 mt-4">
                        
                        {/* Nickname Input - Only show in main lobby state */}
                         {props.lobbyState === 'main' && (
                            <div className="px-8 pt-6 pb-2">
                                <label className="text-[10px] uppercase font-black text-indigo-300 tracking-widest mb-1 block ml-1">YOUR NICKNAME</label>
                                <div className="relative">
                                    <input 
                                        value={props.playerName}
                                        onChange={(e) => props.setPlayerName(e.target.value)}
                                        maxLength={12}
                                        className="w-full bg-black/30 border border-white/10 focus:border-indigo-500 rounded-xl py-3 px-4 pl-10 text-white font-bold outline-none transition-colors placeholder:text-white/20"
                                        placeholder="Enter Name"
                                    />
                                    <Edit3 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                                </div>
                            </div>
                        )}

                        {/* Mode Tabs */}
                        <div className="p-6 md:p-8 pb-0">
                            {props.lobbyState === 'main' && (
                                <div className="relative flex bg-black/40 rounded-2xl p-1 mb-6">
                                    <button 
                                        onClick={() => props.setNetworkMode(NetworkMode.Offline)}
                                        className={`flex-1 py-3 md:py-4 rounded-xl font-black text-xs md:text-sm uppercase tracking-wider transition-all duration-300 relative z-10 flex items-center justify-center gap-2 ${props.networkMode === NetworkMode.Offline ? 'bg-slate-800 text-white shadow-lg ring-1 ring-white/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                                    >
                                        <User size={16} /> Solo
                                    </button>
                                    <button 
                                        onClick={() => { if(!props.isOffline) { props.setNetworkMode(NetworkMode.Host); props.setLobbyState('main'); }}}
                                        disabled={props.isOffline}
                                        className={`flex-1 py-3 md:py-4 rounded-xl font-black text-xs md:text-sm uppercase tracking-wider transition-all duration-300 relative z-10 flex items-center justify-center gap-2 ${props.networkMode !== NetworkMode.Offline ? 'bg-indigo-600 text-white shadow-lg ring-1 ring-white/10' : 'text-white/40 hover:text-white hover:bg-white/5'} ${props.isOffline ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <Wifi size={16} /> Online
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Content Body */}
                        <div className="px-6 md:px-8 pb-8 flex flex-col relative min-h-[200px]">
                            
                            {/* SOLO MODE */}
                            {props.networkMode === NetworkMode.Offline && (
                            <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="text-center mb-6">
                                        <h2 className="text-xl md:text-2xl font-black text-white mb-1">VS COMPUTER</h2>
                                        <p className="text-white/40 text-xs md:text-sm font-medium">Select opponent count</p>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-3 mb-6">
                                        {[1, 2, 3].map(num => (
                                            <button 
                                                key={num}
                                                onClick={() => props.setBotCount(num)}
                                                className={`group relative aspect-[3/4] rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-2 overflow-hidden ${props.botCount === num ? 'bg-gradient-to-b from-red-500/20 to-red-900/20 border-red-500 shadow-[0_0_30px_rgba(220,38,38,0.3)] scale-105' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'}`}
                                            >
                                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-colors ${props.botCount === num ? 'bg-red-500 text-white' : 'bg-white/10 text-white/30 group-hover:text-white'}`}>
                                                    <Bot size={20} md:size={24} />
                                                </div>
                                                <div className="text-center">
                                                    <span className={`block text-xl md:text-2xl font-black ${props.botCount === num ? 'text-white' : 'text-white/30 group-hover:text-white'}`}>{num}</span>
                                                    <span className="text-[10px] uppercase font-bold text-white/20 group-hover:text-white/40">Bots</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    <button 
                                        onClick={props.onStartSolo}
                                        className="mt-auto w-full py-4 md:py-5 rounded-2xl bg-gradient-to-r from-red-600 to-orange-600 text-white font-black text-lg md:text-xl tracking-widest shadow-lg hover:shadow-red-600/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group relative overflow-hidden"
                                    >
                                        <span>PLAY NOW</span>
                                        <Play size={20} md:size={24} fill="currentColor" />
                                    </button>
                            </div>
                            )}

                            {/* ONLINE MODE */}
                            {props.networkMode !== NetworkMode.Offline && (
                                <div className="flex flex-col h-full w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {props.lobbyState === 'main' && (
                                        <div className="flex flex-col gap-4 h-full justify-center">
                                            <button 
                                                onClick={() => props.setLobbyState('host_setup')}
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
                                                onClick={() => { props.setLobbyState('join_setup'); props.setNetworkMode(NetworkMode.Client); }}
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

                                    {props.lobbyState === 'host_setup' && (
                                        <div className="flex flex-col h-full">
                                            <div className="flex items-center mb-4">
                                                <button onClick={props.onBackToLobby} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors">
                                                    <ArrowRight size={16} className="rotate-180" />
                                                </button>
                                                <span className="ml-3 text-white/40 text-xs font-bold uppercase tracking-widest">Setup Room</span>
                                            </div>

                                            {!props.roomCode ? (
                                                <div className="flex-1 flex flex-col justify-center">
                                                    <div className="mb-6">
                                                        <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider ml-1 block mb-2">Room Name</label>
                                                        <input 
                                                            value={props.roomName}
                                                            onChange={(e) => props.setRoomName(e.target.value)}
                                                            className="w-full bg-black/40 border border-white/10 focus:border-indigo-500 focus:bg-black/60 rounded-xl p-4 text-white font-bold text-lg outline-none transition-all placeholder:text-white/10"
                                                            placeholder="e.g. Friday Night UNO"
                                                            maxLength={15}
                                                        />
                                                    </div>

                                                    <button 
                                                        onClick={props.onStartHost}
                                                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-black text-lg text-white shadow-lg hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 active:scale-95"
                                                    >
                                                        {props.isConnecting ? <Loader2 className="animate-spin" /> : 'GENERATE CODE'}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col h-full">
                                                    <div className="bg-black/40 rounded-xl p-4 border border-white/10 mb-4 text-center relative group cursor-pointer" onClick={props.onCopyCode}>
                                                        <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-1">Share this Code</p>
                                                        <p className="text-4xl font-mono font-black text-yellow-400 tracking-[0.1em]">{props.roomCode}</p>
                                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 p-2 rounded-lg">
                                                            <Copy size={16} className="text-white" />
                                                        </div>
                                                        {props.copiedId && <div className="absolute inset-0 bg-green-500/90 flex items-center justify-center rounded-xl z-10 font-bold text-black">COPIED!</div>}
                                                    </div>

                                                    <div className="flex-1 bg-white/5 rounded-xl p-4 mb-4 overflow-y-auto custom-scrollbar border border-white/5">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Lobby ({props.connectedPeerCount + 1}/4)</span>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-indigo-600/20 to-slate-800/50 rounded-lg border border-indigo-500/20">
                                                                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                                                                    <User size={16} />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="text-white font-bold text-sm">{props.playerName || 'Host'} <span className="text-white/40 ml-1">(You)</span></div>
                                                                    <div className="text-[10px] text-indigo-300 font-bold uppercase">Host</div>
                                                                </div>
                                                            </div>
                                                            {Array.from({ length: props.connectedPeerCount }).map((_, i) => (
                                                                <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/5 animate-in slide-in-from-left-2">
                                                                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white/50">
                                                                        <User size={16} />
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <div className="text-white/80 font-bold text-sm">Guest {i + 1}</div>
                                                                        <div className="text-[10px] text-slate-500 font-bold uppercase">Connecting...</div>
                                                                    </div>
                                                                    <button onClick={() => props.onKickPlayer(i)} className="text-white/20 hover:text-red-400 transition-colors p-2 hover:bg-white/5 rounded-lg"><X size={16} /></button>
                                                                </div>
                                                            ))}
                                                            {props.connectedPeerCount === 0 && (
                                                                <div className="text-center py-4 text-white/20 text-xs italic">Waiting for players to join...</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center justify-between mb-4 px-1">
                                                        <span className="text-xs font-bold text-white/60 uppercase">Fill Slots with Bots</span>
                                                        <button onClick={() => props.setEnableOnlineBots(!props.enableOnlineBots)} className={`w-12 h-7 rounded-full relative transition-colors border border-white/10 ${props.enableOnlineBots ? 'bg-green-500' : 'bg-black/40'}`}>
                                                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${props.enableOnlineBots ? 'left-6' : 'left-1'}`}></div>
                                                        </button>
                                                    </div>

                                                    <button 
                                                        onClick={props.onStartSolo}
                                                        disabled={props.connectedPeerCount === 0 && !props.enableOnlineBots}
                                                        className={`w-full py-4 rounded-xl font-black text-lg transition-all flex items-center justify-center gap-2 ${props.connectedPeerCount > 0 || props.enableOnlineBots ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg hover:shadow-green-500/30' : 'bg-white/10 text-white/20 cursor-not-allowed'}`}
                                                    >
                                                        START MATCH
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {props.lobbyState === 'join_setup' && (
                                        <div className="flex flex-col h-full">
                                            <div className="flex items-center mb-6">
                                                <button onClick={props.onBackToLobby} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors">
                                                    <ArrowRight size={16} className="rotate-180" />
                                                </button>
                                                <span className="ml-3 text-white/40 text-xs font-bold uppercase tracking-widest">Join Room</span>
                                            </div>

                                            <div className="flex-1 flex flex-col justify-center items-center text-center gap-6">
                                                <div className="relative w-full">
                                                    <input 
                                                        value={props.joinInput}
                                                        onChange={(e) => props.setJoinInput(e.target.value)}
                                                        className="w-full bg-black/40 border border-white/10 focus:border-emerald-500 focus:bg-black/60 rounded-xl p-6 text-center text-white font-mono font-black text-4xl tracking-[0.2em] uppercase outline-none transition-all placeholder:text-white/5"
                                                        placeholder="CODE"
                                                        maxLength={6}
                                                    />
                                                    <button 
                                                        onClick={async () => {
                                                            try {
                                                                const text = await navigator.clipboard.readText();
                                                                props.setJoinInput(text);
                                                            } catch(e) {}
                                                        }}
                                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/20 hover:text-white transition-colors"
                                                    >
                                                        <Clipboard size={20} />
                                                    </button>
                                                </div>

                                                <button 
                                                    onClick={props.onJoinGame}
                                                    disabled={!props.joinInput || props.isConnecting}
                                                    className={`w-full py-4 rounded-xl font-black text-lg transition-all flex items-center justify-center gap-2 ${props.joinInput && !props.isConnecting ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg hover:shadow-emerald-500/30' : 'bg-white/10 text-white/20 cursor-not-allowed'}`}
                                                >
                                                    {props.isConnecting ? <Loader2 size={24} className="animate-spin" /> : 'CONNECT'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {props.lobbyState === 'client_waiting' && (
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
                                                <p className="text-4xl font-mono font-black text-white tracking-widest uppercase">{props.roomCode}</p>
                                                {props.hostRoomName && <p className="text-sm text-emerald-400 font-bold mt-2 border-t border-white/5 pt-2">{props.hostRoomName}</p>}
                                            </div>

                                            <button 
                                                onClick={props.onBackToLobby}
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
                    
                    {/* Placeholder Grid */}
                    <div className="w-full max-w-lg grid grid-cols-2 gap-3 md:gap-4 animate-in slide-in-from-bottom-8 duration-700 delay-100">
                        <button onClick={() => setShowAchievements(true)} className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 p-4 rounded-2xl flex flex-col gap-2 relative overflow-hidden group hover:scale-[1.02] transition-transform shadow-lg">
                            <div className="flex justify-between items-start">
                                <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-400"><Award size={20} /></div>
                            </div>
                            <div className="text-left mt-1">
                                <div className="text-white font-bold text-sm md:text-base">Achievements</div>
                                <div className="text-slate-400 text-[10px] md:text-xs">View your progress</div>
                            </div>
                        </button>
                        
                        <button onClick={() => setShowLeaderboard(true)} className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 p-4 rounded-2xl flex flex-col gap-2 relative overflow-hidden group hover:scale-[1.02] transition-transform shadow-lg">
                            <div className="flex justify-between items-start">
                                <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400"><Trophy size={20} /></div>
                            </div>
                            <div className="text-left mt-1">
                                <div className="text-white font-bold text-sm md:text-base">Leaderboard</div>
                                <div className="text-slate-400 text-[10px] md:text-xs">Hall of Fame</div>
                            </div>
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Lobby;
