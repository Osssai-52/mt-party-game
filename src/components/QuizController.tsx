'use client';

import gameApi from '../services/gameApi';

interface QuizControllerProps {
    roomId: string;
    phase: string; 
}

export default function QuizController({ roomId, phase }: QuizControllerProps) {
    
    const handleCorrect = async () => {
        try { await gameApi.quiz.correct(roomId); } catch (e) {}
    };

    const handlePass = async () => {
        try { await gameApi.quiz.pass(roomId); } catch (e) {}
    };

    // 게임 중일 때만 컨트롤러 표시
    if (phase === 'PLAYING') {
        return (
            <div className="h-full flex flex-col p-6 gap-6">
                <div className="text-center text-white mb-4">
                    <h2 className="text-2xl font-bold">설명해주세요! 📢</h2>
                    <p className="text-gray-400">화면의 제시어를 설명하세요</p>
                </div>

                <div className="flex-1 flex flex-col gap-4">
                    {/* 정답 버튼 (엄청 큼) */}
                    <button 
                        onClick={handleCorrect}
                        className="flex-1 bg-green-500 rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.4)] active:scale-95 transition"
                    >
                        <div className="flex flex-col items-center">
                            <span className="text-8xl">⭕</span>
                            <span className="text-4xl font-black text-white mt-2">정답!</span>
                        </div>
                    </button>

                    {/* 패스 버튼 */}
                    <button 
                        onClick={handlePass}
                        className="h-32 bg-red-500 rounded-2xl flex items-center justify-center active:scale-95 transition"
                    >
                        <div className="flex items-center gap-4">
                            <span className="text-4xl">❌</span>
                            <span className="text-2xl font-bold text-white">PASS</span>
                        </div>
                    </button>
                </div>
            </div>
        );
    }

    // 대기 중일 때
    return (
        <div className="h-full flex flex-col items-center justify-center bg-gray-900 text-white p-6 text-center">
            <div className="text-6xl mb-6">👀</div>
            <h2 className="text-2xl font-bold mb-2">화면을 주목하세요</h2>
            <p className="text-gray-400">화면에 제시어가 나타납니다.</p>
        </div>
    );
}