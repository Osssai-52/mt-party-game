'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import FaceTracker from './FaceTracker';
import { TruthPhase, TruthAnswerer, TruthQuestion, FaceAnalysisData } from '../types/truth';

interface TruthBoardProps {
    phase: TruthPhase;
    answerer: TruthAnswerer | null;
    question: TruthQuestion | null;
    result: FaceAnalysisData | null;
    setRealtimeFace: (data: FaceAnalysisData) => void;
    realtimeFace: FaceAnalysisData;
    roomId: string;
}

export default function TruthBoard({ phase, answerer, question, result, setRealtimeFace, realtimeFace, roomId }: TruthBoardProps) {
    const [statusMsg, setStatusMsg] = useState("카메라 준비 중...");

    return (
        // ✅ [수정 1] h-full -> h-screen (화면 높이를 강제로 100% 채움)
        // ✅ [수정 2] w-screen 추가 (가로도 꽉 채움)
        <div className="relative w-screen h-screen bg-black overflow-hidden flex flex-col items-center justify-center">
            
            {/* 🎥 배경: 얼굴 인식 카메라 */}
            <div className="absolute inset-0 z-0">
                <FaceTracker 
                    roomId={roomId}
                    targetDeviceId={answerer?.deviceId || ''} 
                    onStatusChange={setStatusMsg}
                    onAnalyze={setRealtimeFace} 
                />
                {/* 비네팅 효과: 가장자리를 어둡게 해서 글씨 잘 보이게 함 */}
                <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_40%,black_100%)] z-10" />
            </div>

            {/* 🖥️ UI 레이어 */}
            <div className="relative z-20 w-full h-full flex flex-col pointer-events-none p-4">
                
                {/* 상단 상태바 */}
                <div className="flex justify-between items-start">
                    <div className="bg-black/60 backdrop-blur border border-green-500/50 px-3 py-1 rounded-lg text-green-400 font-mono text-xs md:text-sm animate-pulse">
                        ● {statusMsg}
                    </div>
                    {answerer && (
                        <div className="text-right">
                            <div className="text-[10px] md:text-xs text-gray-400 mb-1 font-mono">TARGET SUBJECT</div>
                            <div className="text-xl md:text-3xl font-black text-white bg-red-600 px-4 py-1 md:px-6 md:py-2 rounded-xl shadow-lg">
                                {answerer.nickname}
                            </div>
                        </div>
                    )}
                </div>

                {/* 🤖 답변 중: 아이언맨 HUD 오버레이 */}
                {phase === 'ANSWERING' && (
                    <div className="absolute inset-0">
                        
                        {/* 1. 좌측 데이터 패널 (✅ 완전 벽으로 밀착) */}
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 space-y-4 w-48 md:w-64">
                            <HUDGauge label="STRESS" value={realtimeFace.stressLevel} color="red" />
                            <HUDGauge label="BLINK" value={realtimeFace.eyeBlinkRate * 10} color="yellow" />
                            <HUDGauge label="TREMOR" value={realtimeFace.facialTremor * 100} color="purple" />
                        </div>

                        {/* 2. 우측 분석 패널 (✅ 완전 벽으로 밀착) */}
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-right space-y-1 md:space-y-2">
                             <div className="text-cyan-400 text-[10px] md:text-sm font-mono tracking-widest">ANALYSIS RESULT</div>
                             {/* 글씨 크기 살짝 줄여서 공간 확보 */}
                             <div className={`text-4xl md:text-5xl font-black ${realtimeFace.stressLevel > 55 ? 'text-red-500 animate-pulse' : 'text-cyan-300'}`}>
                                {realtimeFace.stressLevel > 55 ? 'WARNING' : 'STABLE'}
                             </div>
                             <div className="text-gray-400 font-mono text-[10px] md:text-xs">
                                PUPIL: {realtimeFace.eyeMovement > 0.3 ? 'UNSTABLE' : 'NORMAL'}
                             </div>
                        </div>

                        {/* 3. 하단 질문 자막 (✅ 바닥에 딱 붙임) */}
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

                {/* 🏆 결과 발표 화면 */}
                {phase === 'RESULT' && result && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-md z-50">
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
                    </div>
                )}
            </div>
        </div>
    );
}

// 게이지 바 컴포넌트 (높이 조절)
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