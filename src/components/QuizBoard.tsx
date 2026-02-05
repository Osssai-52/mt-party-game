'use client';

import { motion } from 'framer-motion';
import { QuizCategory, QuizPhase, QuizState } from '../types/quiz';

interface QuizBoardProps {
    phase: QuizPhase;
    gameState: QuizState;
    categories: QuizCategory[];
    ranking?: Record<string, number> | null;
    teamCount?: number;
    onTeamCountChange?: (delta: number) => void;
    onConfirmTeam?: () => void;
    onStartRound: (catId: number) => void;
    onNextTeam: () => void;
    onEndGame: () => void;
    onCorrect?: () => void;
}

export default function QuizBoard({ phase, gameState, categories, ranking, teamCount = 2, onTeamCountChange = () => { }, onConfirmTeam = () => { }, onStartRound, onNextTeam, onEndGame, onCorrect }: QuizBoardProps) {

    // 0. 팀 설정 (게임 시작 전)
    if (phase === 'TEAM_SETUP') {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-blue-900 text-white p-8">
                <h1 className="text-4xl font-bold mb-8">👥 팀 개수를 설정하세요</h1>
                <div className="flex items-center gap-8 mb-12">
                    <button onClick={() => onTeamCountChange(-1)} className="w-16 h-16 bg-blue-700 rounded-full text-3xl font-bold shadow-lg hover:bg-blue-600">-</button>
                    <div className="text-8xl font-black bg-white text-blue-900 w-40 h-40 rounded-3xl flex items-center justify-center shadow-inner">
                        {teamCount}
                    </div>
                    <button onClick={() => onTeamCountChange(1)} className="w-16 h-16 bg-blue-700 rounded-full text-3xl font-bold shadow-lg hover:bg-blue-600">+</button>
                </div>
                <button
                    onClick={onConfirmTeam}
                    className="px-12 py-6 bg-green-500 rounded-2xl text-3xl font-black shadow-xl hover:scale-105 transition transform"
                >
                    설정 완료 & 카테고리 선택 👉
                </button>
            </div>
        );
    }

    // 1. 대기 화면 (카테고리 선택)
    if (phase === 'WAITING') {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-blue-900 text-white p-8">
                <h1 className="text-4xl font-bold mb-8 animate-bounce">🎬 카테고리를 선택하세요!</h1>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 w-full max-w-4xl">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => onStartRound(cat.id)}
                            className="p-8 bg-white text-blue-900 rounded-3xl text-2xl font-black shadow-lg hover:scale-105 transition transform border-b-8 border-blue-200"
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // 2. 게임 진행 중
    if (phase === 'PLAYING') {
        return (
            <div className="w-full h-full flex flex-col items-center justify-between bg-white text-black p-6 relative overflow-hidden">
                <div className="w-full flex justify-between items-center z-10">
                    <div className="bg-black text-white px-6 py-2 rounded-full font-bold text-xl">
                        Team {gameState.currentTeam || '?'}
                    </div>
                    <div className={`text-6xl font-mono font-black ${gameState.remainingSeconds <= 10 ? 'text-red-600 animate-pulse' : 'text-blue-600'}`}>
                        {gameState.remainingSeconds}
                    </div>
                </div>

                <div className="flex-1 flex items-center justify-center w-full z-10">
                    <motion.div
                        key={gameState.currentWord}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-[10rem] font-black text-center leading-tight tracking-tighter break-keep drop-shadow-2xl"
                    >
                        {gameState.currentWord || "Ready..."}
                    </motion.div>
                </div>

                <div className="w-full flex items-center justify-between border-t-2 border-gray-200 pt-6 px-4">
                    <div className="flex gap-12 text-3xl font-bold">
                        {Object.entries(gameState.score).map(([team, score]) => (
                            <div key={team} className={team === gameState.currentTeam ? 'text-blue-600' : 'text-gray-400'}>
                                {team}팀 : {score}점
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-4">
                        {onCorrect && (
                            <button
                                onClick={onCorrect}
                                className="px-20 py-8 bg-green-500 text-white rounded-3xl text-5xl font-black shadow-lg hover:bg-green-400 active:scale-95 transition"
                            >
                                ⭕ 정답
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // 3. 라운드 종료
    if (phase === 'ROUND_END') {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white p-8">
                <div className="text-6xl mb-4">⌛ Time Over!</div>
                <h2 className="text-3xl font-bold mb-12">중간 점수 확인</h2>

                <div className="bg-gray-800 p-8 rounded-3xl w-full max-w-2xl mb-8">
                    {Object.entries(gameState.score).map(([team, score]) => (
                        <div key={team} className="flex justify-between text-4xl font-bold mb-4 last:mb-0 border-b border-gray-700 pb-2 last:border-0">
                            <span>Team {team}</span>
                            <span className="text-yellow-400">{score}점</span>
                        </div>
                    ))}
                </div>

                <div className="flex gap-4">
                    <button onClick={onNextTeam} className="px-8 py-4 bg-green-600 rounded-xl font-bold text-2xl hover:bg-green-500">
                        다음 팀 진행 👉
                    </button>
                    <button onClick={onEndGame} className="px-8 py-4 bg-red-600 rounded-xl font-bold text-2xl hover:bg-red-500">
                        최종 결과 보기 🏆
                    </button>
                </div>
            </div>
        );
    }

    // 4. 최종 결과 (Ranking)
    if (phase === 'FINISHED') {
        // 랭킹 데이터 정렬 (점수 높은 순)
        const sortedRanking = ranking
            ? Object.entries(ranking).sort(([, a], [, b]) => b - a)
            : [];

        const winner = sortedRanking.length > 0 ? sortedRanking[0][0] : '?';

        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-black text-white p-8 overflow-hidden relative">
                {/* 폭죽 효과 (배경) */}
                <div className="absolute inset-0 opacity-30 animate-pulse bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-500 via-transparent to-transparent" />

                <h1 className="text-6xl font-black mb-12 text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 drop-shadow-lg z-10">
                    🏆 FINAL RANKING 🏆
                </h1>

                <div className="flex items-end gap-8 mb-16 z-10">
                    {/* 2등 */}
                    {sortedRanking[1] && (
                        <div className="flex flex-col items-center">
                            <div className="text-2xl font-bold mb-2 text-gray-300">{sortedRanking[1][0]}팀</div>
                            <div className="w-32 h-40 bg-gray-400 rounded-t-lg flex items-center justify-center text-3xl font-black text-gray-800 shadow-xl">
                                2nd
                            </div>
                            <div className="mt-2 text-3xl font-bold">{sortedRanking[1][1]}점</div>
                        </div>
                    )}

                    {/* 1등 */}
                    {sortedRanking[0] && (
                        <div className="flex flex-col items-center">
                            <div className="text-6xl mb-4 animate-bounce">👑</div>
                            <div className="text-4xl font-bold mb-2 text-yellow-300">{sortedRanking[0][0]}팀</div>
                            <div className="w-40 h-64 bg-yellow-400 rounded-t-lg flex items-center justify-center text-5xl font-black text-yellow-900 shadow-[0_0_50px_rgba(250,204,21,0.6)] z-20">
                                1st
                            </div>
                            <div className="mt-4 text-5xl font-black text-yellow-400">{sortedRanking[0][1]}점</div>
                        </div>
                    )}

                    {/* 3등 */}
                    {sortedRanking[2] && (
                        <div className="flex flex-col items-center">
                            <div className="text-2xl font-bold mb-2 text-orange-300">{sortedRanking[2][0]}팀</div>
                            <div className="w-32 h-24 bg-orange-500 rounded-t-lg flex items-center justify-center text-3xl font-black text-orange-900 shadow-xl">
                                3rd
                            </div>
                            <div className="mt-2 text-3xl font-bold">{sortedRanking[2][1]}점</div>
                        </div>
                    )}
                </div>

                {/* 4등 이하 리스트 */}
                {sortedRanking.length > 3 && (
                    <div className="w-full max-w-4xl z-10 mb-8">
                        <div className="flex flex-wrap justify-center gap-4">
                            {sortedRanking.slice(3).map(([team, score], index) => (
                                <div key={team} className="bg-white/10 border border-white/20 backdrop-blur-sm px-6 py-3 rounded-xl flex items-center gap-4 animate-fadeIn">
                                    <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-sm font-bold">
                                        {index + 4}th
                                    </span>
                                    <span className="text-white font-bold text-xl">{team}팀</span>
                                    <div className="w-px h-4 bg-white/20"></div>
                                    <span className="text-gray-300 text-lg font-mono">{score}점</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <button onClick={() => window.location.reload()} className="px-10 py-4 bg-white text-black rounded-full font-bold text-xl hover:scale-105 transition z-10 shadow-lg">
                    메인으로 돌아가기 🏠
                </button>
            </div>
        );
    }

    return null;
}