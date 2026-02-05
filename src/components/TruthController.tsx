'use client';

import { useState, useEffect } from 'react';
import { TruthPhase } from '../types/truth';
import gameApi from '../services/gameApi';

interface QuestionItem {
    index: number;
    question: string;
}

interface TruthControllerProps {
    roomId: string;
    deviceId: string;
    phase: TruthPhase;
    questionList?: QuestionItem[];
}

export default function TruthController({ roomId, deviceId, phase, questionList = [] }: TruthControllerProps) {
    const [questionInput, setQuestionInput] = useState("");
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [votedIndices, setVotedIndices] = useState<number[]>([]);
    const [isVoteDone, setIsVoteDone] = useState(false);

    // 페이즈 변경 시 상태 리셋
    useEffect(() => {
        if (phase === 'SUBMIT_QUESTIONS') {
            setIsSubmitted(false);
            setQuestionInput("");
        }
        if (phase === 'SELECT_QUESTION') {
            setVotedIndices([]);
            setIsVoteDone(false);
        }
    }, [phase]);

    // 질문 제출 핸들러
    const handleSubmit = async () => {
        if (!questionInput.trim()) return;
        try {
            await gameApi.truth.submitQuestion(roomId, deviceId, questionInput);
            setIsSubmitted(true);
            setQuestionInput("");
        } catch (e) { alert("제출 실패! 잠시 후 다시 시도해주세요."); }
    };

    // 질문 투표 토글
    const handleVote = async (questionIndex: number) => {
        if (isVoteDone) return;
        try {
            await gameApi.truth.voteQuestion(roomId, deviceId, questionIndex);
            setVotedIndices(prev =>
                prev.includes(questionIndex)
                    ? prev.filter(i => i !== questionIndex)
                    : [...prev, questionIndex]
            );
        } catch (e) { console.error(e); }
    };

    // 투표 완료
    const handleVoteDone = async () => {
        try {
            await gameApi.truth.voteQuestionDone(roomId, deviceId);
            setIsVoteDone(true);
        } catch (e) { console.error(e); }
    };

    // 리액션 전송 핸들러
    const sendReaction = async (type: 'FIREWORK' | 'BOO' | 'ANGRY') => {
        try { await gameApi.common.sendReaction({ roomId, type }); } catch (e) {}
    };

    // 1. 질문 제출 단계
    if (phase === 'SUBMIT_QUESTIONS') {
        if (isSubmitted) return (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 animate-fadeIn">
                <div className="text-6xl mb-4">📨</div>
                <h2 className="text-2xl font-bold text-white">질문 제출 완료!</h2>
                <p className="text-gray-400 mt-2">다른 플레이어를 기다리고 있습니다.</p>
            </div>
        );

        return (
            <div className="p-6 h-full flex flex-col justify-center animate-fadeIn">
                <h2 className="text-2xl font-bold text-white mb-2">익명 질문을 남겨주세요</h2>
                <p className="text-sm text-gray-400 mb-6">답변자의 멘탈을 흔들 강력한 질문!</p>

                <textarea
                    className="w-full p-4 rounded-2xl bg-gray-800 text-white mb-4 h-40 text-lg border border-gray-700 focus:border-purple-500 focus:outline-none transition"
                    placeholder="예: 솔직히 여기서 제일 맘에 드는 사람 있어?"
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                />
                <button
                    onClick={handleSubmit}
                    disabled={!questionInput.trim()}
                    className="w-full py-4 bg-purple-600 rounded-xl font-bold text-white text-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    질문 던지기
                </button>
            </div>
        );
    }

    // 2. 질문 투표 단계
    if (phase === 'SELECT_QUESTION') {
        if (isVoteDone) return (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 animate-fadeIn">
                <div className="text-6xl mb-4">✅</div>
                <h2 className="text-2xl font-bold text-white">투표 완료!</h2>
                <p className="text-gray-400 mt-2">다른 플레이어를 기다리고 있습니다.</p>
            </div>
        );

        return (
            <div className="p-6 h-full flex flex-col animate-fadeIn">
                <h2 className="text-2xl font-bold text-white mb-2">질문 투표</h2>
                <p className="text-sm text-gray-400 mb-4">가장 듣고 싶은 질문을 선택하세요!</p>

                <div className="space-y-3 flex-1 overflow-y-auto mb-20">
                    {questionList.map((q) => (
                        <div
                            key={q.index}
                            onClick={() => handleVote(q.index)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all active:scale-[0.98] ${
                                votedIndices.includes(q.index)
                                    ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-900/30'
                                    : 'bg-gray-800 border-gray-700'
                            }`}
                        >
                            <p className="text-white text-lg">{q.question}</p>
                        </div>
                    ))}
                    {questionList.length === 0 && (
                        <div className="text-center text-gray-500 mt-8">
                            <p>질문 목록을 불러오는 중...</p>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleVoteDone}
                    className="fixed bottom-6 w-[calc(100%-3rem)] left-6 bg-green-600 hover:bg-green-500 p-4 rounded-xl font-bold text-white text-lg transition"
                >
                    투표 완료
                </button>
            </div>
        );
    }

    // 3. 답변 중 (리액션 가능)
    if (phase === 'ANSWERING') {
        return (
            <div className="p-6 h-full flex flex-col justify-center items-center gap-8 animate-fadeIn">
                <div className="text-center">
                    <h2 className="text-2xl text-white font-bold mb-2">답변 진행 중...</h2>
                    <p className="text-gray-400">답변자의 반응은 어떤가요?</p>
                </div>

                <div className="grid grid-cols-3 gap-4 w-full">
                    <button onClick={() => sendReaction('FIREWORK')} className="aspect-square bg-gray-800 rounded-2xl text-5xl hover:bg-gray-700 active:scale-95 transition border border-gray-600 flex items-center justify-center">
                        🎉
                    </button>
                    <button onClick={() => sendReaction('BOO')} className="aspect-square bg-gray-800 rounded-2xl text-5xl hover:bg-gray-700 active:scale-95 transition border border-gray-600 flex items-center justify-center">
                        👎
                    </button>
                    <button onClick={() => sendReaction('ANGRY')} className="aspect-square bg-gray-800 rounded-2xl text-5xl hover:bg-gray-700 active:scale-95 transition border border-gray-600 flex items-center justify-center">
                        🤬
                    </button>
                </div>
                <p className="text-xs text-gray-500">버튼을 누르면 화면에 이모티콘이 나타납니다.</p>
            </div>
        );
    }

    // 4. 그 외 대기 화면
    return (
        <div className="h-full flex flex-col items-center justify-center text-center p-6 animate-fadeIn">
            <div className="text-6xl mb-6 opacity-50 grayscale">🧠</div>
            <h2 className="text-xl font-bold text-gray-300 mb-2">진실의 방</h2>
            <p className="text-gray-500">진행자의 안내를 기다려주세요.</p>
        </div>
    );
}
