'use client';

import { useState } from 'react';
import { MafiaPhase, MafiaPlayer, MafiaRole } from '../types/mafia';
import gameApi from '../services/gameApi';

interface MafiaControllerProps {
    roomId: string;
    deviceId: string;
    myRole: MafiaRole;
    phase: MafiaPhase;
    isAlive: boolean;
    alivePlayers: MafiaPlayer[];
}

export default function MafiaController({ roomId, deviceId, myRole, phase, isAlive, alivePlayers }: MafiaControllerProps) {
    const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<string>('');
    const [policeResult, setPoliceResult] = useState<string | null>(null);

    // 🌟 채팅 관련 State
    const [chatMsg, setChatMsg] = useState('');
    const [chatLog, setChatLog] = useState<string[]>([]);

    if (!isAlive) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-black text-gray-500 p-6 text-center">
                <div className="text-6xl mb-4">👻</div>
                <h2 className="text-2xl font-bold">당신은 사망했습니다</h2>
                <p>게임이 끝날 때까지 관전해주세요.</p>
            </div>
        );
    }

    // 🌟 마피아 채팅 전송 핸들러
    const handleSendChat = async () => {
        if (!chatMsg.trim()) return;
        try {
            await gameApi.mafia.chat(roomId, deviceId, chatMsg);
            setChatLog(prev => [...prev, `나: ${chatMsg}`]); // 임시 로컬 반영 (SSE 연동 시 제거 가능)
            setChatMsg('');
        } catch (e) {
            console.error("채팅 전송 실패", e);
        }
    };

    // 행동 처리 함수 (킬/힐/경찰/투표)
    const handleAction = async () => {
        if (!selectedTarget) return;

        try {
            if (phase === 'NIGHT') {
                if (myRole === 'MAFIA') {
                    await gameApi.mafia.kill(roomId, deviceId, selectedTarget);
                    setActionMessage('🔫 타겟 지정 완료');
                } else if (myRole === 'DOCTOR') {
                    await gameApi.mafia.save(roomId, deviceId, selectedTarget);
                    setActionMessage('💉 치료 대상 지정 완료');
                } else if (myRole === 'POLICE') {
                    const res = await gameApi.mafia.investigate(roomId, deviceId, selectedTarget);
                    setPoliceResult(res.data.isMafia ? '😈 마피아입니다!' : '😇 시민입니다.');
                }
            } else if (phase === 'VOTE') {
                await gameApi.mafia.vote(roomId, deviceId, selectedTarget);
                setActionMessage('🗳️ 투표 완료');
            }
            setSelectedTarget(null);
        } catch (e) {
            alert('행동 실패! 다시 시도해주세요.');
        }
    };

    // 🌟 1. 밤 (직업별 행동 + 마피아 채팅)
    if (phase === 'NIGHT') {
        return (
            <div className="h-full bg-slate-900 text-white p-6 flex flex-col">
                <h2 className="text-2xl font-bold text-purple-400 mb-2">🌙 밤이 되었습니다</h2>
                <p className="mb-4 text-gray-400 text-sm">
                    {myRole === 'MAFIA' && '타겟 선택 및 동료와 상의하세요.'}
                    {myRole === 'DOCTOR' && '살릴 대상을 선택하세요.'}
                    {myRole === 'POLICE' && '조사할 대상을 선택하세요.'}
                    {myRole === 'CIVILIAN' && '마피아가 활동 중입니다... 숨죽이세요.'}
                </p>

                {/* 👇 마피아 전용 채팅방 */}
                {myRole === 'MAFIA' && (
                    <div className="mb-4 bg-gray-800 p-3 rounded-xl border border-red-900/50 flex flex-col gap-2">
                        <div className="text-xs font-bold text-red-500">😈 MAFIA CHAT</div>
                        <div className="h-24 overflow-y-auto text-sm text-gray-300 bg-black/20 p-2 rounded">
                            {chatLog.length === 0 ? <span className="opacity-50">작전 회의를 시작하세요...</span> : chatLog.map((msg, i) => <div key={i}>{msg}</div>)}
                        </div>
                        <div className="flex gap-2">
                            <input 
                                className="flex-1 bg-gray-900 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                                value={chatMsg}
                                onChange={e => setChatMsg(e.target.value)}
                                placeholder="메시지 입력..."
                            />
                            <button onClick={handleSendChat} className="bg-red-600 px-4 py-2 rounded text-sm font-bold">전송</button>
                        </div>
                    </div>
                )}

                {myRole === 'CIVILIAN' ? (
                    <div className="flex-1 flex items-center justify-center text-6xl animate-pulse">💤</div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 mb-6 overflow-y-auto">
                        {alivePlayers.filter(p => p.deviceId !== deviceId).map(p => (
                            <button
                                key={p.deviceId}
                                onClick={() => setSelectedTarget(p.deviceId)}
                                className={`p-4 rounded-xl border-2 font-bold transition-all ${selectedTarget === p.deviceId ? 'bg-purple-600 border-purple-400 scale-105' : 'bg-gray-800 border-gray-700'}`}
                            >
                                {p.nickname}
                            </button>
                        ))}
                    </div>
                )}

                {/* 경찰 결과창 */}
                {policeResult && (
                    <div className="bg-yellow-100 text-black p-4 rounded-lg text-center font-bold mb-4 animate-bounce">
                        🕵️‍♂️ 조사 결과: {policeResult}
                    </div>
                )}

                {/* 실행 버튼 */}
                {myRole !== 'CIVILIAN' && (
                    <button 
                        onClick={handleAction} 
                        disabled={!selectedTarget}
                        className="w-full py-4 bg-purple-600 rounded-xl font-bold disabled:opacity-50 shadow-lg"
                    >
                        선택 완료
                    </button>
                )}
                
                {actionMessage && <p className="text-green-400 text-center mt-4 text-sm">{actionMessage}</p>}
            </div>
        );
    }

    // ☀️ 2. 투표 시간
    if (phase === 'VOTE') {
        return (
            <div className="h-full bg-white text-black p-6 flex flex-col">
                <h2 className="text-2xl font-bold text-red-600 mb-2">🗳️ 투표하세요</h2>
                <p className="mb-6 text-gray-600">마피아로 의심되는 사람을 선택하세요.</p>

                <div className="grid grid-cols-2 gap-3 mb-6 overflow-y-auto">
                    {alivePlayers.filter(p => p.deviceId !== deviceId).map(p => (
                        <button
                            key={p.deviceId}
                            onClick={() => setSelectedTarget(p.deviceId)}
                            className={`p-4 rounded-xl border-2 font-bold ${selectedTarget === p.deviceId ? 'bg-red-600 text-white' : 'bg-gray-100 border-gray-300'}`}
                        >
                            {p.nickname}
                        </button>
                    ))}
                </div>

                <button 
                    onClick={handleAction} 
                    disabled={!selectedTarget}
                    className="w-full py-4 bg-black text-white rounded-xl font-bold disabled:opacity-50"
                >
                    투표하기
                </button>
                {actionMessage && <p className="text-blue-600 text-center mt-4">{actionMessage}</p>}
            </div>
        );
    }

    // 🗣️ 3. 최후의 변론 (지목된 사람만 말할 수 있지만, 여기선 UI만 표시)
    if (phase === 'FINAL_DEFENSE') {
        return (
            <div className="h-full bg-gray-900 text-white p-6 flex flex-col items-center justify-center text-center">
                <div className="text-6xl mb-6">📢</div>
                <h2 className="text-2xl font-bold mb-2">최후의 변론 시간</h2>
                <p className="text-gray-400">지목된 대상은 최후의 변론을 진행해주세요.</p>
                <div className="mt-8 animate-pulse text-yellow-400 font-bold">
                    다른 플레이어들은 경청해주세요.
                </div>
            </div>
        );
    }

    // ⚖️ 4. 찬반 투표 (최종 변론 후)
    if (phase === 'FINAL_VOTE') {
        return (
            <div className="h-full bg-black text-white p-6 flex flex-col items-center justify-center gap-6">
                <h2 className="text-2xl font-bold">심판의 시간</h2>
                <p className="text-gray-400">대상자를 처형하시겠습니까?</p>
                <div className="flex gap-4 w-full mt-4">
                    <button onClick={() => gameApi.mafia.finalVote(roomId, deviceId, true)} className="flex-1 py-8 bg-red-600 hover:bg-red-500 rounded-2xl font-black text-2xl shadow-[0_0_20px_rgba(220,38,38,0.5)] transition">
                        👍 찬성 (유죄)
                    </button>
                    <button onClick={() => gameApi.mafia.finalVote(roomId, deviceId, false)} className="flex-1 py-8 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-2xl shadow-[0_0_20px_rgba(37,99,235,0.5)] transition">
                        👎 반대 (무죄)
                    </button>
                </div>
            </div>
        );
    }

    // 그 외 (낮 토론, 결과 발표 등)
    return (
        <div className="flex flex-col items-center justify-center h-full bg-sky-100 p-6 text-center">
            <h2 className="text-xl font-bold text-gray-700 mb-2">진행 중...</h2>
            <p className="text-gray-500">사회자의 안내를 따라주세요.</p>
        </div>
    );
}