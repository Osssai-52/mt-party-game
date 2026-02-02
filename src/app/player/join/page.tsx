'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function PlayerJoinContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // 입력값 상태 (방 번호, 닉네임)
    const [roomCode, setRoomCode] = useState('');
    const [nickname, setNickname] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // 화면이 켜지자마자 실행되는 것
    useEffect(() => {
        // 주소창에 ?room=1234가 있으면 방 번호 칸에 자동으로 채워넣기
        const codeFromUrl = searchParams.get('room');
        if (codeFromUrl) {
            setRoomCode(codeFromUrl);
        }
    }, [searchParams]);

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault(); // 새로고침 방지
        if (!roomCode || !nickname) {
            alert('방 번호와 닉네임을 모두 입력해주세요! 🚨');
            return;
        }

        setIsLoading(true);

        // 나중에 여기서 서버로 "입장시켜줘!" 요청을 보낼 거야.
        // 지금은 1초 뒤에 그냥 입장 성공한 척 넘어갈게!
        setTimeout(() => {
            // 플레이어 대기실로 이동
            router.push(`/player/${roomCode}?nickname=${nickname}`);
        }, 1000);
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-black p-6 text-white">
            <div className="w-full max-w-sm space-y-8">

                {/* 타이틀 영역 */}
                <div className="text-center space-y-2">
                    <span className="text-4xl">😎</span>
                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500">
                        PLAYER JOIN
                    </h2>
                    <p className="text-gray-400 text-sm">닉네임을 정하고 게임에 참여하세요!</p>
                </div>

                {/* 입력 폼 */}
                <form onSubmit={handleJoin} className="space-y-6 bg-gray-900/50 p-6 rounded-2xl border border-gray-800 backdrop-blur-sm">

                    {/* 방 번호 입력 */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 ml-1">ROOM CODE</label>
                        <input
                            type="text"
                            placeholder="1234"
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value)}
                            className="w-full px-4 py-4 bg-gray-800 border-2 border-gray-700 rounded-xl focus:border-purple-500 focus:outline-none text-center text-2xl font-mono tracking-widest transition-colors placeholder:text-gray-600"
                            maxLength={4}
                        />
                    </div>

                    {/* 닉네임 입력 */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 ml-1">NICKNAME</label>
                        <input
                            type="text"
                            placeholder="센스있는 닉네임"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            className="w-full px-4 py-4 bg-gray-800 border-2 border-gray-700 rounded-xl focus:border-pink-500 focus:outline-none text-center text-xl font-bold transition-colors"
                            maxLength={8}
                        />
                    </div>

                    {/* 입장 버튼 */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-lg shadow-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? '입장하는 중...' : '입장하기 🔥'}
                    </button>
                </form>

                <p className="text-center text-xs text-gray-600">
                    함께 즐기는 건전한 술자리 문화를 응원합니다 🍻
                </p>
            </div>
        </main>
    );
}

export default function PlayerJoinPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>}>
            <PlayerJoinContent />
        </Suspense>
    );
}