import { useState, useEffect } from 'react';
import { MafiaPlayer, MafiaPhase } from '../types/mafia';
import gameApi from '../services/gameApi';

export default function useMafiaHost(roomId: string, players: any[], eventSource: EventSource | null) {
    const [phase, setPhase] = useState<MafiaPhase>('NIGHT');
    const [timer, setTimer] = useState(0);
    const [systemMessage, setSystemMessage] = useState("게임 시작 대기 중...");
    const [mafiaPlayers, setMafiaPlayers] = useState<MafiaPlayer[]>([]);
    
    // 실시간 투표 현황 (지목 투표)
    const [voteStatus, setVoteStatus] = useState<Record<string, number>>({}); 
    
    // 🌟 [추가] 찬반 투표 현황 (찬성 vs 반대)
    const [finalVoteStatus, setFinalVoteStatus] = useState<{ agree: number; disagree: number }>({ agree: 0, disagree: 0 });

    const [winner, setWinner] = useState<'MAFIA' | 'CITIZEN' | null>(null);

    // 실제 게임 시작
    const startGame = async () => {
        try {
            await gameApi.mafia.init(roomId);
            setMafiaPlayers(players.map((p: any) => ({ 
                deviceId: p.deviceId, 
                nickname: p.nickname, 
                isAlive: true, 
                profileImage: p.profileImage 
            })));
            setPhase('NIGHT');
            setSystemMessage("밤이 되었습니다. 마피아는 고개를 들어주세요.");
            setWinner(null);
            setVoteStatus({});
            setFinalVoteStatus({ agree: 0, disagree: 0 });
        } catch (e) { console.error(e); }
    };

    // SSE 이벤트 리스너
    useEffect(() => {
        if (!eventSource) return;

        // 1. 타이머
        eventSource.addEventListener('MAFIA_TIMER', (e: any) => {
            const data = JSON.parse(e.data);
            setTimer(data.timer);
        });

        // 2. 밤
        eventSource.addEventListener('MAFIA_NIGHT', () => {
            setPhase('NIGHT');
            setSystemMessage("밤이 되었습니다. 마피아는 고개를 들어주세요.");
            setVoteStatus({});
            setFinalVoteStatus({ agree: 0, disagree: 0 });
        });

        // 3. 낮 (밤 결과 발표)
        eventSource.addEventListener('MAFIA_DAY_ANNOUNCEMENT', (e: any) => {
            const data = JSON.parse(e.data);
            setPhase('DAY_ANNOUNCEMENT');
            if (data.deadPlayer) {
                setSystemMessage(`간밤에 ${data.deadPlayer}님이 살해당했습니다.`);
                setMafiaPlayers(prev => prev.map(p => 
                    p.nickname === data.deadPlayer ? { ...p, isAlive: false } : p
                ));
            } else {
                setSystemMessage("간밤에 아무도 죽지 않았습니다.");
            }
        });

        // 4. 투표 시작
        eventSource.addEventListener('MAFIA_VOTE_START', () => {
            setPhase('VOTE');
            setSystemMessage("투표를 시작합니다. 의심가는 사람을 선택하세요.");
            setVoteStatus({});
        });

        // 5. 실시간 투표 현황 업데이트
        eventSource.addEventListener('MAFIA_VOTE_UPDATE', (e: any) => {
            const data = JSON.parse(e.data); 
            setVoteStatus(data.votes); 
        });

        // 🌟 6. 투표 결과 (누가 지목되었는지)
        eventSource.addEventListener('MAFIA_VOTE_RESULT', (e: any) => {
            const data = JSON.parse(e.data);
            setPhase('VOTE_RESULT');
            if (data.target) {
                setSystemMessage(`투표 결과, ${data.target}님이 지목되었습니다.`);
            } else {
                setSystemMessage("투표 결과, 아무도 지목되지 않았습니다.");
            }
        });

        // 🌟 7. 최후의 변론
        eventSource.addEventListener('MAFIA_FINAL_DEFENSE', () => {
            setPhase('FINAL_DEFENSE');
            setSystemMessage("최후의 변론 시간입니다. 억울함을 호소하세요!");
        });

        // 🌟 8. 찬반 투표 시작
        eventSource.addEventListener('MAFIA_FINAL_VOTE_START', () => {
            setPhase('FINAL_VOTE');
            setSystemMessage("변론이 끝났습니다. 찬성/반대 투표를 진행합니다.");
            setFinalVoteStatus({ agree: 0, disagree: 0 });
        });

        // 🌟 9. 찬반 투표 현황 업데이트
        eventSource.addEventListener('MAFIA_FINAL_VOTE_UPDATE', (e: any) => {
            const data = JSON.parse(e.data);
            // 백엔드에서 { agree: 3, disagree: 2 } 형태로 온다고 가정
            setFinalVoteStatus({ agree: data.agree, disagree: data.disagree });
        });

        // 🌟 10. 찬반 투표 결과 (처형 여부)
        eventSource.addEventListener('MAFIA_FINAL_VOTE_RESULT', (e: any) => {
            const data = JSON.parse(e.data);
            setPhase('FINAL_VOTE_RESULT');
            
            if (data.isExecuted) {
                setSystemMessage(`찬성 다수로 ${data.deadPlayer}님이 처형되었습니다.`);
                // 사망자 처리
                setMafiaPlayers(prev => prev.map(p => 
                    p.nickname === data.deadPlayer ? { ...p, isAlive: false } : p
                ));
            } else {
                setSystemMessage("반대 다수로 처형되지 않았습니다.");
            }
        });

        // 11. 게임 종료
        eventSource.addEventListener('MAFIA_GAME_END', (e: any) => {
            const data = JSON.parse(e.data); 
            setPhase('END');
            setWinner(data.winner);
            setSystemMessage(data.winner === 'CITIZEN' ? "시민들이 승리했습니다! 🎉" : "마피아의 승리입니다! 😈");
        });

    }, [eventSource]);


    // ============================================================
    // 🛠️ [TEST MODE] 개발자용 테스트 함수들
    // ============================================================
    const handleTestStart = () => {
        console.log("🕵️ 마피아 테스트 모드 시작!");
        const dummies: MafiaPlayer[] = [
            { deviceId: 'd1', nickname: '철수 (마피아)', isAlive: true, role: 'MAFIA' },
            { deviceId: 'd2', nickname: '영희 (의사)', isAlive: true, role: 'DOCTOR' },
            { deviceId: 'd3', nickname: '민수 (경찰)', isAlive: true, role: 'POLICE' },
            { deviceId: 'd4', nickname: '지수 (시민)', isAlive: true, role: 'CIVILIAN' },
            { deviceId: 'd5', nickname: '길동 (시민)', isAlive: true, role: 'CIVILIAN' },
        ];
        setMafiaPlayers(dummies);
        setPhase('NIGHT');
        setSystemMessage("[TEST] 밤이 되었습니다.");
    };

    const handleTestNextPhase = () => {
        // 순환: NIGHT -> DAY -> VOTE -> DEFENSE -> FINAL -> NIGHT
        if (phase === 'NIGHT') {
            setPhase('DAY_ANNOUNCEMENT'); setSystemMessage("[TEST] 낮이 되었습니다.");
        } else if (phase === 'DAY_ANNOUNCEMENT') {
            setPhase('VOTE'); setSystemMessage("[TEST] 투표 시간입니다.");
        } else if (phase === 'VOTE') {
            setPhase('FINAL_DEFENSE'); setSystemMessage("[TEST] 최후의 변론!");
        } else if (phase === 'FINAL_DEFENSE') {
            setPhase('FINAL_VOTE'); setSystemMessage("[TEST] 찬반 투표 시작");
        } else {
            setPhase('NIGHT'); setSystemMessage("[TEST] 다시 밤이 되었습니다.");
            setFinalVoteStatus({ agree: 0, disagree: 0 });
        }
    };

    const handleTestKillRandom = () => {
        const survivors = mafiaPlayers.filter(p => p.isAlive);
        if (survivors.length === 0) return;
        const victim = survivors[Math.floor(Math.random() * survivors.length)];
        setMafiaPlayers(prev => prev.map(p => p.deviceId === victim.deviceId ? { ...p, isAlive: false } : p));
        setSystemMessage(`[TEST] ${victim.nickname}님이 처형되었습니다 💀`);
    };

    return {
        phase,
        timer,
        systemMessage,
        mafiaPlayers,
        voteStatus,
        finalVoteStatus, 
        winner, 
        startGame, 
        testHandlers: { handleTestStart, handleTestNextPhase, handleTestKillRandom }
    };
}