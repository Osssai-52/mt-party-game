'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { GAMES, GameType } from '../constants/gameList'; 

const GAME_THEMES: Record<GameType, string> = {
    JURUMARBLE: 'from-yellow-400 via-orange-500 to-red-500', 
    MAFIA: 'from-red-600 via-red-900 to-black',
    TRUTH: 'from-pink-500 via-rose-500 to-purple-600',
    SPEED_QUIZ: 'from-blue-500 via-cyan-500 to-teal-500',
    LIAR: 'from-green-400 via-emerald-500 to-teal-600',
};

const SHADOW_COLORS: Record<GameType, string> = {
    JURUMARBLE: 'shadow-orange-500/50',
    MAFIA: 'shadow-red-600/50',
    TRUTH: 'shadow-pink-500/50',
    SPEED_QUIZ: 'shadow-cyan-500/50',
    LIAR: 'shadow-green-500/50',
};

export default function GameSelectPage() {
    const router = useRouter();

    const handleCreateRoom = (gameId: GameType) => {
        const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
        router.push(`/host/${roomCode}?game=${gameId}`);
    };

    return (
        <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
            
            {/* 배경 효과 */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-800 via-black to-black opacity-50 z-0" />
            
            {/* 1. 메인 타이틀 (Jjan!) */}
            <div className="z-20 text-center mb-10">
                <h1 className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 drop-shadow-[0_0_20px_rgba(255,165,0,0.6)] tracking-tighter animate-pulse font-hand">
                    Jjan!
                </h1>
                <p className="text-gray-400 text-lg mt-2 font-bold tracking-widest uppercase">
                    Premium Party Game Suite
                </p>
            </div>

            {/* 2. 그리드 전략 수정: 3열 -> 6열로 쪼개기 */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-8 w-full max-w-6xl z-10">
                {GAMES.map((game, index) => {
                    const gradient = GAME_THEMES[game.id];
                    
                    const gridClass = `md:col-span-2 ${index === 3 ? 'md:col-start-2' : ''}`;

                    return (
                        <motion.div
                            key={game.id}
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.2 }}
                            onClick={() => handleCreateRoom(game.id)} 
                            className={`group cursor-pointer relative rounded-[32px] p-[3px] bg-gradient-to-br ${gradient} shadow-2xl ${gridClass}`}
                        >
                            <div className="relative h-full bg-gray-900/95 backdrop-blur-xl rounded-[30px] p-8 flex flex-col items-center text-center">
                                <div className="text-7xl mb-6 group-hover:scale-110 transition-transform duration-300">{game.icon}</div>
                                <h2 className="text-3xl font-bold mb-3 whitespace-pre-wrap">{game.title}</h2>
                                <p className="text-gray-400 text-sm mb-8">{game.description}</p>
                                <div className={`px-8 py-3 rounded-full border border-white/10 text-sm font-bold uppercase group-hover:bg-gradient-to-r ${gradient} transition-all duration-300`}>
                                    Start Game
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </main>
    );
}