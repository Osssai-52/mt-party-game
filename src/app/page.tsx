// src/app/page.tsx (여기가 메인 화면!)

'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { GAMES, GameType } from '../constants/gameList'; // 경로 확인 필요

// 🎨 Tailwind 색상 매핑
const GAME_THEMES: Record<GameType, string> = {
    JURUMARBLE: 'from-yellow-400 via-orange-500 to-red-500', 
    MAFIA: 'from-gray-700 via-gray-800 to-black',
    TRUTH: 'from-pink-500 via-rose-500 to-purple-600',
};

const SHADOW_COLORS: Record<GameType, string> = {
    JURUMARBLE: 'shadow-orange-500/50',
    MAFIA: 'shadow-gray-700/50',
    TRUTH: 'shadow-pink-500/50',
};

export default function GameSelectPage() {
    const router = useRouter();

    const handleCreateRoom = (gameId: GameType) => {
        // 1. 방 번호 생성 (랜덤 4자리)
        const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
        
        // 2. 방 번호와 게임 종류를 들고 '호스트 대기방'으로 이동! 🚀
        // 예: /host/1234?game=MAFIA
        router.push(`/host/${roomCode}?game=${gameId}`);
    };

    return (
        <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* ... (아까 언니가 짠 예쁜 디자인 코드 그대로) ... */}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl z-10">
                {GAMES.map((game, index) => {
                    const gradient = GAME_THEMES[game.id];
                    return (
                        <motion.div
                            key={game.id}
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.2 }}
                            onClick={() => handleCreateRoom(game.id)} // 클릭하면 이동!
                            className={`group cursor-pointer relative rounded-[32px] p-[3px] bg-gradient-to-br ${gradient} shadow-2xl`}
                        >
                            <div className="relative h-full bg-gray-900/95 backdrop-blur-xl rounded-[30px] p-8 flex flex-col items-center text-center">
                                <div className="text-7xl mb-6">{game.icon}</div>
                                <h2 className="text-3xl font-bold mb-3">{game.title}</h2>
                                <p className="text-gray-400 text-sm mb-8">{game.description}</p>
                                <div className={`px-8 py-3 rounded-full border border-white/10 text-sm font-bold uppercase group-hover:bg-gradient-to-r ${gradient}`}>
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