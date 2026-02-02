'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import gameApi from '../../../services/gameApi';

// 컴포넌트 임포트
import JuruBoard from '../../../components/JuruBoard';
import Dice3D from '../../../components/Dice3D';
import MafiaBoard from '../../../components/MafiaBoard'; // 마피아 보드

// 타입 임포트
import { MafiaPlayer, MafiaPhase } from '../../../types/mafia';

// 주루마블용 타입
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

// 전체 페이즈 정의
type GamePhase = 'LOBBY' | 'SUBMIT' | 'VOTE' | 'TEAM' | 'GAME' | 'MAFIA_GAME';

export default function LobbyPage() {
    const params = useParams();
    const roomId = params.roomId as string;
    const searchParams = useSearchParams();
    // 🌟 URL에서 어떤 게임인지 가져옴 (JURUMARBLE or MAFIA)
    const gameType = searchParams.get('game') || 'JURUMARBLE';

    const [phase, setPhase] = useState<GamePhase>('LOBBY');
    const [players, setPlayers] = useState<GamePlayer[]>([]); // 공통 플레이어 목록
    
    // --- [주루마블 State] ---
    const [penaltyCount, setPenaltyCount] = useState(0);
    const [finalPenalties, setFinalPenalties] = useState<{ text: string }[]>([]);
    const [teamCount, setTeamCount] = useState(2);
    const [teamResult, setTeamResult] = useState<Record<string, GamePlayer[]> | null>(null);
    const [currentTurnDeviceId, setCurrentTurnDeviceId] = useState<string | null>(null);
    const [activePenaltyText, setActivePenaltyText] = useState<string | null>(null);
    const [showDice, setShowDice] = useState(false);
    const [diceValue, setDiceValue] = useState(1);
    const [isRolling, setIsRolling] = useState(false);

    // --- [마피아 State] ---
    const [mafiaPhase, setMafiaPhase] = useState<MafiaPhase>('NIGHT');
    const [mafiaTimer, setMafiaTimer] = useState(0);
    const [mafiaSystemMessage, setMafiaSystemMessage] = useState("게임 시작 대기 중...");
    const [mafiaPlayers, setMafiaPlayers] = useState<MafiaPlayer[]>([]);

    const joinUrl = typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.host}/player/join?room=${roomId}&game=${gameType}`
        : '';

    const eventSourceRef = useRef<EventSource | null>(null);

    // -- API Helpers --
    const changePhaseOnly = async (newPhase: GamePhase) => {
        try { await gameApi.common.changePhase(roomId, newPhase); } catch (e) { console.error(e); }
    };

    // [주루마블] 투표 종료
    const handleFinishVote = async () => {
        if (!confirm("투표를 종료하고 팀 설정으로 넘어갈까요?")) return;
        try {
            await gameApi.marble.finishVote(roomId);
            await changePhaseOnly('TEAM');
        } catch (e) { console.error(e); }
    };

    // [주루마블] 팀 나누기
    const handleDivideTeams = async () => {
        try {
            const res = await gameApi.team.divideRandom(roomId, teamCount);
            setTeamResult(res.teams);
        } catch (e) { console.error(e); }
    };

    // 🌟 [통합] 게임 시작 버튼 핸들러
    const handleStartGame = async () => {
        try {
            if (gameType === 'MAFIA') {
                // 🕵️‍♀️ 마피아 게임 시작
                await gameApi.mafia.init(roomId);
                
                // 마피아 초기화 (로비에 있던 사람들 그대로 데려감)
                setMafiaPlayers(players.map(p => ({ 
                    deviceId: p.deviceId, 
                    nickname: p.nickname, 
                    isAlive: true,
                    profileImage: p.profileImage 
                })));
                setMafiaPhase('NIGHT');
                setMafiaSystemMessage("밤이 되었습니다. 마피아는 고개를 들어주세요.");
                
                await changePhaseOnly('MAFIA_GAME');
            } else {
                // 🎲 주루마블 게임 시작
                const res = await gameApi.marble.init(roomId);
                setFinalPenalties(res.penalties);
                await changePhaseOnly('GAME');
            }
        } catch (e) { console.error(e); }
    };

    // 초기 상태 로드
    const fetchState = async () => {
        try {
            // 게임 타입에 따라 다른 상태 조회 API를 호출할 수도 있음
            // 지금은 주루마블 상태 조회 API를 공용으로 쓴다고 가정 (필요시 백엔드 수정)
            const res = await gameApi.marble.getState(roomId);
            const data = res.data; 
            if(data && data.phase) setPhase(data.phase);
        } catch (e) { console.error("상태 로드 실패", e); }
    };

    useEffect(() => {
        fetchState();
        let hostId = localStorage.getItem('host_device_id');
        if(!hostId) {
            hostId = Math.random().toString(36).substring(7);
            localStorage.setItem('host_device_id', hostId);
        }
        const sseUrl = `${process.env.NEXT_PUBLIC_API_URL}/sse/connect?roomId=${roomId}&sessionId=${hostId}`;
        const eventSource = new EventSource(sseUrl);
        eventSourceRef.current = eventSource;

        // [공통] 플레이어 입장
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

        // [공통] 페이즈 변경
        eventSource.addEventListener('MARBLE_PHASE_CHANGE', (e) => {
            const data = JSON.parse(e.data);
            setPhase(data.phase);
        });

        // --- [주루마블 이벤트] ---
        eventSource.addEventListener('MARBLE_PENALTY_SUBMITTED', (e) => {
            const data = JSON.parse(e.data);
            setPenaltyCount(data.count);
        });

        eventSource.addEventListener('MARBLE_TURN_CHANGE', (e) => {
            const data = JSON.parse(e.data);
            setCurrentTurnDeviceId(data.currentDeviceId);
        });

        eventSource.addEventListener('MARBLE_DICE_ROLLED', (e) => {
            const data = JSON.parse(e.data); // { value: 5, deviceId: "..." }
            
            setShowDice(true);
            setIsRolling(true);

            setTimeout(() => {
                setIsRolling(false);
                setDiceValue(data.value);
                
                setTimeout(() => {
                    setShowDice(false);
                    setPlayers(prevPlayers => {
                        const roller = prevPlayers.find(p => p.deviceId === data.deviceId);
                        if (!roller) return prevPlayers;

                        let idsToMove: string[] = [data.deviceId];
                        if (teamResult) {
                            for (const members of Object.values(teamResult)) {
                                if (members.some(m => m.deviceId === data.deviceId)) {
                                    idsToMove = members.map(m => m.deviceId);
                                    break;
                                }
                            }
                        }

                        let nextPos = roller.currentPosition + data.value;
                        if (nextPos >= 28) nextPos -= 28;

                        let penaltyText = "";
                        if (nextPos === 0) penaltyText = "출발점 (휴식)";
                        else if (nextPos === 7) penaltyText = "🍺 의리주 채우기!";
                        else if (nextPos === 21) penaltyText = "🤮 의리주 원샷!";
                        else {
                            if (finalPenalties.length > 0) {
                                penaltyText = finalPenalties[nextPos % finalPenalties.length].text;
                            } else {
                                penaltyText = "벌칙 내용 없음";
                            }
                        }

                        setActivePenaltyText(penaltyText);
                        setTimeout(() => setActivePenaltyText(null), 3000);

                        return prevPlayers.map(p => {
                            if (idsToMove.includes(p.deviceId)) return { ...p, currentPosition: nextPos };
                            return p;
                        });
                    });
                }, 2000);
            }, 1000);
        });

        // --- [마피아 이벤트] ---
        eventSource.addEventListener('MAFIA_TIMER', (e) => {
            const data = JSON.parse(e.data);
            setMafiaTimer(data.timer);
        });

        eventSource.addEventListener('MAFIA_NIGHT', () => {
            setMafiaPhase('NIGHT');
            setMafiaSystemMessage("밤이 되었습니다. 마피아는 고개를 들어주세요.");
        });

        eventSource.addEventListener('MAFIA_DAY_ANNOUNCEMENT', (e) => {
            const data = JSON.parse(e.data);
            setMafiaPhase('DAY_ANNOUNCEMENT');
            if (data.deadPlayer) {
                setMafiaSystemMessage(`간밤에 ${data.deadPlayer}님이 살해당했습니다.`);
                setMafiaPlayers(prev => prev.map(p => 
                    p.nickname === data.deadPlayer ? { ...p, isAlive: false } : p
                ));
            } else {
                setMafiaSystemMessage("간밤에 아무도 죽지 않았습니다.");
            }
        });

        eventSource.addEventListener('MAFIA_VOTE_START', () => {
            setMafiaPhase('VOTE');
            setMafiaSystemMessage("투표를 시작합니다. 의심가는 사람을 선택하세요.");
        });
        
        eventSource.addEventListener('MAFIA_FINAL_VOTE_START', () => {
            setMafiaPhase('FINAL_VOTE');
            setMafiaSystemMessage("최후의 변론이 끝났습니다. 찬반 투표를 진행합니다.");
        });

        return () => { eventSource.close(); };
    }, [roomId, finalPenalties, teamResult]); 

    // 주루마블 보드용 말 계산 (팀별 대표 1명)
    const boardPieces = teamResult 
        ? Object.entries(teamResult).map(([teamName, members]) => {
            const representative = players.find(p => p.deviceId === members[0].deviceId);
            if (!representative) return null;
            return { ...representative, nickname: teamName };
        }).filter(p => p !== null) as GamePlayer[]
        : players;


    return (
        <main className="relative flex min-h-screen flex-col items-center bg-black text-white p-6 overflow-hidden">
            
            {/* Header (게임 종류 표시) */}
            <div className="w-full flex justify-between items-center mb-6 z-10 h-16 shrink-0">
                <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                    {gameType === 'MAFIA' ? '🕵️‍♂️ MAFIA GAME' : '🎲 JURU MARBLE'}
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
                {phase === 'LOBBY' && (
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

                            {/* 게임 시작 버튼 (게임 타입에 따라 로직 분기) */}
                            {gameType === 'MAFIA' ? (
                                <button onClick={handleStartGame} className="w-full py-4 bg-red-600 hover:bg-red-500 rounded-xl text-2xl font-bold shadow-lg">
                                    🕵️‍♂️ 마피아 게임 시작!
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button onClick={() => changePhaseOnly('SUBMIT')} className="flex-1 bg-purple-600 px-4 py-4 rounded-xl font-bold text-xl">
                                        1. 벌칙 제출 단계로
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- 주루마블 전용 페이즈 (SUBMIT, VOTE, TEAM, GAME) --- */}
                {gameType === 'JURUMARBLE' && (
                    <>
                        {phase === 'SUBMIT' && (
                           <div className="flex-1 flex flex-col items-center justify-center bg-gray-900/50 rounded-3xl p-6 border border-gray-800 max-w-4xl w-full">
                                <h2 className="text-4xl font-bold mb-4">😈 벌칙 제출 중...</h2>
                                <p className="text-xl text-gray-300 mb-8">현재 {penaltyCount}개의 벌칙이 제출되었습니다.</p>
                                <button onClick={() => changePhaseOnly('VOTE')} className="bg-blue-600 px-8 py-4 rounded-full text-2xl font-bold animate-pulse">
                                    투표 시작하기 👉
                                </button>
                           </div>
                        )}

                        {phase === 'VOTE' && (
                            <div className="flex flex-col items-center gap-8 w-full max-w-4xl">
                                <h2 className="text-4xl font-black mb-4">🗳️ 투표 진행 중...</h2>
                                <button onClick={handleFinishVote} className="bg-purple-600 px-12 py-4 rounded-full text-2xl font-bold shadow-lg">
                                    투표 마감 & 팀 편성하기 👥
                                </button>
                            </div>
                        )}

                        {phase === 'TEAM' && (
                            <div className="flex flex-col items-center w-full max-w-5xl gap-8">
                                <h2 className="text-4xl font-black mb-2">TEAM BUILDING</h2>
                                <div className="flex items-center gap-6 bg-gray-900 p-6 rounded-2xl border border-gray-700">
                                    <button onClick={() => setTeamCount(Math.max(2, teamCount - 1))} className="w-12 h-12 bg-gray-800 rounded-full text-2xl font-bold">-</button>
                                    <span className="text-4xl font-mono font-bold">{teamCount} TEAMS</span>
                                    <button onClick={() => setTeamCount(Math.min(players.length, teamCount + 1))} className="w-12 h-12 bg-gray-800 rounded-full text-2xl font-bold">+</button>
                                    <button onClick={handleDivideTeams} className="px-8 py-3 bg-blue-600 rounded-xl font-bold ml-4">🎲 팀 섞기</button>
                                </div>
                                <div className="w-full grid grid-cols-2 gap-4">
                                    {teamResult && Object.entries(teamResult).map(([teamName, members]) => (
                                        <div key={teamName} className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                                            <h3 className="font-bold text-xl mb-2">{teamName}</h3>
                                            <div className="flex gap-2 flex-wrap">
                                                {members.map((m: any) => <span key={m.deviceId} className="bg-black/50 px-2 py-1 rounded text-sm">{m.nickname}</span>)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={handleStartGame} className="mt-4 bg-red-600 px-12 py-4 rounded-full text-2xl font-bold animate-bounce">게임 시작! 🏁</button>
                            </div>
                        )}

                        {phase === 'GAME' && (
                            <div className="flex w-full h-full gap-6">
                                <div className="flex-1 h-full flex items-center justify-center">
                                    <JuruBoard players={boardPieces} penalties={finalPenalties} />
                                </div>
                                <div className="w-80 h-full flex flex-col gap-4 overflow-y-auto pr-2 pb-4">
                                    <h3 className="text-xl font-bold text-gray-400 sticky top-0 bg-black py-2">TEAMS</h3>
                                    {teamResult && Object.entries(teamResult).map(([teamName, members]) => {
                                        const isTeamTurn = members.some(m => m.deviceId === currentTurnDeviceId);
                                        return (
                                            <motion.div key={teamName} animate={isTeamTurn ? { scale: 1.05 } : { scale: 1 }} className={`relative p-5 rounded-2xl border-2 transition-all duration-300 ${isTeamTurn ? 'bg-gray-800 border-yellow-400' : 'bg-gray-900 border-gray-700 opacity-80'}`}>
                                                <h4 className={`font-bold text-lg mb-2 ${isTeamTurn ? 'text-yellow-400' : 'text-white'}`}>{teamName}</h4>
                                                <div className="space-y-2">
                                                    {members.map((m: any) => (
                                                        <div key={m.deviceId} className="flex items-center gap-2">
                                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color || '#fff' }} />
                                                            <span className={`text-sm ${m.deviceId === currentTurnDeviceId ? 'text-white font-bold underline decoration-yellow-400' : 'text-gray-400'}`}>{m.nickname}</span>
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

                {/* --- 마피아 전용 페이즈 --- */}
                {gameType === 'MAFIA' && phase === 'MAFIA_GAME' && (
                    <MafiaBoard 
                        players={mafiaPlayers}
                        phase={mafiaPhase}
                        timer={mafiaTimer}
                        systemMessage={mafiaSystemMessage}
                    />
                )}
            </div>

            {/* 주루마블용 모달들 (벌칙, 주사위) */}
            <AnimatePresence>
                {activePenaltyText && (
                    <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-none">
                        <div className="bg-gradient-to-br from-red-600 to-pink-600 p-1 rounded-3xl shadow-[0_0_100px_rgba(236,72,153,0.5)]">
                            <div className="bg-gray-900 rounded-[22px] px-12 py-16 text-center border border-white/20 min-w-[300px] max-w-4xl">
                                <h2 className="text-2xl text-yellow-400 font-bold mb-6 animate-pulse uppercase tracking-widest">PENALTY</h2>
                                <div className="text-5xl md:text-7xl font-black text-white leading-tight break-keep drop-shadow-lg">{activePenaltyText}</div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {showDice && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <Dice3D value={diceValue} rolling={isRolling} size={300} />
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}