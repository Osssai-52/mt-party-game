'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { MafiaPlayer, MafiaPhase } from '../types/mafia';
import { useEffect, useState } from 'react';

interface MafiaBoardProps {
    players: MafiaPlayer[];
    phase: MafiaPhase;
    timer: number;
    systemMessage: string; 
}

export default function MafiaBoard({ players, phase, timer, systemMessage }: MafiaBoardProps) {
    // 밤인지 확인 (배경색 변경용)
    const isNight = phase === 'NIGHT';

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center transition-colors duration-1000 ${isNight ? 'bg-slate-900 text-white' : 'bg-sky-100 text-black'}`}>
            
            {/* 🌙 해/달 애니메이션 */}
            <div className="absolute top-10 right-10 text-8xl animate-pulse">
                {isNight ? '🌕' : '☀️'}
            </div>

            {/* ⏰ 타이머 & 페이즈 정보 */}
            <div className="text-center z-10 mb-10">
                <h2 className={`text-4xl font-bold mb-4 ${isNight ? 'text-purple-400' : 'text-blue-600'}`}>
                    {phase.replace('_', ' ')}
                </h2>
                <div className={`text-9xl font-black font-mono ${timer <= 5 ? 'text-red-500 animate-ping' : ''}`}>
                    {timer}
                </div>
            </div>

            {/* 📢 시스템 메시지 (사회자 멘트) */}
            <AnimatePresence mode='wait'>
                <motion.div 
                    key={systemMessage}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="text-3xl font-bold bg-black/50 px-8 py-4 rounded-full backdrop-blur-md text-white mb-12 text-center max-w-4xl"
                >
                    {systemMessage}
                </motion.div>
            </AnimatePresence>

            {/* 👥 생존자 현황판 */}
            <div className="grid grid-cols-4 gap-6 w-full max-w-6xl px-4">
                {players.map((p) => (
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
                        {/* 프로필 이미지 or 이니셜 */}
                        <div className="w-20 h-20 rounded-full bg-gray-300 flex items-center justify-center text-3xl font-bold mb-2 overflow-hidden">
                            {p.profileImage ? <img src={p.profileImage} alt="" /> : p.nickname[0]}
                        </div>
                        
                        <span className={`text-xl font-bold ${!p.isAlive && 'line-through decoration-red-500 decoration-4'}`}>
                            {p.nickname}
                        </span>

                        {/* 사망 표시 */}
                        {!p.isAlive && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
                                <span className="text-red-600 text-6xl font-black rotate-[-20deg] border-4 border-red-600 px-2">DEAD</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}