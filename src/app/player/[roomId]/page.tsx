'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import gameApi from '../../../services/gameApi';
import { getErrorMessage, API_BASE_URL } from '../../../services/api';
import { useToast } from '../../../components/Toast';
import MafiaController from '../../../components/MafiaController';
import TruthController from '../../../components/TruthController';
import QuizController from '../../../components/QuizController';
import { MafiaRole, MafiaPhase, MafiaPlayer } from '../../../types/mafia';
import { TruthPhase } from '../../../types/truth';
import LiarController from '../../../components/LiarController';
import { LiarPhase } from '../../../types/liar';

// 게임 페이즈 통합 타입
type GamePhase = 
    | 'LOBBY' | 'SUBMIT' | 'VOTE' | 'TEAM' | 'GAME' // 주루마블
    | 'MAFIA_GAME' // 마피아
    | 'TRUTH_GAME' // 진실게임 
    | 'QUIZ_GAME' // 몸으로 말해요/고요 속의 외침
    | 'LIAR_GAME'; // 라이어게임

const getDeviceId = () => {
    if (typeof window === 'undefined') return '';
    let id = localStorage.getItem('jurumarble_device_id');
    if (!id) {
        id = Math.random().toString(36).substring(2, 15);
        localStorage.setItem('jurumarble_device_id', id);
    }
    return id;
};

export default function PlayerRoomPage() {
    const params = useParams();
    const roomId = params.roomId as string;
    const searchParams = useSearchParams();
    const nickname = searchParams.get('nickname') || '익명';
    const deviceId = getDeviceId();
    const { showError, showSuccess } = useToast();

    // 공통 상태
    const [phase, setPhase] = useState<GamePhase>('LOBBY');
    const [isConnected, setIsConnected] = useState(false);
    
    // --- [주루마블 State] ---
    const [myPenalties, setMyPenalties] = useState<string[]>([]);
    const [inputPenalty, setInputPenalty] = useState('');
    const [voteList, setVoteList] = useState<{ id: number; content: string }[]>([]);
    const [votedIds, setVotedIds] = useState<number[]>([]);
    const [isVoteFinished, setIsVoteFinished] = useState(false);
    const [isRolling, setIsRolling] = useState(false);
    const [currentTurnDeviceId, setCurrentTurnDeviceId] = useState<string | null>(null);

    // --- [마피아 State] ---
    const [mafiaRole, setMafiaRole] = useState<MafiaRole>('CIVILIAN');
    const [mafiaPhase, setMafiaPhase] = useState<MafiaPhase>('NIGHT');
    const [isAlive, setIsAlive] = useState(true);
    const [alivePlayers, setAlivePlayers] = useState<MafiaPlayer[]>([]);

    // --- [진실게임 State] ---
    const [truthPhase, setTruthPhase] = useState<TruthPhase>('SELECT_ANSWERER');

    // --- [몸으로 말해요 State] ---
    const [quizPhase, setQuizPhase] = useState<string>('WAITING');

    // --- [라이어게임 State] ---
    const [liarPhase, setLiarPhase] = useState<LiarPhase>('LOBBY');

    // SSE 연결을 위한 Ref
    const eventSourceRef = useRef<EventSource | null>(null);

    // SSE 연결 함수 (재연결 지원)
    const connectSSE = useCallback(() => {
        const sseUrl = `${API_BASE_URL}/sse/player/connect?roomId=${roomId}&deviceId=${deviceId}`;
        const eventSource = new EventSource(sseUrl);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            setIsConnected(true);
            console.log('SSE 연결됨');
        };

        eventSource.onerror = () => {
            setIsConnected(false);
            eventSource.close();
            // 3초 후 재연결 시도
            setTimeout(() => {
                console.log('SSE 재연결 시도...');
                connectSSE();
            }, 3000);
        };

        return eventSource;
    }, [roomId, deviceId]);

    useEffect(() => {
        // 1. 방 입장 API 호출
        const joinRoom = async () => {
            try {
                await gameApi.room.join({ roomId, nickname });
                console.log(`입장 성공: ${nickname}`);
            } catch (e) {
                console.error("입장 실패", e);
            }
        };
        joinRoom();

        // 2. SSE 연결 (재연결 로직 포함)
        const eventSource = connectSSE();

        // [공통] 페이즈 변경 (게임 종류 전환 포함)
        eventSource.addEventListener('MARBLE_PHASE_CHANGE', (e) => {
            const data = JSON.parse(e.data);
            setPhase(data.phase); // GAME, MAFIA_GAME, TRUTH_GAME 등
            if (data.phase === 'VOTE') fetchVoteList();
        });

        // ---------------- [주루마블 이벤트] ----------------
        eventSource.addEventListener('MARBLE_TURN_CHANGE', (e) => {
            const data = JSON.parse(e.data);
            setCurrentTurnDeviceId(data.currentDeviceId);
            setIsRolling(false);
        });

        // ---------------- [마피아 이벤트] ----------------
        eventSource.addEventListener('MAFIA_ROLE_ASSIGNED', async () => {
            try {
                const res = await gameApi.mafia.getRole(roomId, deviceId);
                setMafiaRole(res.data.role);
                setPhase('MAFIA_GAME'); 
                setIsAlive(true);
                setMafiaPhase('NIGHT');
            } catch (e) { console.error(e); }
        });

        eventSource.addEventListener('LIAR_INIT', () => {
            setPhase('LIAR_GAME');
            setLiarPhase('ROLE_REVEAL');
        });

        eventSource.addEventListener('LIAR_NEXT_EXPLAINER', () => setLiarPhase('EXPLANATION'));
        eventSource.addEventListener('LIAR_VOTE_UPDATE', () => setLiarPhase('VOTE_MORE_ROUND'));
        eventSource.addEventListener('LIAR_POINTING_START', () => setLiarPhase('POINTING'));
        eventSource.addEventListener('LIAR_GAME_END', () => setLiarPhase('GAME_END'));

        // 모든 페이즈 이벤트 수신
        eventSource.addEventListener('MAFIA_NIGHT', () => setMafiaPhase('NIGHT'));
        eventSource.addEventListener('MAFIA_DAY_ANNOUNCEMENT', () => setMafiaPhase('DAY_ANNOUNCEMENT'));
        eventSource.addEventListener('MAFIA_VOTE_START', () => setMafiaPhase('VOTE'));
        
        eventSource.addEventListener('MAFIA_VOTE_RESULT', () => setMafiaPhase('VOTE_RESULT'));
        eventSource.addEventListener('MAFIA_FINAL_DEFENSE', () => setMafiaPhase('FINAL_DEFENSE'));
        eventSource.addEventListener('MAFIA_FINAL_VOTE_START', () => setMafiaPhase('FINAL_VOTE'));
        eventSource.addEventListener('MAFIA_FINAL_VOTE_RESULT', () => setMafiaPhase('FINAL_VOTE_RESULT'));
        eventSource.addEventListener('MAFIA_GAME_END', () => setMafiaPhase('END'));

        eventSource.addEventListener('MAFIA_ALIVE_UPDATE', (e) => {
            const data = JSON.parse(e.data);
            setAlivePlayers(data.players);
            const me = data.players.find((p: any) => p.deviceId === deviceId);
            if (me && !me.isAlive) setIsAlive(false);
        });

        // ---------------- [진실게임 이벤트] ----------------
        eventSource.addEventListener('TRUTH_PHASE_CHANGE', (e) => {
            const data = JSON.parse(e.data);
            setTruthPhase(data.phase); // SUBMIT_QUESTIONS, ANSWERING 등
            setPhase('TRUTH_GAME'); // 메인 페이즈 전환
        });

        // ---------------- [몸으로 말해요 이벤트] ----------------
        eventSource.addEventListener('QUIZ_STATE_UPDATE', (e) => {
            const data = JSON.parse(e.data);
            setPhase('QUIZ_GAME'); // 메인 페이즈 전환
            if (data.phase) setQuizPhase(data.phase); // WAITING, PLAYING 등 서브 페이즈
        });

        eventSource.addEventListener('QUIZ_NEXT', () => {
            setPhase('QUIZ_GAME');
            setQuizPhase('PLAYING'); // 문제가 나오면 플레이 상태로
        });

        eventSource.addEventListener('QUIZ_FINISHED', () => {
            setQuizPhase('FINISHED');
        });

        return () => {
            eventSource.close();
        };
    }, [roomId, nickname, deviceId, connectSSE]);

    // --- 주루마블 API 함수들 ---
    const fetchVoteList = async () => {
        try {
            const res = await gameApi.marble.getVotePenalties(roomId);
            setVoteList(res.data || []); 
        } catch (error) { console.error(error); }
    };

    const handleSubmitPenalty = async () => {
        if (!inputPenalty.trim()) return;
        if (myPenalties.length >= 2) { showError("2개까지만 제출할 수 있어요!"); return; }
        try {
            await gameApi.marble.submitPenalty(roomId, inputPenalty);
            setMyPenalties(prev => [...prev, inputPenalty]);
            setInputPenalty('');
            showSuccess("벌칙 제출 완료!");
        } catch (e) { showError(getErrorMessage(e)); }
    };

    const handleVote = async (id: number) => {
        if (isVoteFinished) return;
        setVotedIds(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
        await gameApi.marble.vote(roomId, id);
    };

    const handleFinishVoting = async () => {
        if (votedIds.length === 0 && !confirm("투표 안 해?")) return;
        setIsVoteFinished(true);
        await gameApi.marble.finishVote(roomId);
    };

    const handleRollDice = async () => {
        if (isRolling) return;
        setIsRolling(true);
        try {
            await gameApi.marble.rollDice(roomId, deviceId);
        } catch (error) {
            console.error(error);
            showError(getErrorMessage(error));
            setIsRolling(false);
        }
    };

    // ================= UI 렌더링 =================

    if (phase === 'LOBBY') return <div className="min-h-screen bg-black text-white p-6 flex justify-center items-center">대기 중...</div>;
    
    // --- [주루마블] ---
    if (phase === 'SUBMIT') return (
        <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center">
            <h1 className="text-2xl font-bold mb-4">벌칙 제출</h1>
            <input className="bg-gray-800 p-4 rounded-xl text-white mb-2 w-full" value={inputPenalty} onChange={e=>setInputPenalty(e.target.value)} />
            <button onClick={handleSubmitPenalty} className="bg-purple-600 p-4 rounded-xl w-full font-bold">제출하기 ({myPenalties.length}/2)</button>
            <div className="mt-4 w-full">
                {myPenalties.map((p, i) => <div key={i} className="bg-gray-900 p-2 mb-1 rounded flex justify-between">{p} ✅</div>)}
            </div>
        </div>
    );

    if (phase === 'VOTE') return (
        <div className="min-h-screen bg-black text-white p-6">
            <h1 className="text-2xl font-bold mb-4">투표하기</h1>
            <div className="space-y-2 mb-20">
                {voteList.map(v => (
                    <div key={v.id} onClick={()=>handleVote(v.id)} className={`p-4 rounded-xl border ${votedIds.includes(v.id)?'bg-blue-600 border-blue-400':'bg-gray-800 border-gray-700'}`}>{v.content}</div>
                ))}
            </div>
            <button onClick={handleFinishVoting} className="fixed bottom-6 w-[calc(100%-3rem)] left-6 bg-green-600 p-4 rounded-xl font-bold">투표 완료</button>
        </div>
    );

    if (phase === 'TEAM') {
        const teamNames = ['A', 'B', 'C', 'D'].slice(0, 2);
        const handleSelectTeam = async (teamName: string) => {
            try {
                await gameApi.team.selectTeam(roomId, deviceId, teamName);
                showSuccess(`${teamName}팀 선택 완료!`);
            } catch (e) { showError(getErrorMessage(e)); }
        };
        return (
            <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center">
                <h1 className="text-3xl font-bold mb-8">원하는 팀을 선택하세요! 👥</h1>
                <div className="grid grid-cols-2 gap-4 w-full">
                    {teamNames.map(name => (
                        <button key={name} onClick={() => handleSelectTeam(name)} className="py-10 bg-gray-800 border-2 border-purple-500 rounded-2xl text-2xl font-black hover:bg-purple-600 transition">
                            {name} 팀
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (phase === 'GAME') {
        const isMyTurn = currentTurnDeviceId === deviceId;
        return (
            <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center transition-colors duration-500 ${isMyTurn ? 'bg-black' : 'bg-gray-900'}`}>
                {isMyTurn ? (
                    <>
                        <h1 className="text-4xl font-black text-yellow-400 mb-8 animate-bounce">YOUR TURN! 🫵</h1>
                        <button onClick={handleRollDice} disabled={isRolling} className={`w-64 h-64 rounded-full flex flex-col items-center justify-center gap-4 border-8 ${isRolling ? 'bg-gray-800 border-gray-600' : 'bg-red-600 border-red-400 shadow-[0_0_50px_rgba(220,38,38,0.5)]'}`}>
                            <span className="text-8xl">{isRolling ? '💨' : '🎲'}</span>
                            <span className="text-2xl font-black">{isRolling ? 'Rolling...' : 'ROLL'}</span>
                        </button>
                    </>
                ) : (
                    <>
                        <div className="text-6xl mb-6 opacity-50 grayscale">🎲</div>
                        <h1 className="text-2xl font-bold text-gray-500 mb-2">다른 플레이어 차례</h1>
                        <p className="text-gray-600">잠시만 기다려주세요!</p>
                    </>
                )}
            </div>
        );
    }

    // --- [마피아 게임] ---
    if (phase === 'MAFIA_GAME') {
        return (
            <MafiaController 
                roomId={roomId}
                deviceId={deviceId}
                myRole={mafiaRole}
                phase={mafiaPhase}
                isAlive={isAlive}
                alivePlayers={alivePlayers}
            />
        );
    }

    // --- [진실 게임] ---
    if (phase === 'TRUTH_GAME') {
        return (
            <div className="min-h-screen bg-black text-white">
                <TruthController 
                    roomId={roomId}
                    deviceId={deviceId}
                    phase={truthPhase}
                />
            </div>
        );
    }

    // --- [몸으로 말해요] ---
    if (phase === 'QUIZ_GAME') {
        return (
            <div className="min-h-screen bg-black text-white">
                <QuizController 
                    roomId={roomId}
                    phase={quizPhase}
                />
            </div>
        );
    }

    // --- [라이어게임] ---
    if (phase === 'LIAR_GAME') {
        return <LiarController roomId={roomId} deviceId={deviceId} phase={liarPhase} />;
    }

    return null;
}