'use client';

import { motion } from 'framer-motion';
import { LiarPhase, LiarPlayer } from '../types/liar';

interface LiarBoardProps {
    phase: LiarPhase;
    players: LiarPlayer[];
    timer: number;
    category: string;
    currentExplainerIndex: number;
    voteStatus: { agree: number; disagree: number };
    keywordResult?: string | null;
    liarNameResult?: string | null;
}

export default function LiarBoard({ 
    phase, players, timer, category, currentExplainerIndex, 
    voteStatus, keywordResult, liarNameResult 
}: LiarBoardProps) {

    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-green-950 text-green-100 relative overflow-hidden">
            {/* 배경 효과 */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-900/40 via-black to-black z-0" />
            
            {/* 상단 정보 */}
            <div className="z-10 flex flex-col items-center mb-8">
                <div className="text-emerald-400 font-mono text-xl tracking-widest mb-2">CATEGORY</div>
                <div className="text-4xl font-black bg-emerald-900/50 px-8 py-2 rounded-xl border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                    {category || "READY"}
                </div>
            </div>

            {/* 타이머 */}
            {(phase === 'ROLE_REVEAL' || phase === 'EXPLANATION' || phase === 'VOTE_MORE_ROUND') && (
                <div className={`z-10 text-8xl font-black font-mono mb-12 ${timer <= 5 ? 'text-red-500 animate-ping' : 'text-white'}`}>
                    {timer}
                </div>
            )}

            {/* 메인 컨텐츠 영역 */}
            <div className="z-10 w-full max-w-5xl">
                
                {/* 1. 역할 확인 & 지목 단계 */}
                {(phase === 'ROLE_REVEAL' || phase === 'POINTING') && (
                    <div className="text-center animate-pulse">
                        <h2 className="text-5xl font-bold mb-4">
                            {phase === 'ROLE_REVEAL' ? "🤫 역할을 확인하세요!" : "👉 라이어를 지목하세요!"}
                        </h2>
                        <p className="text-xl text-emerald-400/80">
                            {phase === 'ROLE_REVEAL' ? "스마트폰 화면을 확인해주세요." : "지금 가장 수상한 사람은 누구인가요?"}
                        </p>
                    </div>
                )}

                {/* 2. 설명 진행 중 (턴 표시) */}
                {phase === 'EXPLANATION' && (
                    <div className="grid grid-cols-4 gap-6">
                        {players.map((p, idx) => (
                            <motion.div 
                                key={p.deviceId}
                                animate={idx === currentExplainerIndex ? { scale: 1.1, borderColor: '#34d399' } : { scale: 1, borderColor: '#064e3b' }}
                                className={`p-6 rounded-2xl border-4 flex flex-col items-center bg-black/40 backdrop-blur-sm transition-colors duration-300
                                    ${idx === currentExplainerIndex ? 'shadow-[0_0_30px_rgba(52,211,153,0.5)]' : 'opacity-60'}
                                `}
                            >
                                <div className="w-20 h-20 rounded-full bg-emerald-800 flex items-center justify-center text-3xl mb-4">
                                    {p.profileImage ? <img src={p.profileImage} className="w-full h-full rounded-full"/> : p.nickname[0]}
                                </div>
                                <span className="text-xl font-bold">{p.nickname}</span>
                                {idx === currentExplainerIndex && <span className="mt-2 text-emerald-400 font-bold animate-bounce">SPEAKING 🎤</span>}
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* 3. 추가 라운드 투표 현황 */}
                {phase === 'VOTE_MORE_ROUND' && (
                    <div className="flex flex-col items-center gap-8">
                        <h2 className="text-4xl font-bold">🔄 한 턴 더 할까요?</h2>
                        <div className="flex gap-20 items-end h-64">
                            <div className="flex flex-col items-center">
                                <span className="text-3xl font-bold text-emerald-400 mb-4">YES</span>
                                <motion.div animate={{ height: `${voteStatus.agree * 20 + 20}px` }} className="w-24 bg-emerald-600 rounded-t-xl" />
                                <span className="text-4xl font-black mt-2">{voteStatus.agree}</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-3xl font-bold text-red-400 mb-4">NO</span>
                                <motion.div animate={{ height: `${voteStatus.disagree * 20 + 20}px` }} className="w-24 bg-red-800 rounded-t-xl" />
                                <span className="text-4xl font-black mt-2">{voteStatus.disagree}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. 게임 종료 (결과) */}
                {phase === 'GAME_END' && (
                    <div className="flex flex-col items-center justify-center text-center">
                        <div className="text-2xl text-emerald-400 mb-2">THE LIAR WAS</div>
                        <h1 className="text-7xl font-black text-white mb-8 drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">
                            {liarNameResult || "?"}
                        </h1>
                        <div className="bg-emerald-900/80 px-10 py-6 rounded-3xl border border-emerald-400">
                            <span className="text-emerald-300 block text-sm mb-1">KEYWORD</span>
                            <span className="text-5xl font-bold">{keywordResult || "?"}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}