import { useState, useEffect } from 'react';
import { TruthPhase, TruthAnswerer, TruthQuestion, FaceAnalysisData } from '../types/truth';
import gameApi from '../services/gameApi';

export default function useTruthHost(roomId: string, players: any[], eventSource: EventSource | null) {
    const [phase, setPhase] = useState<TruthPhase>('SELECT_ANSWERER');
    const [answerer, setAnswerer] = useState<TruthAnswerer | null>(null);
    const [questionCount, setQuestionCount] = useState(0);
    const [currentQuestion, setCurrentQuestion] = useState<TruthQuestion | null>(null);
    const [result, setResult] = useState<FaceAnalysisData | null>(null);
    
    // 투표 상태
    const [voteDoneCount, setVoteDoneCount] = useState(0);
    const [totalVoters, setTotalVoters] = useState(0);

    // 실시간 얼굴 분석 데이터 (HUD 표시용)
    const [realtimeFace, setRealtimeFace] = useState<FaceAnalysisData>({
        eyeBlinkRate: 0, eyeMovement: 0, facialTremor: 0, nostrilMovement: 0, stressLevel: 0, isLie: false
    });

    // --- [Real API Handlers] ---
    const startGame = async () => {
        try {
            await gameApi.truth.init(roomId);
            setPhase('SELECT_ANSWERER');
        } catch (e) { console.error(e); }
    };

    const handleSelectRandom = async () => {
        try { await gameApi.truth.selectAnswererRandom(roomId); } catch (e) { console.error(e); }
    };

    const handleSelectAnswerer = async (deviceId: string) => {
        try { await gameApi.truth.selectAnswerer(roomId, deviceId); } catch (e) { console.error(e); }
    };

    const handleFinishSubmit = async () => {
        try { await gameApi.truth.finishQuestionSubmit(roomId); } catch (e) { console.error(e); }
    };

    const handleSelectQuestion = async () => {
        try { await gameApi.truth.selectQuestion(roomId); } catch (e) { console.error(e); }
    };

    const handleConfirmQuestion = async () => {
        if (!currentQuestion) return;
        try { await gameApi.truth.confirmQuestion(roomId); } catch (e) { console.error(e); }
    };

    const handleFinishQuestionVote = async () => {
        try { await gameApi.truth.finishQuestionVote(roomId); } catch (e) { console.error(e); }
    };

    const handleFinishAnswering = async () => {
        try { await gameApi.truth.finishAnswering(roomId); } catch (e) { console.error(e); }
    };

    const handleNextRound = async () => {
        try { await gameApi.truth.nextRound(roomId); } catch (e) { console.error(e); }
    };

    // --- [SSE Listeners] ---
    useEffect(() => {
        if (!eventSource) return;

        eventSource.addEventListener('TRUTH_PHASE_CHANGE', (e: any) => {
            const data = JSON.parse(e.data);
            setPhase(data.phase);
        });

        eventSource.addEventListener('TRUTH_ANSWERER_SELECTED', (e: any) => {
            const data = JSON.parse(e.data);
            setAnswerer(data.answerer);
            if (data.phase) setPhase(data.phase);
        });

        eventSource.addEventListener('TRUTH_QUESTION_SUBMITTED', (e: any) => {
            const data = JSON.parse(e.data);
            setQuestionCount(data.questionCount);
        });

        eventSource.addEventListener('TRUTH_QUESTION_COUNT', (e: any) => {
            const data = JSON.parse(e.data);
            setQuestionCount(data.count);
        });

        eventSource.addEventListener('TRUTH_QUESTIONS_READY', (e: any) => {
            const data = JSON.parse(e.data);
            if (data.phase) setPhase(data.phase);
            setVoteDoneCount(0);
            setTotalVoters(0);
        });

        eventSource.addEventListener('TRUTH_QUESTION_VOTE_DONE', (e: any) => {
            const data = JSON.parse(e.data);
            setVoteDoneCount(data.doneCount);
            setTotalVoters(data.totalPlayers);
        });

        eventSource.addEventListener('TRUTH_QUESTION_SELECTED', (e: any) => {
            const data = JSON.parse(e.data);
            setCurrentQuestion(data.question);
        });

        eventSource.addEventListener('TRUTH_START_ANSWERING', (e: any) => {
            const data = JSON.parse(e.data);
            if (data.phase) setPhase(data.phase);
            if (data.question) {
                setCurrentQuestion({ id: 0, content: data.question });
            }
        });

        eventSource.addEventListener('TRUTH_RESULT', (e: any) => {
            const data = JSON.parse(e.data);
            if (data.phase) setPhase(data.phase);
            setResult(data.result);
        });

        eventSource.addEventListener('TRUTH_NEXT_ROUND', (e: any) => {
            const data = JSON.parse(e.data);
            if (data.phase) setPhase(data.phase);
            setAnswerer(null);
            setCurrentQuestion(null);
            setResult(null);
            setQuestionCount(0);
            setVoteDoneCount(0);
            setTotalVoters(0);
        });

    }, [eventSource]);

    // ============================================================
    // 🛠️ [TEST MODE] 진실게임 개발자 테스트 함수들 (NEW!)
    // ============================================================
    const handleTestSelectRandom = () => {
        // 가짜 답변자 선정
        const dummyAnswerer = {
            deviceId: 'test_user_1',
            nickname: '테스트 답변자',
            profileImage: null
        };
        setAnswerer(dummyAnswerer);
        setPhase('SELECT_ANSWERER');
        console.log("✅ [TEST] 답변자 선정 완료");
    };

    const handleTestSelectQuestion = () => {
        // 가짜 질문 선정
        const dummyQuestion = {
            id: 1,
            content: "솔직히 지금 집에 가고 싶습니까?"
        };
        setCurrentQuestion(dummyQuestion);
        setPhase('SELECT_QUESTION');
        console.log("✅ [TEST] 질문 선정 완료");
    };

    const handleTestConfirmQuestion = () => {
        // 질문 확정 -> 답변 시작 (HUD ON)
        if (!currentQuestion) {
            handleTestSelectQuestion(); // 질문 없으면 강제 선정
        }
        setPhase('ANSWERING');
        console.log("✅ [TEST] HUD 가동 시작 (ANSWERING)");
    };

    const handleTestFinishAnswering = () => {
        // 답변 종료 -> 결과 발표
        const dummyResult = {
            eyeBlinkRate: 20,
            eyeMovement: 0.8,
            facialTremor: 0.1,
            nostrilMovement: 0.5,
            stressLevel: 88,
            isLie: true
        };
        setResult(dummyResult);
        setPhase('RESULT');
        console.log("✅ [TEST] 결과 발표 (RESULT)");
    };

    const handleTestNextRound = () => {
        setPhase('SELECT_ANSWERER');
        setAnswerer(null);
        setCurrentQuestion(null);
        setResult(null);
        console.log("✅ [TEST] 다음 라운드 준비");
    };

    return {
        phase,
        answerer,
        questionCount,
        currentQuestion,
        result,
        realtimeFace,
        setRealtimeFace,
        voteDoneCount,
        totalVoters,

        startGame,
        handleSelectRandom,
        handleSelectAnswerer,
        handleFinishSubmit,
        handleSelectQuestion,
        handleConfirmQuestion,
        handleFinishQuestionVote,
        handleFinishAnswering,
        handleNextRound,

        // 테스트 핸들러
        testHandlers: {
            handleTestSelectRandom,
            handleTestSelectQuestion,
            handleTestConfirmQuestion,
            handleTestFinishAnswering,
            handleTestNextRound
        }
    };
}