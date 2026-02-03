'use client';

import { useState, useEffect } from 'react';
import { LiarPhase } from '../types/liar';
import gameApi from '../services/gameApi';

interface LiarControllerProps {
    roomId: string;
    deviceId: string;
    phase: LiarPhase;
}

export default function LiarController({ roomId, deviceId, phase }: LiarControllerProps) {
    const [myRole, setMyRole] = useState<{ isLiar: boolean; keyword: string | null } | null>(null);
    const [hasVoted, setHasVoted] = useState(false);

    // 역할 받아오기 (페이즈가 ROLE_REVEAL로 바뀌면 실행)
    useEffect(() => {
        if (phase === 'ROLE_REVEAL') {
            gameApi.liar.getRole(roomId, deviceId)
                .then(res => setMyRole(res.data))
                .catch(console.error);
        }
    }, [phase, roomId, deviceId]);

    // 추가 라운드 투표
    const handleVoteMore = async (wantMore: boolean) => {
        try {
            await gameApi.liar.voteMore(roomId, deviceId, wantMore);
            setHasVoted(true);
        } catch (e) { alert("투표 실패!"); }
    };

    // 1. 역할 확인 & 설명 단계
    if (phase === 'ROLE_REVEAL' || phase === 'EXPLANATION' || phase === 'POINTING') {
        return (
            <div className={`h-full flex flex-col items-center justify-center p-6 text-center transition-colors duration-500 ${myRole?.isLiar ? 'bg-red-950' : 'bg-green-950'}`}>
                <div className="mb-8">
                    <span className="text-sm text-gray-400 tracking-widest">YOUR ROLE</span>
                    <h1 className={`text-4xl font-black mt-2 ${myRole?.isLiar ? 'text-red-500' : 'text-emerald-400'}`}>
                        {myRole ? (myRole.isLiar ? "🤥 LIAR" : "😇 CITIZEN") : "Loading..."}
                    </h1>
                </div>

                {/* 카드 뒤집기 효과처럼 연출 */}
                <div className="w-full max-w-xs aspect-[3/4] bg-white text-black rounded-2xl p-6 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    
                    {myRole?.isLiar ? (
                        <>
                            <div className="text-6xl mb-4">🤫</div>
                            <p className="font-bold text-lg text-center break-keep">
                                당신은 라이어입니다.
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="text-sm font-bold text-gray-500 mb-2">THE KEYWORD IS</div>
                            <div className="text-5xl font-black text-emerald-600 mb-8 break-keep leading-tight">
                                {myRole?.keyword || "???"}
                            </div>
                            <p className="text-sm text-center text-gray-500">
                                라이어에게 키워드를<br/>들키지 않게 설명하세요.
                            </p>
                        </>
                    )}
                </div>
                
                {phase === 'POINTING' && (
                    <div className="mt-8 animate-bounce text-yellow-400 font-bold text-xl">
                        👆 지금 바로 라이어를 지목하세요!
                    </div>
                )}
            </div>
        );
    }

    // 2. 추가 라운드 투표
    if (phase === 'VOTE_MORE_ROUND') {
        if (hasVoted) return (
            <div className="h-full bg-black text-white flex items-center justify-center">
                <span className="text-2xl font-bold animate-pulse">투표 완료! 대기 중...</span>
            </div>
        );

        return (
            <div className="h-full bg-gray-900 text-white p-6 flex flex-col items-center justify-center gap-6">
                <h2 className="text-2xl font-bold text-emerald-400">설명이 더 필요한가요?</h2>
                <button onClick={() => handleVoteMore(true)} className="w-full py-6 bg-emerald-600 rounded-xl font-bold text-2xl shadow-lg active:scale-95 transition">
                    🙆‍♂️ 네, 한 바퀴 더!
                </button>
                <button onClick={() => handleVoteMore(false)} className="w-full py-6 bg-red-600 rounded-xl font-bold text-2xl shadow-lg active:scale-95 transition">
                    🙅‍♂️ 아뇨, 투표해요!
                </button>
            </div>
        );
    }

    return <div className="h-full bg-black text-white flex items-center justify-center">게임 종료</div>;
}