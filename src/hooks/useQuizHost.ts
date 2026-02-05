import { useState, useEffect, useCallback, useRef } from 'react';
import gameApi from '../services/gameApi';
import { QuizCategory, QuizPhase, QuizState } from '../types/quiz';

export default function useQuizHost(roomId: string, eventSource: EventSource | null) {
    const [phase, setPhase] = useState<QuizPhase>('TEAM_SETUP');
    const [teamCount, setTeamCount] = useState(2);

    const handleTeamCountChange = (delta: number) => {
        setTeamCount(prev => Math.max(2, Math.min(10, prev + delta)));
    };

    const handleConfirmTeam = async () => {
        try {
            // 팀 나누기 API 호출 (랜덤)
            await gameApi.team.divideRandom(roomId, teamCount);
            // 그 다음 게임 초기화 (기존 WAITING으로 진입)
            await gameApi.quiz.init(roomId);
            setPhase('WAITING');
        } catch (e) {
            console.error(e);
            alert("팀 설정 실패 (테스트 모드 진입)");
            setPhase('WAITING');
        }
    };
    const [categories, setCategories] = useState<QuizCategory[]>([]);
    const [gameState, setGameState] = useState<QuizState>({
        currentWord: null,
        remainingSeconds: 60,
        score: {},
        currentTeam: null
    });
    const [ranking, setRanking] = useState<Record<string, number> | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // ============================================================
    // 🛠️ [TEST LOGIC] 서버가 없을 때 대신 실행될 가짜 로직들
    // ============================================================
    const runTestInit = () => {
        console.log("⚠️ API 실패 -> 테스트 데이터 로드 (Init)");
        setCategories([
            { id: 1, name: '🎬 영화 명대사 (Test)' },
            { id: 2, name: '🦁 동물 흉내 (Test)' },
            { id: 3, name: '💃 K-POP 댄스 (Test)' },
            { id: 4, name: '🤬 속담 매운맛 (Test)' },
        ]);
        setPhase('WAITING');
    };

    const runTestStartRound = (catId: number) => {
        console.log(`⚠️ API 실패 -> 테스트 라운드 시작 (Cat: ${catId})`);

        // 기존에 돌아가던 타이머가 있으면 끄기 
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        setPhase('PLAYING');
        setGameState(prev => ({
            ...prev,
            currentWord: '티라노사우루스',
            remainingSeconds: 60,
            currentTeam: 'A'
        }));

        // 가짜 타이머 로직
        let count = 60;

        // 타이머 ID를 ref에 저장해둬야 나중에 끌 수 있음
        timerRef.current = setInterval(() => {
            count--;
            setGameState(prev => ({ ...prev, remainingSeconds: count }));

            if (count <= 0) {
                // 끝날 때도 깔끔하게 ref 사용하여 끄기
                if (timerRef.current) clearInterval(timerRef.current);
            }
        }, 1000);
    };

    const runTestNextTeam = () => {
        console.log("⚠️ API 실패 -> 다음 팀 (Test)");
        setGameState(prev => ({
            ...prev,
            currentTeam: prev.currentTeam === 'A' ? 'B' : 'A',
            remainingSeconds: 60,
            currentWord: '준비 중...'
        }));
        setPhase('WAITING');
    };

    const runTestEndGame = () => {
        console.log("⚠️ API 실패 -> 게임 종료 (Test Result)");
        setPhase('FINISHED');
        setRanking({ "A": 5, "B": 3 });
    };

    // ============================================================
    // 🌐 [REAL LOGIC] 실제 API 호출 (실패 시 위 테스트 로직 실행)
    // ============================================================

    // 1. 초기화 (카테고리만 불러오고 TEAM_SETUP 유지)
    const initGame = async () => {
        try {
            const catRes = await gameApi.quiz.getCategories();
            // 백엔드가 categoryId로 보내므로 id로 매핑
            const mapped = (catRes.data || []).map((c: any) => ({
                id: c.categoryId ?? c.id,
                name: c.name
            }));
            setCategories(mapped);
            // quiz.init은 handleConfirmTeam에서 팀 설정 후 호출
            setPhase('TEAM_SETUP');
        } catch (e) {
            runTestInit();
        }
    };

    // 2. 라운드 시작
    const startRound = async (categoryId: number) => {
        try {
            await gameApi.quiz.startRound(roomId, categoryId);
        } catch (e) {
            runTestStartRound(categoryId);
        }
    };

    // 3. 다음 팀
    const handleNextTeam = async () => {
        try {
            await gameApi.quiz.nextTeam(roomId);
        } catch (e) {
            runTestNextTeam();
        }
    };

    // 4. 최종 결과 보기 (랭킹 조회)
    const handleEndGame = async () => {
        try {
            const res = await gameApi.quiz.getRanking(roomId);
            // SSE QUIZ_FINAL_RANKING 이벤트가 ranking과 phase를 세팅함
        } catch (e) {
            runTestEndGame();
        }
    };

    // --- SSE Event Listeners ---
    useEffect(() => {
        if (!eventSource) return;

        // 게임 초기화 시 팀 목록으로 점수 초기화
        eventSource.addEventListener('QUIZ_INIT', (e: any) => {
            const data = JSON.parse(e.data);
            if (data.teams) {
                const initialScore: Record<string, number> = {};
                data.teams.forEach((t: string) => { initialScore[t] = 0; });
                setGameState(prev => ({ ...prev, score: initialScore, currentTeam: data.currentTeam }));
            }
        });

        eventSource.addEventListener('QUIZ_TIMER', (e: any) => {
            const data = JSON.parse(e.data);
            setGameState(prev => ({
                ...prev,
                remainingSeconds: data.remaining,
                currentWord: data.currentWord || prev.currentWord,
                score: { ...prev.score, ...(prev.currentTeam ? { [prev.currentTeam]: data.currentScore } : {}) }
            }));
        });

        eventSource.addEventListener('QUIZ_ROUND_START', (e: any) => {
            const data = JSON.parse(e.data);
            setGameState(prev => ({
                ...prev,
                currentWord: data.currentWord,
                currentTeam: data.team,
                remainingSeconds: data.timer,
                score: { ...prev.score }
            }));
            setPhase('PLAYING');
        });

        eventSource.addEventListener('QUIZ_CORRECT', (e: any) => {
            const data = JSON.parse(e.data);
            setGameState(prev => ({
                ...prev,
                currentWord: data.currentWord,
                score: { ...prev.score, ...(data.team ? { [data.team]: data.currentScore } : {}) }
            }));
        });

        eventSource.addEventListener('QUIZ_PASS', (e: any) => {
            const data = JSON.parse(e.data);
            setGameState(prev => ({
                ...prev,
                currentWord: data.currentWord
            }));
        });

        eventSource.addEventListener('QUIZ_ROUND_END', (e: any) => {
            const data = e.data ? JSON.parse(e.data) : {};
            if (data.allScores) {
                setGameState(prev => ({ ...prev, score: data.allScores }));
            }
            setPhase('ROUND_END');
        });

        // 다음 팀 → 카테고리 선택으로 돌아감
        eventSource.addEventListener('QUIZ_NEXT_TEAM', (e: any) => {
            const data = JSON.parse(e.data);
            if (data.allScores) {
                setGameState(prev => ({ ...prev, score: data.allScores, currentTeam: data.nextTeam }));
            }
            setPhase('WAITING');
        });

        // 최종 랭킹
        eventSource.addEventListener('QUIZ_FINAL_RANKING', (e: any) => {
            const data = JSON.parse(e.data);
            if (data.ranking) {
                const rankMap: Record<string, number> = {};
                data.ranking.forEach((r: any) => { rankMap[r.team] = r.score; });
                setRanking(rankMap);
            }
            setPhase('FINISHED');
        });

        eventSource.addEventListener('QUIZ_STATE_UPDATE', (e: any) => {
            const data = JSON.parse(e.data);
            if (data.phase) setPhase(data.phase);
            if (data.currentTeam) setGameState(prev => ({ ...prev, currentTeam: data.currentTeam }));
            if (data.score) setGameState(prev => ({ ...prev, score: data.score }));
        });

    }, [eventSource, roomId]);

    return {
        phase,
        categories,
        gameState,
        ranking,
        teamCount,
        actions: {
            initGame,
            startRound,
            handleNextTeam,
            handleEndGame
        },
        testHandlers: {
            handleTestInit: runTestInit,
            handleTestStartRound: runTestStartRound,
            handleTestNextTeam: runTestNextTeam,
            handleTestEndGame: runTestEndGame,
            handleTeamCountChange,
            handleConfirmTeam
        }
    };
}