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
    const [finalPenalties, setFinalPenalties] = useState<{ text: string }[]>([]);
    const [teamCount, setTeamCount] = useState(2);
    const [teamResult, setTeamResult] = useState<Record<string, GamePlayer[]> | null>(null);
    const [currentTurnDeviceId, setCurrentTurnDeviceId] = useState<string | null>(null);

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

    // 2. 팀 랜덤 섞기
    const handleDivideTeams = async () => {
        try {
            const res = await gameApi.team.divideRandom(roomId, teamCount);
            setTeamResult(res.teams);
        } catch (e) { console.error(e); }
    };

    // 3. 게임 시작 (실제)
    const handleStartGame = async () => {
        try {
            const res = await gameApi.marble.init(roomId);
            setFinalPenalties(res.penalties);
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
            setPenaltyCount(data.count);
        };

        // 턴 변경 알림
        const onTurnChange = (e: MessageEvent) => {
            const data = JSON.parse(e.data);
            setCurrentTurnDeviceId(data.currentDeviceId);
        };

        // 🎲 주사위 굴림 & 이동 (핵심 로직)
        const onDiceRolled = (e: MessageEvent) => {
            const data = JSON.parse(e.data); // { value: 5, deviceId: "..." }
            
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

                        // ✨ 팀원 찾기 (같이 이동하기 위해)
                        let idsToMove: string[] = [data.deviceId];
                        
                        // teamResult 상태를 참조하여 같은 팀원 ID 찾기
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

                        // 벌칙 텍스트 설정
                        let penaltyText = "";
                        if (nextPos === 0) penaltyText = "출발점 (휴식)";
                        else if (nextPos === 7) penaltyText = "🍺 의리주 채우기!";
                        else if (nextPos === 21) penaltyText = "🤮 의리주 원샷!";
                        else {
                            if (finalPenalties.length > 0) {
                                penaltyText = finalPenalties[nextPos % finalPenalties.length].text;
                            } else {
                                penaltyText = "벌칙 내용 없음";
                            }
                        }

                        setActivePenaltyText(penaltyText);
                        setTimeout(() => setActivePenaltyText(null), 3000);

                        // ✨ 팀원 전체 이동
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

        return () => {
            eventSource.removeEventListener('MARBLE_PENALTY_SUBMITTED', onPenaltySubmitted);
            eventSource.removeEventListener('MARBLE_TURN_CHANGE', onTurnChange);
            eventSource.removeEventListener('MARBLE_DICE_ROLLED', onDiceRolled);
        };
    }, [eventSource, finalPenalties, teamResult]); 

    
    // ============================================================
    // 🛠️ [TEST MODE] 개발자용 테스트 함수들
    // ============================================================
    const handleTestStart = () => {
        // ✨ 팀별로 색상 통일! (1팀: 빨강, 2팀: 파랑)
        const dummyPlayers: GamePlayer[] = [
            { id: 0, nickname: '철수', color: '#FF6B6B', currentPosition: 0, profileImage: null, deviceId: 'd1', submittedCount: 2 },
            { id: 1, nickname: '영희', color: '#FF6B6B', currentPosition: 0, profileImage: null, deviceId: 'd2', submittedCount: 2 },
            { id: 2, nickname: '민수', color: '#4ECDC4', currentPosition: 0, profileImage: null, deviceId: 'd3', submittedCount: 2 },
            { id: 3, nickname: '지수', color: '#4ECDC4', currentPosition: 0, profileImage: null, deviceId: 'd4', submittedCount: 2 },
        ];
        setPlayers(dummyPlayers);

        const dummyPenalties = Array(30).fill(null).map((_, i) => ({ text: `테스트 벌칙 ${i+1}: 의리주 마시기` }));
        setFinalPenalties(dummyPenalties);

        setTeamResult({
            '1팀': [dummyPlayers[0], dummyPlayers[1]],
            '2팀': [dummyPlayers[2], dummyPlayers[3]],
        });

        setCurrentTurnDeviceId('d1'); 
    };

    const handleTestDice = () => {
        if (isRolling) return;
        const testValue = Math.floor(Math.random() * 6) + 1; 
        const targetDeviceId = currentTurnDeviceId || 'd1';
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
                    else if (nextPos === 21) penaltyText = "🤮 의리주 원샷!";
                    else {
                        if (finalPenalties.length > 0) penaltyText = finalPenalties[nextPos % finalPenalties.length].text;
                        else penaltyText = `임시 벌칙 ${nextPos}`;
                    }

                    setActivePenaltyText(penaltyText);
                    setTimeout(() => setActivePenaltyText(null), 3000);

                    // ✨ 같은 팀원이면 모두 다 같이 이동!
                    return prevPlayers.map(p => {
                        if (teamMemberIds.includes(p.deviceId)) return { ...p, currentPosition: nextPos };
                        return p;
                    });
                });

                // 턴 넘기기 (철수 -> 민수 -> 영희 -> 지수 -> 철수)
                let nextId = 'd1';
                if (targetDeviceId === 'd1') nextId = 'd3';       
                else if (targetDeviceId === 'd3') nextId = 'd2';  
                else if (targetDeviceId === 'd2') nextId = 'd4';  
                else if (targetDeviceId === 'd4') nextId = 'd1';  
                setCurrentTurnDeviceId(nextId);

            }, 2000);
        }, 1000);
    };

    // ✨ [핵심] 보드판에 넘겨줄 '대표 말' 계산 (팀당 1개)
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
        finalPenalties,
        teamCount, setTeamCount,
        teamResult,
        currentTurnDeviceId,
        activePenaltyText,
        showDice,
        diceValue,
        isRolling,
        boardPieces, // 계산된 대표 말 리스트

        // Handlers
        handleFinishVote,
        handleDivideTeams,
        handleStartGame,

        // Test Handlers
        testHandlers: {
            handleTestStart,
            handleTestDice
        }
    };
}