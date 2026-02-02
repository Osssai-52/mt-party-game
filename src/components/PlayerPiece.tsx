'use client';

import { motion } from 'framer-motion';

interface PlayerProps {
    nickname: string;
    profileImage?: string | null; // 프로필 사진 URL (옵션)
    color: string;         // 플레이어 고유 색상
    positionIndex: number; // 현재 몇 번 칸에 있는지 (0~27)
}

export default function PlayerPiece({ nickname, profileImage, color, positionIndex }: PlayerProps) {
    return (
        <div className="relative w-10 h-10 md:w-14 md:h-14 rounded-full border-4 shadow-lg z-50 transition-all duration-500 bg-white"
            style={{ borderColor: color }}>

            {/* 사진이 있으면 사진, 없으면 닉네임 첫 글자 */}
            {profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profileImage} alt={nickname} className="w-full h-full object-cover rounded-full" />
            ) : (
                <div className="w-full h-full flex items-center justify-center rounded-full" style={{ backgroundColor: color + '40' }}>
                    <span className="font-hand font-bold text-gray-800 text-lg">{(nickname || '?').slice(0, 1)}</span>
                </div>
            )}

            {/* 말 위에 둥둥 떠있는 닉네임 (말풍선) */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 text-white text-[10px] md:text-xs px-2 py-1 rounded-full border border-white/20 shadow-sm z-50">
                {nickname}
                {/* 말풍선 꼬리 */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/80 rotate-45 -z-10"></div>
            </div>
        </div>
    );
}