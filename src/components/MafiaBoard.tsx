'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { MafiaPlayer, MafiaPhase } from '../types/mafia';

interface MafiaBoardProps {
    players: MafiaPlayer[];
    phase: MafiaPhase;
    timer: number;
    systemMessage: string;
    voteStatus?: Record<string, number>; // 실시간 지목 투표 현황
    // 🌟 [추가] 실시간 찬반 투표 현황
    finalVoteStatus?: { agree: number; disagree: number };
    winner?: 'MAFIA' | 'CITIZEN' | null;
}

export default function MafiaBoard({ players, phase, timer, systemMessage, voteStatus, finalVoteStatus, winner }: MafiaBoardProps) {
    // 밤인지 확인
    const isNight = phase === 'NIGHT';

    // 🏆 게임 종료 화면
    if (phase === 'END' && winner) {
        return (
            <div className={`w-full h-full flex flex-col items-center justify-center ${winner === 'MAFIA' ? 'bg-red-900' : 'bg-blue-600'} text-white`}>
                <h1 className="text-9xl mb-8">{winner === 'MAFIA' ? '😈' : '👮‍♂️'}</h1>
                <h2 className="text-6xl font-black animate-bounce">
                    {winner === 'MAFIA' ? 'MAFIA WINS' : 'CITIZEN WINS'}
                </h2>
                <p className="text-2xl mt-4 opacity-80">게임이 종료되었습니다.</p>
            </div>
        );
    }

    return (
        <div className={`relative w-full h-full flex flex-col items-center justify-center transition-colors duration-1000 ${isNight ? 'bg-slate-900 text-white' : 'bg-sky-100 text-black'}`}>
            
            {/* 🌙 해/달 애니메이션 */}
            <div className="absolute top-10 right-10 text-8xl animate-pulse z-0">
                {isNight ? '🌕' : '☀️'}
            </div>

            {/* ⏰ 타이머 & 페이즈 정보 */}
            <div className="text-center z-10 mb-10">
                <h2 className={`text-4xl font-bold mb-4 uppercase ${isNight ? 'text-purple-400' : 'text-blue-600'}`}>
                    {phase.replace(/_/g, ' ')}
                </h2>
                <div className={`text-9xl font-black font-mono ${timer <= 5 ? 'text-red-500 animate-ping' : ''}`}>
                    {timer}
                </div>
            </div>

            {/* 📢 시스템 메시지 */}
            <AnimatePresence mode='wait'>
                <motion.div 
                    key={systemMessage}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="text-3xl font-bold bg-black/50 px-8 py-4 rounded-full backdrop-blur-md text-white mb-12 text-center max-w-4xl z-20"
                >
                    {systemMessage}
                </motion.div>
            </AnimatePresence>

            {/* 🌟 찬반 투표 실시간 집계 화면 (오버레이) */}
            {phase === 'FINAL_VOTE' && finalVoteStatus && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="flex items-center gap-20">
                        <div className="flex flex-col items-center text-red-500 animate-pulse">
                            <span className="text-4xl font-bold mb-4">👍 찬성</span>
                            <span className="text-[10rem] font-black leading-none">{finalVoteStatus.agree}</span>
                        </div>
                        <div className="w-1 h-64 bg-gray-600 rounded-full"></div>
                        <div className="flex flex-col items-center text-blue-500 animate-pulse">
                            <span className="text-4xl font-bold mb-4">👎 반대</span>
                            <span className="text-[10rem] font-black leading-none">{finalVoteStatus.disagree}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* 👥 플레이어 그리드 */}
            <div className="grid grid-cols-4 gap-6 w-full max-w-6xl px-4 z-10">
                {players.map((p) => {
                    // 득표 수 (지목 투표)
                    const voteCount = voteStatus ? (voteStatus[p.nickname] || 0) : 0;

                    return (
                        <div 
                            key={p.deviceId} 
                            className={`
                                relative flex flex-col items-center justify-center p-4 rounded-xl border-4 transition-all duration-500
                                ${p.isAlive 
                                    ? (isNight ? 'bg-gray-800 border-gray-600' : 'bg-white border-white shadow-lg') 
                                    : 'bg-gray-900 border-gray-800 opacity-50 grayscale'
                                }
                            `}
                        >
                            <div className="w-20 h-20 rounded-full bg-gray-300 flex items-center justify-center text-3xl font-bold mb-2 overflow-hidden">
                                {p.profileImage ? <img src={p.profileImage} alt="" className="w-full h-full object-cover" /> : p.nickname[0]}
                            </div>
                            
                            <span className={`text-xl font-bold ${!p.isAlive && 'line-through decoration-red-500 decoration-4'}`}>
                                {p.nickname}
                            </span>

                            {/* 지목 투표 득표 뱃지 */}
                            {phase === 'VOTE' && voteCount > 0 && (
                                <div className="absolute -top-4 -right-4 bg-red-600 text-white w-12 h-12 rounded-full flex items-center justify-center font-bold text-2xl border-4 border-white shadow-lg z-10 animate-bounce">
                                    {voteCount}
                                </div>
                            )}

                            {/* 사망 표시 */}
                            {!p.isAlive && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
                                    <span className="text-red-600 text-6xl font-black rotate-[-20deg] border-4 border-red-600 px-2">DEAD</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}