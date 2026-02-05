'use client';

import { motion } from 'framer-motion';

interface QuizControllerProps {
    roomId: string;
    phase: string;
    currentWord?: string | null;
    currentTeam?: string | null;
    remainingSeconds?: number;
}

export default function QuizController({ roomId, phase, currentWord, currentTeam, remainingSeconds }: QuizControllerProps) {

    // 게임 진행 중: 제시어 크게 표시
    if (phase === 'PLAYING') {
        return (
            <div className="h-full flex flex-col items-center justify-center p-6 bg-black">
                <div className="text-gray-400 text-sm font-mono mb-2">{currentTeam ? `${currentTeam}팀 차례` : ''}</div>
                {remainingSeconds != null && (
                    <div className={`text-4xl font-mono font-black mb-6 ${remainingSeconds <= 10 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
                        {remainingSeconds}s
                    </div>
                )}
                <motion.div
                    key={currentWord}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-5xl md:text-7xl font-black text-white text-center break-keep leading-tight"
                >
                    {currentWord || '...'}
                </motion.div>
                <p className="text-gray-500 text-sm mt-8">화면을 보고 맞춰주세요!</p>
            </div>
        );
    }

    // 라운드 종료
    if (phase === 'ROUND_END') {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-black text-white p-6 text-center">
                <div className="text-6xl mb-4">⌛</div>
                <h2 className="text-2xl font-bold">라운드 종료!</h2>
                <p className="text-gray-400 mt-2">호스트 화면을 확인하세요</p>
            </div>
        );
    }

    // 최종 결과
    if (phase === 'FINISHED') {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-black text-white p-6 text-center">
                <div className="text-6xl mb-4">🏆</div>
                <h2 className="text-2xl font-bold">게임 종료!</h2>
                <p className="text-gray-400 mt-2">호스트 화면에서 결과를 확인하세요</p>
            </div>
        );
    }

    // 대기 중
    return (
        <div className="h-full flex flex-col items-center justify-center bg-gray-900 text-white p-6 text-center">
            <div className="text-6xl mb-6">👀</div>
            <h2 className="text-2xl font-bold mb-2">화면을 주목하세요</h2>
            <p className="text-gray-400">곧 제시어가 나타납니다</p>
        </div>
    );
}
