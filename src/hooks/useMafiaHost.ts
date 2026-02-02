import { useState, useEffect } from 'react';
import { MafiaPlayer, MafiaPhase } from '../types/mafia';
import gameApi from '../services/gameApi';

export default function useMafiaHost(roomId: string, players: any[], eventSource: EventSource | null) {
    const [phase, setPhase] = useState<MafiaPhase>('NIGHT');
    const [timer, setTimer] = useState(0);
    const [systemMessage, setSystemMessage] = useState("게임 시작 대기 중...");
    const [mafiaPlayers, setMafiaPlayers] = useState<MafiaPlayer[]>([]);
    
    // 실시간 투표 현황 & 승리자 정보
    const [voteStatus, setVoteStatus] = useState<Record<string, number>>({}); 
    const [winner, setWinner] = useState<'MAFIA' | 'CITIZEN' | null>(null);

    // 실제 게임 시작
    const startGame = async () => {
        try {
            await gameApi.mafia.init(roomId);
            setMafiaPlayers(players.map(p => ({ 
                deviceId: p.deviceId, 
                nickname: p.nickname, 
                isAlive: true,
                profileImage: p.profileImage 
            })));
            setPhase('NIGHT');
            setSystemMessage("밤이 되었습니다. 마피아는 고개를 들어주세요.");
            setWinner(null);
            setVoteStatus({});
        } catch (e) { console.error(e); }
    };

    // SSE 이벤트 리스너
    useEffect(() => {
        if (!eventSource) return;

        eventSource.addEventListener('MAFIA_TIMER', (e: any) => {
            const data = JSON.parse(e.data);
            setTimer(data.timer);
        });

        eventSource.addEventListener('MAFIA_NIGHT', () => {
            setPhase('NIGHT');
            setSystemMessage("밤이 되었습니다. 마피아는 고개를 들어주세요.");
            setVoteStatus({});
        });

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

        eventSource.addEventListener('MAFIA_VOTE_START', () => {
            setPhase('VOTE');
            setSystemMessage("투표를 시작합니다. 의심가는 사람을 선택하세요.");
            setVoteStatus({});
        });

        eventSource.addEventListener('MAFIA_VOTE_UPDATE', (e: any) => {
            const data = JSON.parse(e.data); 
            setVoteStatus(data.votes); 
        });

        eventSource.addEventListener('MAFIA_FINAL_VOTE_START', () => {
            setPhase('FINAL_VOTE');
            setSystemMessage("최후의 변론이 끝났습니다. 찬반 투표를 진행합니다.");
        });

        eventSource.addEventListener('MAFIA_GAME_END', (e: any) => {
            const data = JSON.parse(e.data); 
            setPhase('END');
            setWinner(data.winner);
            setSystemMessage(data.winner === 'CITIZEN' ? "시민들이 승리했습니다! 🎉" : "마피아의 승리입니다! 😈");
        });

    }, [eventSource]);


    // ============================================================
    // 🛠️ [TEST MODE] 마피아 개발자 테스트 함수들
    // ============================================================
    const handleTestStart = () => {
        console.log("🕵️ 마피아 테스트 모드 시작!");
        
        // 1. 강제 더미 플레이어 생성 (로비에 아무도 없을 때를 대비)
        const dummies: MafiaPlayer[] = [
            { deviceId: 'd1', nickname: '철수 (마피아)', isAlive: true, role: 'MAFIA' }, // 역할은 UI 표시용 아님 (보안상)
            { deviceId: 'd2', nickname: '영희 (의사)', isAlive: true, role: 'DOCTOR' },
            { deviceId: 'd3', nickname: '민수 (경찰)', isAlive: true, role: 'POLICE' },
            { deviceId: 'd4', nickname: '지수 (시민)', isAlive: true, role: 'CIVILIAN' },
            { deviceId: 'd5', nickname: '길동 (시민)', isAlive: true, role: 'CIVILIAN' },
        ];
        
        setMafiaPlayers(dummies);
        setPhase('NIGHT');
        setSystemMessage("[TEST] 밤이 되었습니다. (테스트 모드)");
        setWinner(null);
        setVoteStatus({});
    };

    const handleTestNextPhase = () => {
        // 순환: NIGHT -> DAY -> VOTE -> FINAL -> NIGHT
        if (phase === 'NIGHT') {
            setPhase('DAY_ANNOUNCEMENT');
            setSystemMessage("[TEST] 낮이 되었습니다.");
        } else if (phase === 'DAY_ANNOUNCEMENT') {
            setPhase('VOTE');
            setSystemMessage("[TEST] 투표 시간입니다. (클릭해서 투표 수 테스트)");
            // 테스트용 투표 데이터 주입
            setVoteStatus({ '철수 (마피아)': 2, '지수 (시민)': 1 });
        } else if (phase === 'VOTE') {
            setPhase('FINAL_VOTE');
            setSystemMessage("[TEST] 최종 찬반 투표입니다.");
        } else {
            setPhase('NIGHT');
            setSystemMessage("[TEST] 다시 밤이 되었습니다.");
        }
    };

    const handleTestKillRandom = () => {
        const survivors = mafiaPlayers.filter(p => p.isAlive);
        if (survivors.length === 0) return;
        
        const victim = survivors[Math.floor(Math.random() * survivors.length)];
        
        // 죽은 처리
        setMafiaPlayers(prev => prev.map(p => 
            p.deviceId === victim.deviceId ? { ...p, isAlive: false } : p
        ));
        setSystemMessage(`[TEST] ${victim.nickname}님이 처형되었습니다 💀`);
    };
    // ============================================================

    return {
        phase,
        timer,
        systemMessage,
        mafiaPlayers,
        voteStatus,
        winner, 
        startGame, 
        testHandlers: { handleTestStart, handleTestNextPhase, handleTestKillRandom }
    };
}