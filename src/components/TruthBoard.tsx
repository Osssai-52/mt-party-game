'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import FaceTracker from './FaceTracker';
import { TruthPhase, TruthAnswerer, TruthQuestion, FaceAnalysisData } from '../types/truth';

interface Player {
    deviceId: string;
    nickname: string;
}

interface TruthBoardProps {
    phase: TruthPhase;
    answerer: TruthAnswerer | null;
    question: TruthQuestion | null;
    result: FaceAnalysisData | null;
    setRealtimeFace: (data: FaceAnalysisData) => void;
    realtimeFace: FaceAnalysisData;
    roomId: string;
    players?: Player[];
    questionCount?: number;
    voteDoneCount?: number;
    totalVoters?: number;
    onSelectRandom?: () => void;
    onSelectAnswerer?: (deviceId: string) => void;
    onFinishSubmit?: () => void;
    onFinishQuestionVote?: () => void;
    onFinishAnswering?: () => void;
    onNextRound?: () => void;
}

export default function TruthBoard({
    phase, answerer, question, result, setRealtimeFace, realtimeFace, roomId,
    players, questionCount = 0, voteDoneCount = 0, totalVoters = 0,
    onSelectRandom, onSelectAnswerer, onFinishSubmit, onFinishQuestionVote, onFinishAnswering, onNextRound
}: TruthBoardProps) {
    const [statusMsg, setStatusMsg] = useState("카메라 준비 중...");
    const [showPlayerList, setShowPlayerList] = useState(false);
    const [timer, setTimer] = useState(10);
    const timerFinishedRef = useRef(false);

    // 10초 타이머 (ANSWERING 페이즈)
    useEffect(() => {
        if (phase !== 'ANSWERING') {
            setTimer(10);
            timerFinishedRef.current = false;
            return;
        }
        timerFinishedRef.current = false;
        setTimer(10);

        const interval = setInterval(() => {
            setTimer(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    if (!timerFinishedRef.current) {
                        timerFinishedRef.current = true;
                        onFinishAnswering?.();
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [phase]);

    // SELECT_ANSWERER: 답변자 선택 화면
    if (phase === 'SELECT_ANSWERER') {
        return (
            <div className="relative w-screen h-screen bg-black overflow-hidden flex flex-col items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/30 to-black" />
                <div className="relative z-10 flex flex-col items-center gap-8 p-8 max-w-2xl w-full">
                    <h2 className="text-3xl md:text-5xl font-black text-white tracking-widest mb-4">답변자 선택</h2>
                    <p className="text-gray-400 text-lg font-mono">누가 진실을 말할까요?</p>

                    {!showPlayerList ? (
                        <div className="flex flex-col gap-6 w-full max-w-md mt-4">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={onSelectRandom}
                                className="w-full py-6 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-2xl text-2xl font-bold text-white shadow-lg shadow-cyan-900/50 transition-all"
                            >
                                🎲 랜덤으로 답변자 선택
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowPlayerList(true)}
                                className="w-full py-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-2xl text-2xl font-bold text-white shadow-lg shadow-purple-900/50 transition-all"
                            >
                                👆 답변자 고르기
                            </motion.button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 w-full max-w-md mt-4">
                            <button
                                onClick={() => setShowPlayerList(false)}
                                className="self-start text-gray-400 hover:text-white text-sm font-mono mb-2 transition-colors"
                            >
                                ← 뒤로가기
                            </button>
                            <div className="grid grid-cols-1 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                                {players?.map((p) => (
                                    <motion.button
                                        key={p.deviceId}
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => onSelectAnswerer?.(p.deviceId)}
                                        className="w-full py-4 px-6 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-cyan-500 rounded-xl text-xl font-bold text-white transition-all flex items-center gap-3"
                                    >
                                        <span className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-sm font-black">
                                            {p.nickname[0]}
                                        </span>
                                        {p.nickname}
                                    </motion.button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // SUBMIT_QUESTIONS: 질문 모으는 중
    if (phase === 'SUBMIT_QUESTIONS') {
        const totalExpected = (players?.length || 1) - 1; // 답변자 제외
        return (
            <div className="relative w-screen h-screen bg-black overflow-hidden flex flex-col items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-b from-purple-950/30 to-black" />
                <div className="relative z-10 flex flex-col items-center gap-8 p-8 max-w-2xl w-full">
                    {answerer && (
                        <div className="bg-red-600 px-6 py-2 rounded-xl mb-2">
                            <span className="text-white font-bold text-lg">답변자: {answerer.nickname}</span>
                        </div>
                    )}
                    <motion.div
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="text-6xl mb-2"
                    >
                        📝
                    </motion.div>
                    <h2 className="text-3xl md:text-5xl font-black text-white tracking-wide">질문 모으는 중...</h2>
                    <div className="flex items-center gap-4 mt-4">
                        <div className="text-6xl md:text-8xl font-black text-cyan-400 font-mono">
                            {questionCount}
                        </div>
                        <div className="text-2xl text-gray-500 font-mono">/ {totalExpected}</div>
                    </div>
                    <p className="text-gray-400 text-lg">플레이어들이 질문을 제출하고 있습니다</p>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onFinishSubmit}
                        className="mt-6 px-10 py-4 bg-purple-600 hover:bg-purple-500 rounded-2xl text-xl font-bold text-white shadow-lg transition-all"
                    >
                        질문 마감
                    </motion.button>
                </div>
            </div>
        );
    }

    // SELECT_QUESTION: 투표 진행 중
    if (phase === 'SELECT_QUESTION') {
        return (
            <div className="relative w-screen h-screen bg-black overflow-hidden flex flex-col items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-950/30 to-black" />
                <div className="relative z-10 flex flex-col items-center gap-8 p-8 max-w-2xl w-full">
                    <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="text-6xl mb-2"
                    >
                        🗳️
                    </motion.div>
                    <h2 className="text-3xl md:text-5xl font-black text-white tracking-wide">투표 진행 중...</h2>
                    <p className="text-gray-400 text-lg mt-2">어떤 질문이 가장 궁금한가요?</p>
                    <div className="bg-gray-800/80 px-8 py-4 rounded-2xl border border-gray-700 mt-4">
                        <span className="text-gray-400 font-mono text-lg">투표 완료: </span>
                        <span className="text-3xl font-black text-cyan-400 font-mono">{voteDoneCount}</span>
                        <span className="text-gray-500 font-mono text-lg"> / {totalVoters} 명</span>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onFinishQuestionVote}
                        className="mt-6 px-10 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl text-xl font-bold text-white shadow-lg transition-all"
                    >
                        투표 마감
                    </motion.button>
                </div>
            </div>
        );
    }

    // ANSWERING & RESULT: 카메라 + HUD
    return (
        <div className="relative w-screen h-screen bg-black overflow-hidden flex flex-col items-center justify-center">

            {/* 배경: 얼굴 인식 카메라 */}
            <div className="absolute inset-0 z-0">
                <FaceTracker
                    roomId={roomId}
                    targetDeviceId={answerer?.deviceId || ''}
                    onStatusChange={setStatusMsg}
                    onAnalyze={setRealtimeFace}
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_40%,black_100%)] z-10" />
            </div>

            {/* UI 레이어 */}
            <div className="relative z-20 w-full h-full flex flex-col pointer-events-none p-4">

                {/* 상단 상태바 */}
                <div className="flex justify-between items-start">
                    <div className="bg-black/60 backdrop-blur border border-green-500/50 px-3 py-1 rounded-lg text-green-400 font-mono text-xs md:text-sm animate-pulse">
                        ● {statusMsg}
                    </div>
                    <div className="flex items-center gap-4">
                        {/* 타이머 (ANSWERING) */}
                        {phase === 'ANSWERING' && (
                            <div className={`bg-black/70 backdrop-blur border-2 px-4 py-2 rounded-xl font-mono text-3xl md:text-4xl font-black ${
                                timer <= 3 ? 'border-red-500 text-red-500 animate-pulse' : 'border-cyan-500 text-cyan-400'
                            }`}>
                                {timer}s
                            </div>
                        )}
                        {answerer && (
                            <div className="text-right">
                                <div className="text-[10px] md:text-xs text-gray-400 mb-1 font-mono">TARGET SUBJECT</div>
                                <div className="text-xl md:text-3xl font-black text-white bg-red-600 px-4 py-1 md:px-6 md:py-2 rounded-xl shadow-lg">
                                    {answerer.nickname}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 답변 중: 아이언맨 HUD 오버레이 */}
                {phase === 'ANSWERING' && (
                    <div className="absolute inset-0">

                        {/* 좌측 데이터 패널 */}
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 space-y-4 w-48 md:w-64">
                            <HUDGauge label="STRESS" value={realtimeFace.stressLevel} color="red" />
                            <HUDGauge label="BLINK" value={realtimeFace.eyeBlinkRate * 10} color="yellow" />
                            <HUDGauge label="TREMOR" value={realtimeFace.facialTremor * 100} color="purple" />
                        </div>

                        {/* 우측 분석 패널 */}
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-right space-y-1 md:space-y-2">
                             <div className="text-cyan-400 text-[10px] md:text-sm font-mono tracking-widest">ANALYSIS RESULT</div>
                             <div className={`text-4xl md:text-5xl font-black ${realtimeFace.stressLevel > 55 ? 'text-red-500 animate-pulse' : 'text-cyan-300'}`}>
                                {realtimeFace.stressLevel > 55 ? 'WARNING' : 'STABLE'}
                             </div>
                             <div className="text-gray-400 font-mono text-[10px] md:text-xs">
                                PUPIL: {realtimeFace.eyeMovement > 0.3 ? 'UNSTABLE' : 'NORMAL'}
                             </div>
                        </div>

                        {/* 하단 질문 자막 */}
                        {question && (
                            <div className="absolute bottom-6 md:bottom-10 w-full text-center px-4 z-50 flex justify-center">
                                <motion.div
                                    initial={{ y: 50, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="inline-block bg-black/80 px-6 py-4 md:px-10 md:py-6 rounded-3xl border border-white/10 backdrop-blur-md shadow-2xl max-w-[95%]"
                                >
                                    <h2 className="text-xl md:text-3xl font-bold text-white leading-normal break-keep">
                                        "{question.content}"
                                    </h2>
                                </motion.div>
                            </div>
                        )}
                    </div>
                )}

                {/* 결과 발표 화면 */}
                {phase === 'RESULT' && result && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md z-50">
                         <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={`flex flex-col items-center p-8 md:p-16 rounded-[2rem] border-4 md:border-8 ${result.isLie ? 'border-red-600 bg-red-950/50' : 'border-green-500 bg-green-950/50'}`}
                         >
                            <h2 className="text-xl md:text-3xl text-white font-bold mb-4 tracking-widest">FINAL JUDGMENT</h2>
                            <div className={`text-6xl md:text-[8rem] font-black mb-4 md:mb-8 ${result.isLie ? 'text-red-500' : 'text-green-400'}`}>
                                {result.isLie ? 'LIE' : 'TRUTH'}
                            </div>
                            <div className="text-lg md:text-2xl text-white/80 font-mono bg-black/50 px-6 py-2 rounded-full">
                                STRESS: <span className="text-white font-bold">{result.stressLevel}%</span>
                            </div>
                         </motion.div>
                         <motion.button
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.5 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onNextRound}
                            className="mt-8 px-10 py-4 bg-cyan-600 hover:bg-cyan-500 rounded-2xl text-xl font-bold text-white shadow-lg pointer-events-auto transition-all"
                         >
                            다음 라운드 →
                         </motion.button>
                    </div>
                )}
            </div>
        </div>
    );
}

// 게이지 바 컴포넌트
function HUDGauge({ label, value, color }: { label: string, value: number, color: string }) {
    const bg = color === 'red' ? 'bg-red-500' : color === 'yellow' ? 'bg-yellow-400' : 'bg-purple-500';
    return (
        <div className="bg-gray-900/60 border border-gray-700/50 p-2 md:p-3 rounded-lg backdrop-blur-sm shadow-md">
            <div className="flex justify-between text-[10px] md:text-xs font-mono text-gray-300 mb-1">
                <span>{label}</span>
                <span>{Math.min(Math.round(value), 100)}%</span>
            </div>
            <div className="w-full h-1.5 md:h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                    className={`h-full ${bg}`}
                    animate={{ width: `${Math.min(value, 100)}%` }}
                    transition={{ type: "spring", stiffness: 50 }}
                />
            </div>
        </div>
    );
}
