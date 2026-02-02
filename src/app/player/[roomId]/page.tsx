'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import gameApi from '../../../services/gameApi'; 
import MafiaController from '../../../components/MafiaController';
import { MafiaRole, MafiaPhase, MafiaPlayer } from '../../../types/mafia';

type GamePhase = 'LOBBY' | 'SUBMIT' | 'VOTE' | 'TEAM' | 'GAME' | 'MAFIA_GAME';

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

    // 공통 상태
    const [phase, setPhase] = useState<GamePhase>('LOBBY');
    
    // --- [주루마블 State] ---
    const [myPenalties, setMyPenalties] = useState<string[]>([]);
    const [inputPenalty, setInputPenalty] = useState('');
    const [voteList, setVoteList] = useState<{ id: number; content: string }[]>([]);
    const [votedIds, setVotedIds] = useState<number[]>([]);
    const [isVoteFinished, setIsVoteFinished] = useState(false);
    const [isRolling, setIsRolling] = useState(false);
    const [currentTurnDeviceId, setCurrentTurnDeviceId] = useState<string | null>(null);

    // 마피아 State
    const [mafiaRole, setMafiaRole] = useState<MafiaRole>('CIVILIAN');
    const [mafiaPhase, setMafiaPhase] = useState<MafiaPhase>('NIGHT');
    const [isAlive, setIsAlive] = useState(true);
    const [alivePlayers, setAlivePlayers] = useState<MafiaPlayer[]>([]);

    // SSE 연결을 위한 Ref
    const eventSourceRef = useRef<EventSource | null>(null);

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

        // 2. 📡 SSE 연결 
        const sseUrl = `${process.env.NEXT_PUBLIC_API_URL}/sse/connect?roomId=${roomId}&deviceId=${deviceId}`;
        const eventSource = new EventSource(sseUrl);
        eventSourceRef.current = eventSource;

        // [공통] 페이즈 변경
        eventSource.addEventListener('MARBLE_PHASE_CHANGE', (e) => {
            const data = JSON.parse(e.data);
            setPhase(data.phase);
            if (data.phase === 'VOTE') fetchVoteList();
        });

        // [주루마블] 턴 변경 알림
        eventSource.addEventListener('MARBLE_TURN_CHANGE', (e) => {
            const data = JSON.parse(e.data); 
            setCurrentTurnDeviceId(data.currentDeviceId);
            setIsRolling(false); // 턴 바뀌면 버튼 다시 활성화 준비
        });

        // 🕵️‍♀️ [마피아] 게임 시작 및 역할 할당 알림
        eventSource.addEventListener('MAFIA_ROLE_ASSIGNED', async () => {
            try {
                // 내 역할 조회 API 호출
                const res = await gameApi.mafia.getRole(roomId, deviceId);
                setMafiaRole(res.data.role);
                // 마피아 게임 화면으로 전환
                setPhase('MAFIA_GAME'); 
                // 초기 상태 리셋
                setIsAlive(true);
                setMafiaPhase('NIGHT');
            } catch (e) {
                console.error("역할 조회 실패", e);
            }
        });

        // 🕵️‍♀️ [마피아] 페이즈 동기화
        eventSource.addEventListener('MAFIA_NIGHT', () => setMafiaPhase('NIGHT'));
        eventSource.addEventListener('MAFIA_DAY_ANNOUNCEMENT', () => setMafiaPhase('DAY_ANNOUNCEMENT'));
        eventSource.addEventListener('MAFIA_VOTE_START', () => setMafiaPhase('VOTE'));
        eventSource.addEventListener('MAFIA_FINAL_VOTE_START', () => setMafiaPhase('FINAL_VOTE'));
        
        // 🕵️‍♀️ [마피아] 생존자 목록 갱신
        eventSource.addEventListener('MAFIA_ALIVE_UPDATE', (e) => {
             const data = JSON.parse(e.data); // { players: [...] }
             setAlivePlayers(data.players);
             
             // 내가 죽었는지 확인
             const me = data.players.find((p: any) => p.deviceId === deviceId);
             if (me && !me.isAlive) setIsAlive(false);
        });

        return () => {
            eventSource.close();
        };
    }, [roomId, nickname, deviceId]);

    // --- 주루마블 API 함수들 ---
    const fetchVoteList = async () => {
        try {
            const res = await gameApi.marble.getVotePenalties(roomId);
            setVoteList(res.data || []); 
        } catch (error) { console.error(error); }
    };

    const handleSubmitPenalty = async () => {
        if (!inputPenalty.trim()) return;
        if (myPenalties.length >= 2) { alert("2개까지만!"); return; }
        try {
            await gameApi.marble.submitPenalty(roomId, inputPenalty);
            setMyPenalties(prev => [...prev, inputPenalty]);
            setInputPenalty('');
        } catch (e) { alert("실패!"); }
    };

    const handleVote = async (id: number) => {
        if (isVoteFinished) return;
        setVotedIds(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
        await gameApi.marble.vote(roomId, id);
    };

    const handleFinishVoting = async () => {
        if (votedIds.length === 0 && !confirm("투표 안 해?")) return;
        setIsVoteFinished(true);
        await gameApi.marble.completeVote(roomId);
    };

    const handleRollDice = async () => {
        if (isRolling) return;
        setIsRolling(true);
        try {
            await gameApi.marble.rollDice(roomId, deviceId);
        } catch (error) {
            console.error(error);
            alert("주사위 굴리기 실패");
            setIsRolling(false);
        }
    };

    // --- UI 렌더링 ---
    if (phase === 'LOBBY') return <div className="min-h-screen bg-black text-white p-6 flex justify-center items-center">대기 중...</div>;
    
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

    // 👇 [여기가 변경된 부분] TEAM 페이즈 로직 교체 완료!
    if (phase === 'TEAM') {
        const teamNames = ['A', 'B', 'C', 'D'].slice(0, 2); // 예시로 2개 팀 (실제로는 서버 설정에 따라 달라질 수 있음)

        const handleSelectTeam = async (teamName: string) => {
            try {
                // ⚠️ 주의: gameApi.ts에 team.selectTeam 함수가 있어야 에러가 안 나!
                await gameApi.team.selectTeam(roomId, deviceId, teamName);
                // 선택 성공 후 별도 처리가 필요하면 여기에 작성 (예: '선택 완료!' 알림)
            } catch (e) { alert("팀 선택 실패!"); }
        };

        return (
            <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center">
                <h1 className="text-3xl font-bold mb-8">원하는 팀을 선택하세요! 👥</h1>
                <div className="grid grid-cols-2 gap-4 w-full">
                    {teamNames.map(name => (
                        <button 
                            key={name}
                            onClick={() => handleSelectTeam(name)}
                            className="py-10 bg-gray-800 border-2 border-purple-500 rounded-2xl text-2xl font-black hover:bg-purple-600 transition"
                        >
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
                        <button
                            onClick={handleRollDice}
                            disabled={isRolling}
                            className={`w-64 h-64 rounded-full flex flex-col items-center justify-center gap-4 border-8 ${isRolling ? 'bg-gray-800 border-gray-600' : 'bg-red-600 border-red-400 shadow-[0_0_50px_rgba(220,38,38,0.5)]'}`}
                        >
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

    // 🕵️‍♀️ [마피아 게임] 화면 렌더링
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

    return null;
}