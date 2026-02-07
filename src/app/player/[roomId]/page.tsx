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
    | 'LOBBY' | 'SUBMIT' | 'VOTE' | 'MODE_SELECT' | 'TEAM' | 'GAME' // 주루마블
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
    const [voteList, setVoteList] = useState<{ id: string; text: string }[]>([]);
    const [votedIds, setVotedIds] = useState<string[]>([]);
    const [isVoteFinished, setIsVoteFinished] = useState(false);
    const [isRolling, setIsRolling] = useState(false);
    const [currentTurnDeviceId, setCurrentTurnDeviceId] = useState<string | null>(null);

    // --- [팀짜기 State] ---
    const [teamSubPhase, setTeamSubPhase] = useState<'WAITING' | 'ASSIGNED' | 'MANUAL_SELECT'>('WAITING');
    const [myTeamName, setMyTeamName] = useState<string | null>(null);
    const [myTeammates, setMyTeammates] = useState<string[]>([]);
    const [manualTeamCount, setManualTeamCount] = useState(2);
    const [manualMaxPerTeam, setManualMaxPerTeam] = useState(0);
    const [manualTeamStatus, setManualTeamStatus] = useState<Record<string, string[]>>({});
    const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

    // --- [마피아 State] ---
    const [mafiaRole, setMafiaRole] = useState<MafiaRole>('CIVILIAN');
    const [mafiaPhase, setMafiaPhase] = useState<MafiaPhase>('NIGHT');
    const [isAlive, setIsAlive] = useState(true);
    const [alivePlayers, setAlivePlayers] = useState<MafiaPlayer[]>([]);

    // --- [진실게임 State] ---
    const [truthPhase, setTruthPhase] = useState<TruthPhase>('SELECT_ANSWERER');
    const [truthQuestionList, setTruthQuestionList] = useState<{index: number, question: string}[]>([]);
    const [truthAnswererDeviceId, setTruthAnswererDeviceId] = useState<string | null>(null);

    // --- [몸으로 말해요 State] ---
    const [quizPhase, setQuizPhase] = useState<string>('WAITING');
    const [quizCurrentWord, setQuizCurrentWord] = useState<string | null>(null);
    const [quizCurrentTeam, setQuizCurrentTeam] = useState<string | null>(null);
    const [quizRemainingSeconds, setQuizRemainingSeconds] = useState<number>(60);

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
        // SSE 연결 (join은 이미 /player/join 페이지에서 완료됨)
        const eventSource = connectSSE();

        // [공통] 페이즈 변경 (게임 종류 전환 포함)
        eventSource.addEventListener('MARBLE_PHASE_CHANGE', (e) => {
            const data = JSON.parse(e.data);
            setPhase(data.phase);
            if (data.phase === 'VOTE') fetchVoteList();
            if (data.phase === 'TEAM') {
                setTeamSubPhase('WAITING');
                setMyTeamName(null);
                setMyTeammates([]);
                setSelectedTeam(null);
            }
            // 게임 페이즈로 전환 시 현재 턴 정보 확인
            if (data.phase === 'GAME' && data.currentTurnDeviceId) {
                setCurrentTurnDeviceId(data.currentTurnDeviceId);
            }
        });

        // ---------------- [주루마블 이벤트] ----------------
        eventSource.addEventListener('MARBLE_TURN_CHANGE', (e) => {
            const data = JSON.parse(e.data);
            setCurrentTurnDeviceId(data.currentDeviceId);
            setIsRolling(false);
        });

        // 게임 모드 선택 완료 시 첫 턴 정보 수신
        eventSource.addEventListener('MARBLE_MODE_SELECTED', (e) => {
            const data = JSON.parse(e.data);
            if (data.turnOrder && data.turnOrder.length > 0) {
                setCurrentTurnDeviceId(data.turnOrder[0]);
            }
        });

        // 게임 초기화 완료 시 첫 턴 정보 수신
        eventSource.addEventListener('MARBLE_INIT', (e) => {
            const data = JSON.parse(e.data);
            if (data.turnOrder && data.turnOrder.length > 0) {
                setCurrentTurnDeviceId(data.turnOrder[0]);
            } else if (data.currentTurnDeviceId) {
                setCurrentTurnDeviceId(data.currentTurnDeviceId);
            }
        });

        // ---------------- [팀짜기 이벤트] ----------------
        eventSource.addEventListener('TEAM_ASSIGNED', (e) => {
            const data = JSON.parse(e.data);
            // 내 팀 찾기
            const myInfo = data.players?.find((p: any) => p.deviceId === deviceId);
            if (myInfo) {
                setMyTeamName(myInfo.team);
                // 같은 팀원 닉네임 찾기
                const teammates = data.players
                    .filter((p: any) => p.team === myInfo.team && p.deviceId !== deviceId)
                    .map((p: any) => p.nickname);
                setMyTeammates(teammates);
            }
            setTeamSubPhase('ASSIGNED');
            setSelectedTeam(null);
        });

        eventSource.addEventListener('TEAM_MANUAL_START', (e) => {
            const data = JSON.parse(e.data);
            setManualTeamCount(data.teamCount);
            setManualMaxPerTeam(data.maxPerTeam);
            setManualTeamStatus({});
            setTeamSubPhase('MANUAL_SELECT');
            setMyTeamName(null);
            setMyTeammates([]);
            setSelectedTeam(null);
        });

        eventSource.addEventListener('PLAYER_TEAM_SELECTED', (e) => {
            const data = JSON.parse(e.data);
            if (data.teams) {
                setManualTeamStatus(data.teams);
            }
            // 내가 선택한 경우
            if (data.nickname && data.team) {
                // 이 이벤트에서 내 정보를 다시 계산
                const myTeam = Object.entries(data.teams || {}).find(
                    ([_, members]) => (members as string[]).includes(nickname)
                );
                if (myTeam) {
                    setMyTeamName(myTeam[0]);
                    setMyTeammates((myTeam[1] as string[]).filter(n => n !== nickname));
                }
            }
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
            setTruthPhase(data.phase);
            setPhase('TRUTH_GAME');
        });

        eventSource.addEventListener('TRUTH_ANSWERER_SELECTED', (e) => {
            const data = JSON.parse(e.data);
            if (data.phase) setTruthPhase(data.phase);
            if (data.answerer?.deviceId) setTruthAnswererDeviceId(data.answerer.deviceId);
            setPhase('TRUTH_GAME');
        });

        eventSource.addEventListener('TRUTH_QUESTIONS_READY', (e) => {
            const data = JSON.parse(e.data);
            if (data.phase) setTruthPhase(data.phase);
            if (data.questions) setTruthQuestionList(data.questions);
        });

        eventSource.addEventListener('TRUTH_START_ANSWERING', (e) => {
            const data = JSON.parse(e.data);
            if (data.phase) setTruthPhase(data.phase);
        });

        eventSource.addEventListener('TRUTH_RESULT', (e) => {
            const data = JSON.parse(e.data);
            if (data.phase) setTruthPhase(data.phase);
        });

        eventSource.addEventListener('TRUTH_NEXT_ROUND', (e) => {
            const data = JSON.parse(e.data);
            if (data.phase) setTruthPhase(data.phase);
            setTruthQuestionList([]);
            setTruthAnswererDeviceId(null);
        });

        // ---------------- [몸으로 말해요 이벤트] ----------------
        eventSource.addEventListener('QUIZ_INIT', () => {
            setPhase('QUIZ_GAME');
            setQuizPhase('WAITING');
        });

        eventSource.addEventListener('QUIZ_ROUND_START', (e) => {
            const data = JSON.parse(e.data);
            setPhase('QUIZ_GAME');
            setQuizPhase('PLAYING');
            setQuizCurrentWord(data.currentWord);
            setQuizCurrentTeam(data.team);
            setQuizRemainingSeconds(data.timer);
        });

        eventSource.addEventListener('QUIZ_TIMER', (e) => {
            const data = JSON.parse(e.data);
            setQuizRemainingSeconds(data.remaining);
            if (data.currentWord) setQuizCurrentWord(data.currentWord);
        });

        eventSource.addEventListener('QUIZ_CORRECT', (e) => {
            const data = JSON.parse(e.data);
            setQuizCurrentWord(data.currentWord);
        });

        eventSource.addEventListener('QUIZ_PASS', (e) => {
            const data = JSON.parse(e.data);
            setQuizCurrentWord(data.currentWord);
        });

        eventSource.addEventListener('QUIZ_ROUND_END', () => {
            setQuizPhase('ROUND_END');
            setQuizCurrentWord(null);
        });

        eventSource.addEventListener('QUIZ_NEXT_TEAM', (e) => {
            const data = JSON.parse(e.data);
            setQuizPhase('WAITING');
            setQuizCurrentTeam(data.nextTeam);
            setQuizCurrentWord(null);
        });

        eventSource.addEventListener('QUIZ_FINAL_RANKING', () => {
            setQuizPhase('FINISHED');
        });

        eventSource.addEventListener('QUIZ_STATE_UPDATE', (e) => {
            const data = JSON.parse(e.data);
            setPhase('QUIZ_GAME');
            if (data.phase) setQuizPhase(data.phase);
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
            await gameApi.marble.submitPenalty(roomId, inputPenalty, deviceId);
            setMyPenalties(prev => [...prev, inputPenalty]);
            setInputPenalty('');
            showSuccess("벌칙 제출 완료!");
        } catch (e) { showError(getErrorMessage(e)); }
    };

    const handleVote = async (id: string) => {
        if (isVoteFinished) return;
        setVotedIds(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
        await gameApi.marble.vote(roomId, deviceId, id);
    };

    const handleFinishVoting = async () => {
        if (votedIds.length === 0 && !confirm("투표 안 해?")) return;
        try {
            await gameApi.marble.voteDone(roomId, deviceId);
            setIsVoteFinished(true);
        } catch (e) { showError(getErrorMessage(e)); }
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
    if (phase === 'SUBMIT') {
        const isLimitReached = myPenalties.length >= 2;
        return (
            <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center">
                <h1 className="text-2xl font-bold mb-4">벌칙 제출</h1>
                {isLimitReached ? (
                    <p className="text-green-400 text-lg font-bold mb-4">제출 완료! 다른 사람을 기다려주세요.</p>
                ) : (
                    <>
                        <input className="bg-gray-800 p-4 rounded-xl text-white mb-2 w-full" value={inputPenalty} onChange={e=>setInputPenalty(e.target.value)} placeholder="벌칙을 입력하세요" />
                        <button onClick={handleSubmitPenalty} className="bg-purple-600 p-4 rounded-xl w-full font-bold">제출하기 ({myPenalties.length}/2)</button>
                    </>
                )}
                <div className="mt-4 w-full">
                    {myPenalties.map((p, i) => <div key={i} className="bg-gray-900 p-2 mb-1 rounded flex justify-between">{p} ✅</div>)}
                </div>
            </div>
        );
    }

    if (phase === 'VOTE') {
        if (isVoteFinished) {
            return (
                <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center">
                    <p className="text-green-400 text-2xl font-bold">투표 완료!</p>
                    <p className="text-gray-400 mt-2">다른 사람들을 기다려주세요.</p>
                </div>
            );
        }
        return (
            <div className="min-h-screen bg-black text-white p-6">
                <h1 className="text-2xl font-bold mb-4">투표하기</h1>
                <div className="space-y-2 mb-20">
                    {voteList.map(v => (
                        <div key={v.id} onClick={()=>handleVote(v.id)} className={`p-4 rounded-xl border ${votedIds.includes(v.id)?'bg-blue-600 border-blue-400':'bg-gray-800 border-gray-700'}`}>{v.text}</div>
                    ))}
                </div>
                <button onClick={handleFinishVoting} className="fixed bottom-6 w-[calc(100%-3rem)] left-6 bg-green-600 p-4 rounded-xl font-bold">투표 완료</button>
            </div>
        );
    }

    // [신규] 게임 모드 선택 대기
    if (phase === 'MODE_SELECT') {
        return (
            <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center">
                <div className="text-6xl mb-6 animate-pulse">⏳</div>
                <h1 className="text-3xl font-bold">게임 모드 선택 중...</h1>
                <p className="text-gray-400 mt-4">호스트가 모드를 정하고 있습니다.</p>
                <div className="mt-8 flex gap-4">
                    <div className="bg-blue-600/20 border border-blue-500 rounded-xl p-4">
                        <div className="text-3xl mb-2">👥</div>
                        <div className="text-sm text-gray-300">팀전</div>
                    </div>
                    <div className="bg-orange-600/20 border border-orange-500 rounded-xl p-4">
                        <div className="text-3xl mb-2">🏃</div>
                        <div className="text-sm text-gray-300">개인전</div>
                    </div>
                </div>
            </div>
        );
    }

    if (phase === 'TEAM') {
        // 1) 대기 중 (호스트가 팀 방식을 결정하는 중)
        if (teamSubPhase === 'WAITING') {
            return (
                <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center">
                    <div className="text-6xl mb-6 animate-pulse">👥</div>
                    <h1 className="text-3xl font-bold">팀 정하는 중...</h1>
                    <p className="text-gray-400 mt-4">호스트가 팀을 구성하고 있습니다.</p>
                </div>
            );
        }

        // 2) 랜덤 배정 완료 → 내 팀 + 같은 팀원 표시
        if (teamSubPhase === 'ASSIGNED' && myTeamName) {
            return (
                <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center">
                    <div className="text-6xl mb-4">🎉</div>
                    <h1 className="text-4xl font-black text-yellow-400 mb-6">{myTeamName}팀</h1>
                    <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm border border-gray-700">
                        <h2 className="text-lg font-bold text-gray-300 mb-3">같은 팀원</h2>
                        <div className="space-y-2">
                            {myTeammates.map((name, i) => (
                                <div key={i} className="bg-gray-700 px-4 py-2 rounded-xl text-white font-bold">{name}</div>
                            ))}
                            {myTeammates.length === 0 && (
                                <p className="text-gray-500">나 혼자입니다!</p>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        // 3) 수동 선택 모드
        if (teamSubPhase === 'MANUAL_SELECT') {
            const teamNames = Array.from({ length: manualTeamCount }, (_, i) => (i + 1).toString());

            const handleSelectTeam = async (teamName: string) => {
                try {
                    await gameApi.team.selectTeam(roomId, deviceId, teamName, manualTeamCount);
                    setSelectedTeam(teamName);
                    showSuccess(`${teamName}팀 선택 완료!`);
                } catch (e) { showError(getErrorMessage(e)); }
            };

            // 이미 팀을 선택한 경우
            if (selectedTeam) {
                return (
                    <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center">
                        <div className="text-6xl mb-4">✅</div>
                        <h1 className="text-3xl font-bold text-green-400 mb-2">{selectedTeam}팀 선택 완료!</h1>
                        <p className="text-gray-400">다른 플레이어를 기다려주세요.</p>
                        {myTeammates.length > 0 && (
                            <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm border border-gray-700 mt-6">
                                <h2 className="text-lg font-bold text-gray-300 mb-3">같은 팀원</h2>
                                <div className="space-y-2">
                                    {myTeammates.map((name, i) => (
                                        <div key={i} className="bg-gray-700 px-4 py-2 rounded-xl text-white font-bold">{name}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            }

            return (
                <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center">
                    <h1 className="text-3xl font-bold mb-2">원하는 팀을 선택하세요!</h1>
                    <p className="text-gray-400 mb-8 text-sm">팀당 최대 {manualMaxPerTeam}명 (선착순)</p>
                    <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                        {teamNames.map(name => {
                            const members = manualTeamStatus[name] || [];
                            const isFull = members.length >= manualMaxPerTeam;
                            return (
                                <button
                                    key={name}
                                    onClick={() => !isFull && handleSelectTeam(name)}
                                    disabled={isFull}
                                    className={`py-10 rounded-2xl text-2xl font-black transition border-2 ${
                                        isFull
                                            ? 'bg-gray-900 border-gray-700 text-gray-600 cursor-not-allowed'
                                            : 'bg-gray-800 border-purple-500 hover:bg-purple-600'
                                    }`}
                                >
                                    {name}팀
                                    <div className="text-sm font-normal mt-1 text-gray-400">
                                        {members.length}/{manualMaxPerTeam}명
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            );
        }

        // fallback
        return (
            <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center">
                <div className="text-6xl mb-6 animate-pulse">👥</div>
                <h1 className="text-3xl font-bold">팀 정하는 중...</h1>
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
                    questionList={truthQuestionList}
                    answererDeviceId={truthAnswererDeviceId}
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
                    currentWord={quizCurrentWord}
                    currentTeam={quizCurrentTeam}
                    remainingSeconds={quizRemainingSeconds}
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