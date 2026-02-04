import { useState, useEffect } from 'react';
import gameApi from '../services/gameApi';

// 타입 정의
export interface GamePlayer {
    id: number;
    nickname: string;
    color: string;
    currentPosition: number;
    profileImage: string | null;
    deviceId: string;
    submittedCount: number;
    isVoteFinished?: boolean;
}

export default function useJuruHost(
    roomId: string, 
    // 로비에 접속해 있는 플레이어 리스트 (게임 시작 시 초기 데이터로 사용)
    lobbyPlayers: GamePlayer[], 
    eventSource: EventSource | null
) {
    // --- State ---
    const [players, setPlayers] = useState<GamePlayer[]>([]); // 게임 진행 중인 플레이어들
    const [penaltyCount, setPenaltyCount] = useState(0);
    const [expectedPenaltyCount, setExpectedPenaltyCount] = useState(0);
    const [finalPenalties, setFinalPenalties] = useState<{ text: string }[]>([]);
    const [teamCount, setTeamCount] = useState(2);
    const [teamResult, setTeamResult] = useState<Record<string, GamePlayer[]> | null>(null);
    const [currentTurnDeviceId, setCurrentTurnDeviceId] = useState<string | null>(null);

    // ✨ [추가] 팀 배정 방식 선택 상태 ('RANDOM' | 'LADDER' | 'MANUAL')
    const [assignMethod, setAssignMethod] = useState<'RANDOM' | 'LADDER' | 'MANUAL'>('RANDOM');

    // UI State
    const [activePenaltyText, setActivePenaltyText] = useState<string | null>(null);
    const [showDice, setShowDice] = useState(false);
    const [diceValue, setDiceValue] = useState(1);
    const [isRolling, setIsRolling] = useState(false);

    // --- API Helpers ---
    const changePhaseOnly = async (newPhase: string) => {
        try { await gameApi.common.changePhase(roomId, newPhase as any); } catch (e) { console.error(e); }
    };

    // 1. 투표 종료 및 팀 빌딩으로 이동
    const handleFinishVote = async () => {
        if (!confirm("투표를 종료하고 팀 설정으로 넘어갈까요?")) return;
        try {
            await gameApi.marble.finishVote(roomId);
            await changePhaseOnly('TEAM');
        } catch (e) { console.error(e); }
    };

    // ============================================================
    // 👥 [수정됨] 팀 배정 관련 로직 (3가지 모드)
    // ============================================================
    
    // 2-1. [랜덤] 팀 배정
    const handleDivideRandom = async () => {
        try {
            // POST /api/v1/teams/random
            const res = await gameApi.team.divideRandom(roomId, teamCount);
            setTeamResult((res as any).teams);
        } catch (e) { console.error("랜덤 팀 배정 실패", e); }
    };

    // 2-2. [사다리] 팀 배정
    const handleDivideLadder = async () => {
        try {
            // POST /api/v1/teams/ladder
            const res = await gameApi.team.divideLadder(roomId, teamCount);
            setTeamResult((res as any).teams);
        } catch (e) { console.error("사다리타기 실패", e); }
    };

    // 2-3. [수동] 수동 모드 시작 (팀 초기화)
    const handleManualMode = async () => {
        if (!confirm("현재 팀 배정을 초기화하고, 플레이어 선택 모드로 전환할까요?")) return;
        try {
            // POST /api/v1/teams/reset
            await gameApi.team.resetTeams(roomId);
            setTeamResult(null); // 프론트 상태 초기화 -> 플레이어 화면에 선택 버튼 활성화됨
        } catch (e) { console.error("팀 초기화 실패", e); }
    };

    // 2-4. [조회] 현재 팀 상태 불러오기 (수동 선택 시 실시간 현황 확인용)
    const fetchTeamStatus = async () => {
        try {
            const res = await gameApi.team.getTeamStatus(roomId);
            setTeamResult((res as any).teams);
        } catch (e) { console.error("팀 상태 조회 실패", e); }
    };
    // ============================================================


    // 3. 게임 시작 (실제)
    const handleStartGame = async () => {
        try {
            const res = await gameApi.marble.init(roomId);
            setFinalPenalties((res as any).penalties);
            // 로비에 있던 플레이어들을 게임 플레이어로 초기화
            setPlayers(lobbyPlayers); 
            await changePhaseOnly('GAME');
        } catch (e) { console.error(e); }
    };

    // --- SSE Event Listeners ---
    useEffect(() => {
        if (!eventSource) return;

        // 벌칙 제출 카운트 업데이트
        const onPenaltySubmitted = (e: MessageEvent) => {
            const data = JSON.parse(e.data);
            setPenaltyCount(data.totalCount);
            setExpectedPenaltyCount(data.expectedCount);
        };

        // 턴 변경 알림
        const onTurnChange = (e: MessageEvent) => {
            const data = JSON.parse(e.data);
            setCurrentTurnDeviceId(data.currentDeviceId);
        };

        // 🎲 주사위 굴림 & 이동
        const onDiceRolled = (e: MessageEvent) => {
            const data = JSON.parse(e.data); 
            
            setShowDice(true);
            setIsRolling(true);

            setTimeout(() => {
                setIsRolling(false);
                setDiceValue(data.value);
                
                setTimeout(() => {
                    setShowDice(false);
                    setPlayers(prevPlayers => {
                        const roller = prevPlayers.find(p => p.deviceId === data.deviceId);
                        if (!roller) return prevPlayers;

                        let idsToMove: string[] = [data.deviceId];
                        
                        if (teamResult) {
                            for (const members of Object.values(teamResult)) {
                                if (members.some(m => m.deviceId === data.deviceId)) {
                                    idsToMove = members.map(m => m.deviceId);
                                    break;
                                }
                            }
                        }

                        let nextPos = roller.currentPosition + data.value;
                        if (nextPos >= 28) nextPos -= 28;

                        let penaltyText = "";
                        if (nextPos === 0) penaltyText = "출발점 (휴식)";
                        else if (nextPos === 7) penaltyText = "🍺 의리주 채우기!";
                        else if (nextPos === 21) penaltyText = "🤮 의리주 마시기!";
                        else {
                            if (finalPenalties.length > 0) penaltyText = finalPenalties[nextPos % finalPenalties.length].text;
                            else penaltyText = `임시 벌칙 ${nextPos}`;
                        }

                        setActivePenaltyText(penaltyText);
                        setTimeout(() => setActivePenaltyText(null), 3000);

                        return prevPlayers.map(p => {
                            if (idsToMove.includes(p.deviceId)) {
                                return { ...p, currentPosition: nextPos };
                            }
                            return p;
                        });
                    });
                }, 2000);
            }, 1000);
        };

        eventSource.addEventListener('MARBLE_PENALTY_SUBMITTED', onPenaltySubmitted);
        eventSource.addEventListener('MARBLE_TURN_CHANGE', onTurnChange);
        eventSource.addEventListener('MARBLE_DICE_ROLLED', onDiceRolled);

        // 🌟 [추가] 실시간 팀 상태 변경 감지
        const onTeamUpdate = (e: MessageEvent) => {
            const data = JSON.parse(e.data);
            if (data.teams) setTeamResult(data.teams);
        };
        eventSource.addEventListener('TEAM_UPDATE', onTeamUpdate);

        return () => {
            eventSource.removeEventListener('MARBLE_PENALTY_SUBMITTED', onPenaltySubmitted);
            eventSource.removeEventListener('MARBLE_TURN_CHANGE', onTurnChange);
            eventSource.removeEventListener('MARBLE_DICE_ROLLED', onDiceRolled);
            eventSource.removeEventListener('TEAM_UPDATE', onTeamUpdate);
        };
    }, [eventSource, finalPenalties, teamResult]); 

    
    // ============================================================
    // 🛠️ [TEST MODE] 개발자용 테스트 함수들
    // ============================================================
    const handleTestStart = () => {
        // 가짜 플레이어 8명 생성
        const dummyPlayers = Array.from({ length: 8 }).map((_, i) => ({
            id: i,
            nickname: `테스터${i + 1}`,
            color: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#1A535C', '#FF9F43'][i % 5],
            currentPosition: 0,
            profileImage: null,
            deviceId: `test_device_${i}`,
            submittedCount: 2
        }));
        setPlayers(dummyPlayers);

        // 가짜 벌칙 생성
        const dummyPenalties = Array(30).fill(null).map((_, i) => ({ text: `테스트 벌칙 ${i+1}: 의리주 마시기` }));
        setFinalPenalties(dummyPenalties);
        
        console.log("✅ [TEST] 가짜 플레이어 & 벌칙 생성 완료");
    };

    // 🌟 [추가] 가짜 팀 배정 시뮬레이션
    const handleTestTeamBuilding = (method: 'RANDOM' | 'LADDER' | 'MANUAL') => {
        if (players.length === 0) {
            alert("먼저 '1. 가짜 참가자 생성' 버튼을 눌러주세요!");
            return;
        }

        console.log(`✅ [TEST] 팀 배정 시뮬레이션 시작: ${method}`);

        if (method === 'MANUAL') {
            // 수동: 팀을 싹 비워서 초기화 상태로 만듦
            setTeamResult(null);
            console.log("-> 팀 초기화 완료 (수동 모드)");
        } else {
            // 랜덤/사다리: 그냥 무작위로 섞어서 팀 갯수만큼 나눔
            const shuffled = [...players].sort(() => Math.random() - 0.5);
            const teams: Record<string, GamePlayer[]> = {};
            const teamNames = ['A팀', 'B팀', 'C팀', 'D팀', 'E팀'];

            // 팀 초기화
            for (let i = 0; i < teamCount; i++) {
                // 팀 개수가 너무 많으면 에러나니까 안전장치
                const name = teamNames[i] || `${String.fromCharCode(65+i)}팀`;
                teams[name] = [];
            }

            // 플레이어 분배 (index % teamCount)
            shuffled.forEach((p, idx) => {
                const teamIndex = idx % teamCount;
                const teamName = Object.keys(teams)[teamIndex];
                teams[teamName].push(p);
            });

            setTeamResult(teams);
            console.log("-> 가짜 팀 배정 완료:", teams);
        }
    };

    const handleTestDice = () => {
        if (isRolling) return;
        const testValue = Math.floor(Math.random() * 6) + 1; 
        const targetDeviceId = currentTurnDeviceId || 'test_device_0'; // 테스트용 ID로 수정
        const mockEventData = { value: testValue, deviceId: targetDeviceId };
        
        setShowDice(true);
        setIsRolling(true);

        setTimeout(() => {
            setIsRolling(false);
            setDiceValue(mockEventData.value);
            
            setTimeout(() => {
                setShowDice(false);
                setPlayers(prevPlayers => {
                    const roller = prevPlayers.find(p => p.deviceId === targetDeviceId);
                    if (!roller) return prevPlayers;

                    let teamMemberIds: string[] = [targetDeviceId];
                    if (teamResult) {
                        for (const members of Object.values(teamResult)) {
                            if (members.some(m => m.deviceId === targetDeviceId)) {
                                teamMemberIds = members.map(m => m.deviceId);
                                break;
                            }
                        }
                    }

                    let nextPos = roller.currentPosition + mockEventData.value;
                    if (nextPos >= 28) nextPos -= 28;

                    let penaltyText = "";
                    if (nextPos === 0) penaltyText = "출발점 (휴식)";
                    else if (nextPos === 7) penaltyText = "🍺 의리주 채우기!";
                    else if (nextPos === 21) penaltyText = "🤮 의리주 마시기!";
                    else {
                        if (finalPenalties.length > 0) penaltyText = finalPenalties[nextPos % finalPenalties.length].text;
                        else penaltyText = `임시 벌칙 ${nextPos}`;
                    }

                    setActivePenaltyText(penaltyText);
                    setTimeout(() => setActivePenaltyText(null), 3000);

                    return prevPlayers.map(p => {
                        if (teamMemberIds.includes(p.deviceId)) return { ...p, currentPosition: nextPos };
                        return p;
                    });
                });

                // 턴 넘기기 시뮬레이션
                const currentIdx = players.findIndex(p => p.deviceId === targetDeviceId);
                const nextIdx = (currentIdx + 1) % players.length;
                setCurrentTurnDeviceId(players[nextIdx]?.deviceId || 'test_device_0');

            }, 2000);
        }, 1000);
    };

    // ✨ [핵심] 보드판에 넘겨줄 '대표 말' 계산
    const boardPieces = teamResult 
        ? Object.entries(teamResult).map(([teamName, members]) => {
            const representative = players.find(p => p.deviceId === members[0].deviceId);
            if (!representative) return null;
            return { ...representative, nickname: teamName };
        }).filter(p => p !== null) as GamePlayer[]
        : players;

    return {
        // State
        players, 
        setPlayers, 
        penaltyCount,
        expectedPenaltyCount,
        finalPenalties,
        teamCount, setTeamCount,
        teamResult,
        currentTurnDeviceId,
        activePenaltyText,
        showDice,
        diceValue,
        isRolling,
        boardPieces,
        
        // ✨ [추가] 배정 방식 상태 및 설정 함수
        assignMethod,
        setAssignMethod,

        // Handlers
        handleFinishVote,
        
        // 🌟 수정된 3가지 배정 방식 핸들러
        handleDivideRandom, 
        handleDivideLadder, 
        handleManualMode,   
        fetchTeamStatus,    

        handleStartGame,

        // Test Handlers
        testHandlers: {
            handleTestStart,
            handleTestDice,
            handleTestTeamBuilding 
        }
    };
}