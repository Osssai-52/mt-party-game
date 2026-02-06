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
import gameApi from '../../../services/gameApi';

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

// [스타일링] 게임별 테마 색상 매핑
const THEME_STYLES: Record<string, { border: string; button: string; text: string; gradient: string }> = {
    JURUMARBLE: {
        border: 'border-orange-500',
        button: 'bg-orange-600 hover:bg-orange-500',
        text: 'text-orange-500',
        gradient: 'from-orange-600 to-orange-400'
    },
    MAFIA: {
        border: 'border-red-600',
        button: 'bg-red-600 hover:bg-red-500',
        text: 'text-red-600',
        gradient: 'from-red-700 to-red-500'
    },
    TRUTH: {
        border: 'border-pink-500',
        button: 'bg-pink-600 hover:bg-pink-500',
        text: 'text-pink-500',
        gradient: 'from-pink-600 to-purple-500'
    },
    SPEED_QUIZ: {
        border: 'border-blue-500',
        button: 'bg-blue-600 hover:bg-blue-500',
        text: 'text-blue-500',
        gradient: 'from-blue-600 to-cyan-500'
    },
    LIAR: {
        border: 'border-green-500',
        button: 'bg-green-600 hover:bg-green-500',
        text: 'text-green-500',
        gradient: 'from-green-600 to-emerald-500'
    }
};

export default function LobbyPage() {
    const params = useParams();
    const roomId = params.roomId as string;
    const searchParams = useSearchParams();
    const gameType = searchParams.get('game') || 'JURUMARBLE';

    const currentTheme = THEME_STYLES[gameType] || THEME_STYLES.JURUMARBLE;

    // --- 공통 상태 (로비 대기용) ---
    const [players, setPlayers] = useState<GamePlayer[]>([]);
    const [commonPhase, setCommonPhase] = useState('LOBBY');

    // SSE 연결 (공통)
    const eventSourceRef = useRef<EventSource | null>(null);

    // [Hook 연결] 
    const juru = useJuruHost(roomId, players, eventSourceRef.current);
    const mafia = useMafiaHost(roomId, players, eventSourceRef.current);
    const truth = useTruthHost(roomId, players, eventSourceRef.current);
    const quiz = useQuizHost(roomId, eventSourceRef.current);
    const liar = useLiarHost(roomId, players, eventSourceRef.current);

    // SSE 초기화 및 공통 이벤트 처리
    useEffect(() => {
        const hostId = localStorage.getItem('host_session_id');
        if (!roomId || !hostId) {
            console.log("⚠️ roomId 또는 hostSessionId 없음: 테스트 모드로 동작합니다.");
            return;
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

            {/* 5. 라이어게임용 테스트 버튼 */}
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
                <h1 className={`text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${gameType === 'LIAR' ? 'from-green-400 to-emerald-600' :
                        gameType === 'MAFIA' ? 'from-red-600 via-red-900 to-black' :
                            gameType === 'TRUTH' ? 'from-pink-500 via-rose-500 to-purple-600' :
                                gameType === 'SPEED_QUIZ' ? 'from-blue-500 via-cyan-500 to-teal-500' :
                                    'from-yellow-400 via-orange-500 to-red-500'
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
                        <div className={`w-1/3 flex flex-col items-center bg-gray-900 rounded-3xl p-6 border-2 ${currentTheme.border}`}>
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
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-black" style={{ background: p.color }}>{p.nickname[0]}</div>
                                        <span className="font-bold text-lg">{p.nickname}</span>
                                    </div>
                                ))}
                            </div>

                            {/* 게임 시작 버튼들 - 테마 적용 */}
                            {gameType === 'MAFIA' ? (
                                <button onClick={handleStartGame} className={`w-full py-4 ${currentTheme.button} rounded-xl text-2xl font-bold shadow-lg transition transform hover:scale-105`}>
                                    🕵️‍♂️ 마피아 게임 시작!
                                </button>
                            ) : gameType === 'TRUTH' ? (
                                <button onClick={handleStartGame} className={`w-full py-4 ${currentTheme.button} rounded-xl text-2xl font-bold shadow-lg transition transform hover:scale-105`}>
                                    🧠 진실 게임 시작!
                                </button>
                            ) : gameType === 'SPEED_QUIZ' ? (
                                <button onClick={handleStartGame} className={`w-full py-4 ${currentTheme.button} rounded-xl text-2xl font-bold shadow-lg transition transform hover:scale-105`}>
                                    🙆‍♂️ 몸으로 말해요 시작!
                                </button>
                            ) : gameType === 'LIAR' ? (
                                <button onClick={handleStartGame} className={`w-full py-4 ${currentTheme.button} rounded-xl text-2xl font-bold shadow-lg transition transform hover:scale-105`}>
                                    🦜 라이어 게임 시작!
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button onClick={async () => {
                                        try {
                                            await gameApi.common.changePhase(roomId, 'SUBMIT');
                                        } catch (e) {
                                            console.error(e);
                                            setCommonPhase('SUBMIT');
                                        }
                                    }} className={`flex-1 ${currentTheme.button} px-4 py-4 rounded-xl font-bold text-xl transition transform hover:scale-105 shadow-lg`}>
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
                                <p className="text-xl text-gray-300 mb-8">현재 {juru.penaltyCount} / {juru.expectedPenaltyCount} 개의 벌칙이 제출되었습니다.</p>
                                {/* 🎨 [수정] 투표 시작 버튼 (blue -> theme) */}
                                <button onClick={async () => {
                                    try {
                                        await gameApi.common.changePhase(roomId, 'VOTE');
                                    } catch (e) {
                                        console.error(e);
                                        setCommonPhase('VOTE');
                                    }
                                }} className={`${currentTheme.button} px-8 py-4 rounded-full text-2xl font-bold animate-pulse shadow-lg`}>
                                    투표 시작하기 👉
                                </button>
                            </div>
                        )}

                        {commonPhase === 'VOTE' && (
                            <div className="flex flex-col items-center gap-8 w-full max-w-4xl">
                                <h2 className="text-4xl font-black mb-4">🗳️ 투표 진행 중...</h2>
                                <p className="text-xl text-gray-300">투표 완료: {juru.voteDoneCount} / {juru.totalVoters} 명</p>
                                {/* 🎨 [수정] 투표 마감 버튼 (purple -> theme) */}
                                <button onClick={juru.handleFinishVote} className={`${currentTheme.button} px-12 py-4 rounded-full text-2xl font-bold shadow-lg`}>
                                    투표 마감 & 팀 편성하기 👥
                                </button>
                            </div>
                        )}

                        {/* [신규] 게임 모드 선택 (팀전 / 개인전) */}
                        {commonPhase === 'MODE_SELECT' && (
                            <div className="flex flex-col items-center gap-8 w-full max-w-4xl">
                                <h2 className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                                    게임 모드 선택
                                </h2>
                                <p className="text-gray-400 text-lg">
                                    팀으로 협동할까요, 개인전으로 경쟁할까요?
                                </p>

                                <div className="grid grid-cols-2 gap-6 w-full max-w-3xl">
                                    {/* 팀전 카드 */}
                                    <button
                                        onClick={() => juru.handleSelectMode('TEAM')}
                                        className="relative p-10 rounded-3xl border-4 border-blue-500 bg-gradient-to-br from-blue-600 to-purple-600 hover:scale-105 transition-all shadow-2xl group"
                                    >
                                        <div className="text-6xl mb-4">👥</div>
                                        <h3 className="text-3xl font-black mb-2">팀전</h3>
                                        <p className="text-sm text-gray-200">
                                            팀원과 함께 움직이며<br />협동하는 모드
                                        </p>
                                        <div className="absolute inset-0 bg-blue-400/20 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    </button>

                                    {/* 개인전 카드 */}
                                    <button
                                        onClick={() => juru.handleSelectMode('SOLO')}
                                        className="relative p-10 rounded-3xl border-4 border-orange-500 bg-gradient-to-br from-orange-600 to-red-600 hover:scale-105 transition-all shadow-2xl group"
                                    >
                                        <div className="text-6xl mb-4">🏃</div>
                                        <h3 className="text-3xl font-black mb-2">개인전</h3>
                                        <p className="text-sm text-gray-200">
                                            각자 독립적으로 움직이며<br />경쟁하는 모드
                                        </p>
                                        <div className="absolute inset-0 bg-orange-400/20 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    </button>
                                </div>
                            </div>
                        )}

                        {commonPhase === 'TEAM' && (
                            <div className="flex flex-col items-center w-full max-w-5xl gap-8">
                                <h2 className="text-4xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400">
                                    TEAM BUILDING
                                </h2>
                                <div className="flex bg-gray-800 p-1 rounded-xl">
                                    {(['RANDOM', 'MANUAL'] as const).map((method) => (
                                        // 🎨 [수정] 팀 배정 방식 선택 버튼 (blue -> theme)
                                        <button key={method} onClick={() => juru.setAssignMethod(method)} className={`px-6 py-2 rounded-lg font-bold transition-all ${juru.assignMethod === method ? `${currentTheme.button} text-white shadow-lg` : 'text-gray-400 hover:text-white'}`}>
                                            {method === 'RANDOM' && '🎲 랜덤 배정'}
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
                                            <p className="text-gray-400 mb-4 text-sm">"전체 인원을 무작위로 섞어서<br />{juru.teamCount}개 팀에 균등하게 배정합니다."</p>
                                            {/* 🎨 [수정] 랜덤 섞기 버튼 (gradient blue -> theme gradient) */}
                                            <button onClick={juru.handleDivideRandom} className={`w-full py-4 bg-gradient-to-r ${currentTheme.gradient} rounded-xl font-bold text-xl shadow-lg hover:scale-105 transition`}>
                                                {juru.teamResult ? '🔄 리롤' : '🎲 랜덤 섞기 시작!'}
                                            </button>
                                        </div>
                                    )}
                                    {juru.assignMethod === 'MANUAL' && (
                                        <div className="text-center animate-fadeIn">
                                            <p className="text-gray-400 mb-4 text-sm">"플레이어들이 각자 폰에서<br />원하는 팀을 직접 선택합니다."</p>
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
                                {/* 🎨 [수정] 최종 게임 시작 버튼 (red -> theme) */}
                                <button onClick={juru.handleStartGame} className={`mt-8 ${currentTheme.button} px-12 py-4 rounded-full text-2xl font-bold animate-bounce shadow-xl border-4 ${currentTheme.border}`}>
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
                                    {/* 팀전 모드: 팀 목록 */}
                                    {juru.gameMode === 'TEAM' && (
                                        <>
                                            <h3 className="text-xl font-bold text-gray-400 sticky top-0 bg-black py-2">TEAMS</h3>
                                            {juru.teamResult && Object.entries(juru.teamResult).map(([teamName, members], idx) => {
                                                // @ts-ignore
                                                const isTeamTurn = members.some(m => m.deviceId === juru.currentTurnDeviceId);
                                                return (
                                                    <motion.div key={teamName} animate={isTeamTurn ? { scale: 1.05 } : { scale: 1 }} className={`relative p-5 rounded-2xl border-2 transition-all duration-300 ${isTeamTurn ? `bg-gray-800 ${currentTheme.border}` : 'bg-gray-900 border-gray-700 opacity-80'}`}>
                                                        <h4 className={`font-bold text-lg mb-2 ${isTeamTurn ? currentTheme.text : 'text-white'}`}>{teamName}</h4>
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
                                        </>
                                    )}

                                    {/* 개인전 모드: 플레이어 순서 */}
                                    {juru.gameMode === 'SOLO' && (
                                        <>
                                            <h3 className="text-xl font-bold text-gray-400 sticky top-0 bg-black py-2">TURN ORDER</h3>
                                            {juru.soloTurnOrder.map((player, index) => {
                                                const isMyTurn = player.deviceId === juru.currentTurnDeviceId;
                                                return (
                                                    <motion.div
                                                        key={player.deviceId}
                                                        animate={isMyTurn ? { scale: 1.05 } : { scale: 1 }}
                                                        className={`p-4 rounded-xl border-2 transition-all ${isMyTurn ? `bg-yellow-500/20 ${currentTheme.border}` : 'bg-gray-900 border-gray-700'}`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-gray-500 font-mono font-bold text-lg">#{index + 1}</span>
                                                            <div
                                                                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg"
                                                                style={{ backgroundColor: player.color }}
                                                            >
                                                                {player.nickname[0]}
                                                            </div>
                                                            <span className={`font-bold text-lg ${isMyTurn ? currentTheme.text : 'text-white'}`}>
                                                                {player.nickname}
                                                            </span>
                                                            {isMyTurn && <span className="ml-auto text-3xl">👈</span>}
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ... (나머지 게임 컴포넌트 렌더링 부분은 동일) ... */}
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
                        players={players}
                        questionCount={truth.questionCount}
                        voteDoneCount={truth.voteDoneCount}
                        totalVoters={truth.totalVoters}
                        onSelectRandom={truth.handleSelectRandom}
                        onSelectAnswerer={truth.handleSelectAnswerer}
                        onFinishSubmit={truth.handleFinishSubmit}
                        onFinishQuestionVote={truth.handleFinishQuestionVote}
                        onFinishAnswering={truth.handleFinishAnswering}
                        onNextRound={truth.handleNextRound}
                    />
                )}

                {gameType === 'SPEED_QUIZ' && commonPhase === 'QUIZ_GAME' && (
                    <QuizBoard
                        phase={quiz.phase}
                        gameState={quiz.gameState}
                        categories={quiz.categories}
                        ranking={quiz.ranking}
                        teamCount={quiz.teamCount}
                        onTeamCountChange={quiz.testHandlers.handleTeamCountChange} // Hook에서 export 해줘야 함
                        onConfirmTeam={quiz.testHandlers.handleConfirmTeam} // Hook에서 export 해줘야 함
                        onStartRound={quiz.actions.startRound}
                        onNextTeam={quiz.actions.handleNextTeam}
                        onEndGame={quiz.actions.handleEndGame}
                        onCorrect={() => gameApi.quiz.correct(roomId).catch((e: any) => { console.error('정답 처리 실패:', e); alert('정답 처리 실패: ' + (e.response?.data?.message || e.message)); })}
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