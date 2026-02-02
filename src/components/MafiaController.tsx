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

    if (!isAlive) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-black text-gray-500 p-6 text-center">
                <div className="text-6xl mb-4">👻</div>
                <h2 className="text-2xl font-bold">당신은 사망했습니다</h2>
                <p>게임이 끝날 때까지 관전해주세요.</p>
            </div>
        );
    }

    // 행동 처리 함수
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
                    // 경찰 조사 결과는 바로 보여줌 (백엔드 응답 구조에 따라 수정 필요)
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

    // 🌟 1. 밤 (직업별 행동)
    if (phase === 'NIGHT') {
        return (
            <div className="h-full bg-slate-900 text-white p-6 flex flex-col">
                <h2 className="text-2xl font-bold text-purple-400 mb-2">🌙 밤이 되었습니다</h2>
                <p className="mb-6 text-gray-400">
                    {myRole === 'MAFIA' && '제거할 대상을 선택하세요.'}
                    {myRole === 'DOCTOR' && '살릴 대상을 선택하세요.'}
                    {myRole === 'POLICE' && '조사할 대상을 선택하세요.'}
                    {myRole === 'CIVILIAN' && '마피아가 활동 중입니다... 숨죽이세요.'}
                </p>

                {myRole === 'CIVILIAN' ? (
                    <div className="flex-1 flex items-center justify-center text-6xl animate-pulse">💤</div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        {alivePlayers.filter(p => p.deviceId !== deviceId).map(p => (
                            <button
                                key={p.deviceId}
                                onClick={() => setSelectedTarget(p.deviceId)}
                                className={`p-4 rounded-xl border-2 font-bold ${selectedTarget === p.deviceId ? 'bg-purple-600 border-purple-400' : 'bg-gray-800 border-gray-700'}`}
                            >
                                {p.nickname}
                            </button>
                        ))}
                    </div>
                )}

                {/* 경찰 결과창 */}
                {policeResult && (
                    <div className="bg-yellow-100 text-black p-4 rounded-lg text-center font-bold mb-4">
                        🕵️‍♂️ 조사 결과: {policeResult}
                    </div>
                )}

                {/* 실행 버튼 */}
                {myRole !== 'CIVILIAN' && (
                    <button 
                        onClick={handleAction} 
                        disabled={!selectedTarget}
                        className="w-full py-4 bg-red-600 rounded-xl font-bold disabled:opacity-50"
                    >
                        선택 완료
                    </button>
                )}
                
                {actionMessage && <p className="text-green-400 text-center mt-4">{actionMessage}</p>}
            </div>
        );
    }

    // ☀️ 2. 투표 시간
    if (phase === 'VOTE') {
        return (
            <div className="h-full bg-white text-black p-6 flex flex-col">
                <h2 className="text-2xl font-bold text-red-600 mb-2">🗳️ 투표하세요</h2>
                <p className="mb-6 text-gray-600">마피아로 의심되는 사람을 선택하세요.</p>

                <div className="grid grid-cols-2 gap-3 mb-6">
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

    // 🗣️ 3. 찬반 투표 (최종 변론 후)
    if (phase === 'FINAL_VOTE') {
        return (
            <div className="h-full bg-black text-white p-6 flex flex-col items-center justify-center gap-6">
                <h2 className="text-2xl font-bold">심판의 시간</h2>
                <p>죽이시겠습니까?</p>
                <div className="flex gap-4 w-full">
                    <button onClick={() => gameApi.mafia.finalVote(roomId, deviceId, true)} className="flex-1 py-6 bg-red-600 rounded-xl font-black text-2xl">👍 찬성</button>
                    <button onClick={() => gameApi.mafia.finalVote(roomId, deviceId, false)} className="flex-1 py-6 bg-blue-600 rounded-xl font-black text-2xl">👎 반대</button>
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