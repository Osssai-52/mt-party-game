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
        <div className="relative w-full h-full bg-black overflow-hidden flex flex-col items-center justify-center">
            
            {/* 🎥 배경: 얼굴 인식 카메라 (항상 가동) */}
            <div className="absolute inset-0 z-0">
                <FaceTracker 
                    roomId={roomId}
                    targetDeviceId={answerer?.deviceId || ''} 
                    onStatusChange={setStatusMsg}
                    onAnalyze={setRealtimeFace} // 분석된 데이터를 받아서 state 업데이트
                />
                {/* 비네팅 효과 (가장자리 어둡게) */}
                <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_60%,black_100%)] z-10" />
            </div>

            {/* 🖥️ UI 레이어 (Phase별 HUD) */}
            <div className="relative z-20 w-full h-full flex flex-col pointer-events-none p-6">
                
                {/* 상단 상태바 */}
                <div className="flex justify-between items-start">
                    <div className="bg-black/60 backdrop-blur border border-green-500/50 px-4 py-2 rounded-lg text-green-400 font-mono text-sm animate-pulse">
                        ● {statusMsg}
                    </div>
                    {answerer && (
                        <div className="text-right">
                            <div className="text-xs text-gray-400 mb-1 font-mono">TARGET SUBJECT</div>
                            <div className="text-3xl font-black text-white bg-red-600 px-6 py-2 rounded-xl shadow-[0_0_20px_rgba(220,38,38,0.6)]">
                                {answerer.nickname}
                            </div>
                        </div>
                    )}
                </div>

                {/* 🤖 답변 중: 아이언맨 HUD 오버레이 */}
                {phase === 'ANSWERING' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        {/* 중앙 타겟팅 UI */}
                        <div className="w-[600px] h-[600px] border border-cyan-400/20 rounded-full flex items-center justify-center animate-spin-slow opacity-50">
                             <div className="w-[580px] h-[580px] border-t-2 border-b-2 border-cyan-400/40 rounded-full" />
                        </div>
                        
                        {/* 좌측 데이터 패널 */}
                        <div className="absolute left-12 top-1/2 -translate-y-1/2 space-y-6 w-72">
                            <HUDGauge label="STRESS" value={realtimeFace.stressLevel} color="red" />
                            <HUDGauge label="BLINK" value={realtimeFace.eyeBlinkRate * 10} color="yellow" />
                            <HUDGauge label="TREMOR" value={realtimeFace.facialTremor * 100} color="purple" />
                        </div>

                        {/* 우측 분석 패널 */}
                        <div className="absolute right-12 top-1/2 -translate-y-1/2 text-right space-y-2">
                             <div className="text-cyan-400 text-sm font-mono tracking-widest">ANALYSIS RESULT</div>
                             <div className={`text-5xl font-black ${realtimeFace.stressLevel > 55 ? 'text-red-500 animate-pulse' : 'text-cyan-300'}`}>
                                {realtimeFace.stressLevel > 55 ? 'WARNING' : 'STABLE'}
                             </div>
                             <div className="text-gray-400 font-mono text-sm">
                                PUPIL: {realtimeFace.eyeMovement > 0.3 ? 'UNSTABLE' : 'NORMAL'}
                             </div>
                        </div>

                        {/* 하단 질문 자막 */}
                        {question && (
                            <div className="absolute bottom-12 w-full text-center px-20">
                                <motion.div 
                                    initial={{ y: 50, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="inline-block bg-black/80 px-12 py-8 rounded-3xl border border-white/10 backdrop-blur-md shadow-2xl"
                                >
                                    <h2 className="text-4xl font-bold text-white leading-relaxed">
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
                            className={`flex flex-col items-center p-16 rounded-[3rem] border-8 ${result.isLie ? 'border-red-600 bg-red-950/50' : 'border-green-500 bg-green-950/50'}`}
                         >
                            <h2 className="text-3xl text-white font-bold mb-4 tracking-widest">FINAL JUDGMENT</h2>
                            <div className={`text-[10rem] font-black mb-8 ${result.isLie ? 'text-red-500 drop-shadow-[0_0_50px_rgba(220,38,38,0.8)]' : 'text-green-400 drop-shadow-[0_0_50px_rgba(74,222,128,0.8)]'}`}>
                                {result.isLie ? 'LIE' : 'TRUTH'}
                            </div>
                            <div className="text-2xl text-white/80 font-mono bg-black/50 px-8 py-2 rounded-full">
                                STRESS LEVEL: <span className="text-white font-bold">{result.stressLevel}%</span>
                            </div>
                         </motion.div>
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
        <div className="bg-gray-900/80 border border-gray-700 p-4 rounded-xl backdrop-blur-sm">
            <div className="flex justify-between text-xs font-mono text-gray-400 mb-2">
                <span>{label}</span>
                <span>{Math.min(Math.round(value), 100)}%</span>
            </div>
            <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                <motion.div 
                    className={`h-full ${bg}`} 
                    animate={{ width: `${Math.min(value, 100)}%` }}
                    transition={{ type: "spring", stiffness: 50 }}
                />
            </div>
        </div>
    );
}