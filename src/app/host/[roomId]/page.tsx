'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';

// 컴포넌트 & 훅 임포트
import JuruBoard from '../../../components/JuruBoard';
import Dice3D from '../../../components/Dice3D';
import MafiaBoard from '../../../components/MafiaBoard';
import TruthBoard from '../../../components/TruthBoard';
import QuizBoard from '../../../components/QuizBoard';
// 라이어 게임 컴포넌트
import LiarBoard from '../../../components/LiarBoard';
import { API_BASE_URL } from '../../../services/api';

import useMafiaHost from '../../../hooks/useMafiaHost'; 
import useJuruHost from '../../../hooks/useJuruHost'; 
import useTruthHost from '../../../hooks/useTruthHost';
import useQuizHost from '../../../hooks/useQuizHost';
// 라이어 게임 훅
import useLiarHost from '../../../hooks/useLiarHost';

// 타입 정의
interface GamePlayer {
    id: number;
    nickname: string;
    color: string;
    currentPosition: number;
    profileImage: string | null;
    deviceId: string;
    submittedCount: number;
    isVoteFinished?: boolean; 
}

export default function LobbyPage() {
    const params = useParams();
    const roomId = params.roomId as string;
    const searchParams = useSearchParams();
    const gameType = searchParams.get('game') || 'JURUMARBLE';

    // --- 공통 상태 (로비 대기용) ---
    const [players, setPlayers] = useState<GamePlayer[]>([]);
    const [commonPhase, setCommonPhase] = useState('LOBBY'); 
    
    // SSE 연결 (공통)
    const eventSourceRef = useRef<EventSource | null>(null);

    // 🌟 [Hook 연결] 
    const juru = useJuruHost(roomId, players, eventSourceRef.current);
    const mafia = useMafiaHost(roomId, players, eventSourceRef.current);
    const truth = useTruthHost(roomId, players, eventSourceRef.current);
    const quiz = useQuizHost(roomId, eventSourceRef.current); 
    const liar = useLiarHost(roomId, players, eventSourceRef.current);

    // SSE 초기화 및 공통 이벤트 처리
    useEffect(() => {
        if (!roomId || !process.env.NEXT_PUBLIC_API_URL) {
            console.log("⚠️ 백엔드 연결 없음: 테스트 모드로 동작합니다.");
            return;
        }

        let hostId = localStorage.getItem('host_device_id');
        if(!hostId) {
            hostId = Math.random().toString(36).substring(7);
            localStorage.setItem('host_device_id', hostId);
        }
        
        const sseUrl = `${API_BASE_URL}/sse/connect?roomId=${roomId}&sessionId=${hostId}`;
        const eventSource = new EventSource(sseUrl);
        eventSourceRef.current = eventSource;

        eventSource.addEventListener('PLAYER_JOINED', (e) => {
            const newPlayer = JSON.parse(e.data);
            setPlayers(prev => {
                if (prev.find(p => p.deviceId === newPlayer.deviceId)) return prev;
                return [...prev, {
                    id: prev.length,
                    nickname: newPlayer.nickname,
                    color: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#1A535C', '#FF9F43'][prev.length % 5],
                    currentPosition: 0,
                    profileImage: null,
                    deviceId: newPlayer.deviceId,
                    submittedCount: 0
                }];
            });
        });

        eventSource.addEventListener('MARBLE_PHASE_CHANGE', (e) => {
            const data = JSON.parse(e.data);
            setCommonPhase(data.phase);
        });

        return () => { eventSource.close(); };
    }, [roomId]); 

    // 게임 시작 버튼 핸들러
    const handleStartGame = async () => {
        if (gameType === 'MAFIA') {
            await mafia.startGame();
            setCommonPhase('MAFIA_GAME');
        }
        else if (gameType === 'TRUTH') { 
            await truth.startGame();
            setCommonPhase('TRUTH_GAME');
        }
        else if (gameType === 'SPEED_QUIZ') { 
            await quiz.actions.initGame(); 
            setCommonPhase('QUIZ_GAME');
        }
        else if (gameType === 'LIAR') {
            await liar.startGame(0); 
            setCommonPhase('LIAR_GAME');
        }
        else {
            await juru.handleStartGame();
            setCommonPhase('GAME');
        }
    };

    const joinUrl = typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.host}/player/join?room=${roomId}&game=${gameType}`
        : '';


    return (
        <main className="relative flex min-h-screen flex-col items-center bg-black text-white p-6 overflow-hidden">
            
            {/* ============================================================ */}
            {/* 🛠️ [개발자 테스트 컨트롤러] */}
            {/* ============================================================ */}
            
            {/* 1. 주루마블용 테스트 버튼 */}
            {gameType === 'JURUMARBLE' && (
                <div className="fixed bottom-4 right-4 z-[9999] bg-gray-800/90 p-4 rounded-xl border border-yellow-500 backdrop-blur-md flex flex-col gap-2 shadow-2xl">
                    <h3 className="text-xs font-bold text-yellow-400 mb-1">🎲 MARBLE TEST</h3>
                    <button onClick={() => juru.testHandlers.handleTestStart()} className="bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded text-sm font-bold transition">1. 가짜 참가자 생성</button>
                    {commonPhase === 'TEAM' && (
                        <>
                            <div className="h-[1px] bg-gray-600 my-1"></div>
                            <button onClick={() => juru.testHandlers.handleTestTeamBuilding('RANDOM')} className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-sm font-bold">[TEST] 랜덤 결과 보기</button>
                            <button onClick={() => juru.testHandlers.handleTestTeamBuilding('MANUAL')} className="bg-red-600 hover:bg-red-500 px-3 py-1 rounded text-sm font-bold">[TEST] 팀 초기화</button>
                        </>
                    )}
                    <div className="h-[1px] bg-gray-600 my-1"></div>
                    <button onClick={() => setCommonPhase('GAME')} className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded text-sm font-bold transition">2. 게임판 강제 이동</button>
                    {commonPhase === 'GAME' && (
                        <button onClick={juru.testHandlers.handleTestDice} className="bg-pink-600 hover:bg-pink-500 px-3 py-1 rounded text-sm font-bold transition">3. 주사위 굴리기</button>
                    )}
                </div>
            )}

            {/* 2. 마피아용 테스트 버튼 */}
            {gameType === 'MAFIA' && commonPhase === 'MAFIA_GAME' && (
                <div className="fixed bottom-4 right-4 z-[9999] bg-gray-800/90 p-4 rounded-xl border border-purple-500 backdrop-blur-md flex flex-col gap-2 shadow-2xl">
                    <h3 className="text-xs font-bold text-purple-400 mb-1">🕵️ MAFIA TEST</h3>
                    <button onClick={() => { mafia.testHandlers.handleTestStart(); setCommonPhase('MAFIA_GAME'); }} className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded text-sm font-bold">1. 게임 강제 시작</button>
                    {commonPhase === 'MAFIA_GAME' && (
                        <>
                            <button onClick={mafia.testHandlers.handleTestNextPhase} className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-sm font-bold">2. 페이즈 넘기기</button>
                            <button onClick={mafia.testHandlers.handleTestKillRandom} className="bg-red-600 hover:bg-red-500 px-3 py-1 rounded text-sm font-bold">3. 랜덤 처형 💀</button>
                        </>
                    )}
                </div>
            )}

            {/* 3. 진실게임용 테스트 버튼 */}
            {gameType === 'TRUTH' && commonPhase === 'TRUTH_GAME' && (
                <div className="fixed bottom-4 right-4 z-[9999] bg-gray-800/90 p-4 rounded-xl border border-cyan-500 backdrop-blur-md flex flex-col gap-2 shadow-2xl">
                    <h3 className="text-xs font-bold text-cyan-400 mb-1">🧠 TRUTH TEST</h3>
                    <button onClick={() => truth.testHandlers.handleTestSelectRandom()} className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-sm font-bold">1. 답변자 랜덤 선정</button>
                    <button onClick={() => truth.testHandlers.handleTestSelectQuestion()} className="bg-purple-600 hover:bg-purple-500 px-3 py-1 rounded text-sm font-bold">2. 질문 뽑기</button>
                    <button onClick={() => truth.testHandlers.handleTestConfirmQuestion()} className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded text-sm font-bold">3. 질문 확정 (HUD 시작)</button>
                    <button onClick={() => truth.testHandlers.handleTestFinishAnswering()} className="bg-red-600 hover:bg-red-500 px-3 py-1 rounded text-sm font-bold">4. 답변 종료 (결과)</button>
                    <button onClick={() => truth.testHandlers.handleTestNextRound()} className="bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded text-sm font-bold">5. 다음 라운드</button>
                </div>
            )}

            {/* 4. 몸으로 말해요용 테스트 버튼 */}
            {gameType === 'SPEED_QUIZ' && commonPhase === 'QUIZ_GAME' && (
                <div className="fixed bottom-4 right-4 z-[9999] bg-gray-800/90 p-4 rounded-xl border border-cyan-400 backdrop-blur-md flex flex-col gap-2 shadow-2xl">
                    <h3 className="text-xs font-bold text-cyan-300 mb-1">🙆‍♂️ QUIZ TEST</h3>
                    <button onClick={() => quiz.testHandlers.handleTestInit()} className="bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded text-sm font-bold">
                        1. 초기화 (카테고리 생성)
                    </button>
                    <button onClick={() => quiz.testHandlers.handleTestStartRound(1)} className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-sm font-bold">
                        2. 라운드 시작 (문제 출제)
                    </button>
                    <button onClick={() => quiz.testHandlers.handleTestNextTeam()} className="bg-purple-600 hover:bg-purple-500 px-3 py-1 rounded text-sm font-bold">
                        3. 다음 팀 턴
                    </button>
                    <button onClick={() => quiz.testHandlers.handleTestEndGame()} className="bg-red-600 hover:bg-red-500 px-3 py-1 rounded text-sm font-bold">
                        4. 라운드 종료 (결과)
                    </button>
                </div>
            )}

            {/* 🦜 5. 라이어게임용 테스트 버튼 (NEW!) */}
            {gameType === 'LIAR' && commonPhase === 'LIAR_GAME' && (
                <div className="fixed bottom-4 right-4 z-[9999] bg-green-900/90 p-4 rounded-xl border border-green-400 backdrop-blur-md flex flex-col gap-2 shadow-2xl">
                    <h3 className="text-xs font-bold text-green-300 mb-1">🦜 LIAR TEST</h3>
                    <button onClick={liar.testHandlers.start} className="bg-gray-600 px-2 py-1 text-xs font-bold rounded m-1">1. 시작</button>
                    <button onClick={liar.testHandlers.nextTurn} className="bg-blue-600 px-2 py-1 text-xs font-bold rounded m-1">2. 턴 넘기기</button>
                    <button onClick={liar.testHandlers.voteStart} className="bg-purple-600 px-2 py-1 text-xs font-bold rounded m-1">3. 투표 모드</button>
                    <button onClick={liar.testHandlers.endGame} className="bg-red-600 px-2 py-1 text-xs font-bold rounded m-1">4. 결과</button>
                </div>
            )}


            {/* Header (게임 종류 표시) */}
            <div className="w-full flex justify-between items-center mb-6 z-10 h-16 shrink-0">
                {/* 🎨 [수정] 게임 타입이 LIAR일 때 초록색 그라데이션 적용 */}
                <h1 className={`text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${
                    gameType === 'LIAR' ? 'from-green-400 to-emerald-600' : 'from-purple-400 to-pink-600'
                }`}>
                    {gameType === 'MAFIA' ? '🕵️‍♂️ MAFIA GAME' : 
                    gameType === 'TRUTH' ? '🧠 TRUTH GAME' : 
                    gameType === 'SPEED_QUIZ' ? '🙆‍♂️ SPEED QUIZ' : 
                    gameType === 'LIAR' ? '🦜 LIAR GAME' : '🎲 JURU MARBLE'}
                </h1>

                <div className="flex items-center gap-4">
                    <div className="bg-gray-800 px-4 py-2 rounded-full border border-gray-600 flex items-center gap-2">
                        <span className="text-gray-400 text-sm">CODE</span>
                        <span className="text-2xl font-mono font-bold text-white tracking-widest">{roomId}</span>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 w-full flex items-center justify-center z-10 overflow-hidden">
                
                {/* 1. 공통 로비 (LOBBY) */}
                {commonPhase === 'LOBBY' && (
                    <div className="flex w-full max-w-6xl gap-8">
                        <div className="w-1/3 flex flex-col items-center bg-gray-900 rounded-3xl p-6 border-2 border-purple-500">
                            <h2 className="text-2xl font-bold mb-4">Join Here! 👇</h2>
                            <div className="bg-white p-3 rounded-xl mb-4">
                                <QRCodeSVG value={joinUrl} size={180} />
                            </div>
                            <div className="text-center text-gray-400 text-sm">
                                <div className="text-3xl font-mono font-black text-white tracking-[0.2em] mb-2">{roomId}</div>
                                <p>1. QR코드를 찍고 입장하세요.</p>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col bg-gray-900/50 rounded-3xl p-6 border border-gray-800">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h2 className="text-3xl font-black">📝 참가자 대기 중</h2>
                                    <p className="text-gray-400">참가자 {players.length}명 접속 중</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 overflow-y-auto max-h-[400px] mb-4">
                                {players.map(p => (
                                    <div key={p.id} className="p-4 rounded-xl border bg-gray-800 border-gray-700 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-black" style={{background: p.color}}>{p.nickname[0]}</div>
                                        <span className="font-bold text-lg">{p.nickname}</span>
                                    </div>
                                ))}
                            </div>

                            {/* 게임 시작 */}
                            {gameType === 'MAFIA' ? (
                                <button onClick={handleStartGame} className="w-full py-4 bg-red-600 hover:bg-red-500 rounded-xl text-2xl font-bold shadow-lg transition transform hover:scale-105">
                                    🕵️‍♂️ 마피아 게임 시작!
                                </button>
                            ) : gameType === 'TRUTH' ? (
                                <button onClick={handleStartGame} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-2xl font-bold shadow-lg transition transform hover:scale-105">
                                    🧠 진실 게임 시작!
                                </button>
                            ) : gameType === 'SPEED_QUIZ' ? (
                                <button onClick={handleStartGame} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-2xl font-bold shadow-lg transition transform hover:scale-105">
                                    🙆‍♂️ 몸으로 말해요 시작!
                                </button>
                            ) : gameType === 'LIAR' ? (
                                <button onClick={handleStartGame} className="w-full py-4 bg-green-600 hover:bg-green-500 rounded-xl text-2xl font-bold shadow-lg transition transform hover:scale-105">
                                    🦜 라이어 게임 시작!
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button onClick={() => setCommonPhase('SUBMIT')} className="flex-1 bg-purple-600 px-4 py-4 rounded-xl font-bold text-xl">
                                        1. 벌칙 제출 단계로
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- 🎲 주루마블 UI --- */}
                {gameType === 'JURUMARBLE' && (
                    <>
                        {/* 기존 주루마블 UI 코드 */}
                        {commonPhase === 'SUBMIT' && (
                            <div className="flex-1 flex flex-col items-center justify-center bg-gray-900/50 rounded-3xl p-6 border border-gray-800 max-w-4xl w-full">
                                <h2 className="text-4xl font-bold mb-4">😈 벌칙 제출 중...</h2>
                                <p className="text-xl text-gray-300 mb-8">현재 {juru.penaltyCount}개의 벌칙이 제출되었습니다.</p>
                                <button onClick={() => setCommonPhase('VOTE')} className="bg-blue-600 px-8 py-4 rounded-full text-2xl font-bold animate-pulse">
                                    투표 시작하기 👉
                                </button>
                            </div>
                        )}

                        {commonPhase === 'VOTE' && (
                            <div className="flex flex-col items-center gap-8 w-full max-w-4xl">
                                <h2 className="text-4xl font-black mb-4">🗳️ 투표 진행 중...</h2>
                                <button onClick={juru.handleFinishVote} className="bg-purple-600 px-12 py-4 rounded-full text-2xl font-bold shadow-lg">
                                    투표 마감 & 팀 편성하기 👥
                                </button>
                            </div>
                        )}

                        {commonPhase === 'TEAM' && (
                            <div className="flex flex-col items-center w-full max-w-5xl gap-8">
                                <h2 className="text-4xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400">
                                    TEAM BUILDING
                                </h2>
                                <div className="flex bg-gray-800 p-1 rounded-xl">
                                    {(['RANDOM', 'LADDER', 'MANUAL'] as const).map((method) => (
                                        <button key={method} onClick={() => juru.setAssignMethod(method)} className={`px-6 py-2 rounded-lg font-bold transition-all ${juru.assignMethod === method ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                                            {method === 'RANDOM' && '🎲 랜덤 배정'}
                                            {method === 'LADDER' && '🪜 사다리 타기'}
                                            {method === 'MANUAL' && '👆 수동 선택'}
                                        </button>
                                    ))}
                                </div>
                                <div className="bg-gray-900/80 p-8 rounded-3xl border border-gray-700 flex flex-col items-center gap-6 w-full max-w-2xl">
                                    <div className="flex items-center gap-6">
                                        <span className="text-gray-400 font-bold">총 팀 개수</span>
                                        <div className="flex items-center gap-4 bg-black/30 px-4 py-2 rounded-xl">
                                            <button onClick={() => juru.setTeamCount(Math.max(2, juru.teamCount - 1))} className="w-8 h-8 bg-gray-700 rounded-full font-bold hover:bg-gray-600">-</button>
                                            <span className="text-2xl font-mono font-bold w-8 text-center">{juru.teamCount}</span>
                                            <button onClick={() => juru.setTeamCount(Math.min(players.length, juru.teamCount + 1))} className="w-8 h-8 bg-gray-700 rounded-full font-bold hover:bg-gray-600">+</button>
                                        </div>
                                    </div>
                                    <div className="w-full h-[1px] bg-gray-700 my-2"></div>
                                    {juru.assignMethod === 'RANDOM' && (
                                        <div className="text-center animate-fadeIn">
                                            <p className="text-gray-400 mb-4 text-sm">"전체 인원을 무작위로 섞어서<br/>{juru.teamCount}개 팀에 균등하게 배정합니다."</p>
                                            <button onClick={juru.handleDivideRandom} className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl font-bold text-xl shadow-lg hover:scale-105 transition">🎲 랜덤 섞기 시작!</button>
                                        </div>
                                    )}
                                    {juru.assignMethod === 'LADDER' && (
                                        <div className="text-center animate-fadeIn">
                                            <p className="text-gray-400 mb-4 text-sm">"사다리 타기 알고리즘을 이용해<br/>운명적인 팀을 결정합니다."</p>
                                            <button onClick={juru.handleDivideLadder} className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-500 rounded-xl font-bold text-xl shadow-lg hover:scale-105 transition">🪜 사다리 타기 시작!</button>
                                        </div>
                                    )}
                                    {juru.assignMethod === 'MANUAL' && (
                                        <div className="text-center animate-fadeIn">
                                            <p className="text-gray-400 mb-4 text-sm">"플레이어들이 각자 폰에서<br/>원하는 팀을 직접 선택합니다."</p>
                                            <button onClick={juru.handleManualMode} className="w-full py-4 bg-gray-700 border-2 border-dashed border-gray-500 rounded-xl font-bold text-xl hover:bg-gray-600 transition">🔄 팀 초기화 (재선택 유도)</button>
                                        </div>
                                    )}
                                </div>
                                <div className="w-full grid grid-cols-2 gap-4">
                                    {juru.teamResult && Object.entries(juru.teamResult).map(([teamName, members]) => (
                                        <div key={teamName} className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                                            <h3 className="font-bold text-xl mb-2 flex justify-between">
                                                {teamName} 
                                                {/* @ts-ignore */}
                                                <span className="text-sm bg-black/30 px-2 py-1 rounded text-gray-400">{members.length}명</span>
                                            </h3>
                                            <div className="flex gap-2 flex-wrap">
                                                {/* @ts-ignore */}
                                                {members.map((m: any) => (
                                                    <span key={m.deviceId} className="bg-black/50 px-2 py-1 rounded text-sm text-white flex items-center gap-1">{m.nickname}</span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={juru.handleStartGame} className="mt-8 bg-red-600 px-12 py-4 rounded-full text-2xl font-bold animate-bounce shadow-xl border-4 border-red-800">
                                    게임 시작! 🏁
                                </button>
                            </div>
                        )}

                        {commonPhase === 'GAME' && (
                            <div className="flex w-full h-full gap-6">
                                <div className="flex-1 h-full flex items-center justify-center">
                                    <JuruBoard players={juru.boardPieces} penalties={juru.finalPenalties} />
                                </div>
                                <div className="w-80 h-full flex flex-col gap-4 overflow-y-auto pr-2 pb-4">
                                    <h3 className="text-xl font-bold text-gray-400 sticky top-0 bg-black py-2">TEAMS</h3>
                                    {juru.teamResult && Object.entries(juru.teamResult).map(([teamName, members], idx) => {
                                        // @ts-ignore
                                        const isTeamTurn = members.some(m => m.deviceId === juru.currentTurnDeviceId);
                                        return (
                                            <motion.div key={teamName} animate={isTeamTurn ? { scale: 1.05 } : { scale: 1 }} className={`relative p-5 rounded-2xl border-2 transition-all duration-300 ${isTeamTurn ? 'bg-gray-800 border-yellow-400' : 'bg-gray-900 border-gray-700 opacity-80'}`}>
                                                <h4 className={`font-bold text-lg mb-2 ${isTeamTurn ? 'text-yellow-400' : 'text-white'}`}>{teamName}</h4>
                                                <div className="space-y-2">
                                                    {/* @ts-ignore */}
                                                    {members.map((m: any) => (
                                                        <div key={m.deviceId} className="flex items-center gap-2">
                                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color || '#fff' }} />
                                                            <span className={`text-sm ${m.deviceId === juru.currentTurnDeviceId ? 'text-white font-bold underline decoration-yellow-400' : 'text-gray-400'}`}>{m.nickname}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* --- 🕵️‍♀️ 마피아 UI --- */}
                {gameType === 'MAFIA' && commonPhase === 'MAFIA_GAME' && (
                    <MafiaBoard 
                        players={mafia.mafiaPlayers}
                        phase={mafia.phase}
                        timer={mafia.timer}
                        systemMessage={mafia.systemMessage}
                        voteStatus={mafia.voteStatus}
                        winner={mafia.winner}
                        finalVoteStatus={mafia.finalVoteStatus}
                    />
                )}

                {/* --- 🧠 진실게임 UI --- */}
                {gameType === 'TRUTH' && commonPhase === 'TRUTH_GAME' && (
                    <TruthBoard 
                        phase={truth.phase}
                        answerer={truth.answerer}
                        question={truth.currentQuestion}
                        result={truth.result}
                        setRealtimeFace={truth.setRealtimeFace}
                        realtimeFace={truth.realtimeFace}
                        roomId={roomId}
                    />
                )}

                {/* --- 🙆‍♂️ 몸으로 말해요 UI --- */}
                {gameType === 'SPEED_QUIZ' && commonPhase === 'QUIZ_GAME' && (
                    <QuizBoard 
                        phase={quiz.phase}
                        gameState={quiz.gameState}
                        categories={quiz.categories}
                        ranking={quiz.ranking}
                        onStartRound={quiz.actions.startRound}
                        onNextTeam={quiz.actions.handleNextTeam}
                        onEndGame={quiz.actions.handleEndGame}
                    />
                )}

                {/* 🦜 라이어 게임 UI */}
                {gameType === 'LIAR' && commonPhase === 'LIAR_GAME' && (
                    <LiarBoard 
                        phase={liar.phase}
                        players={liar.gamePlayers}
                        timer={liar.timer}
                        category={liar.categoryName}
                        currentExplainerIndex={liar.currentExplainerIndex}
                        voteStatus={liar.voteStatus}
                        keywordResult={liar.keyword}
                        liarNameResult={liar.liarName}
                    />
                )}

            </div>

            {/* 주루마블용 모달들 (벌칙, 주사위) */}
            <AnimatePresence>
                {juru.activePenaltyText && (
                    <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-none">
                        <div className="bg-gradient-to-br from-red-600 to-pink-600 p-1 rounded-3xl shadow-[0_0_100px_rgba(236,72,153,0.5)]">
                            <div className="bg-gray-900 rounded-[22px] px-12 py-16 text-center border border-white/20 min-w-[300px] max-w-4xl">
                                <h2 className="text-2xl text-yellow-400 font-bold mb-6 animate-pulse uppercase tracking-widest">PENALTY</h2>
                                <div className="text-5xl md:text-7xl font-black text-white leading-tight break-keep drop-shadow-lg">{juru.activePenaltyText}</div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {juru.showDice && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <Dice3D value={juru.diceValue} rolling={juru.isRolling} size={300} />
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}