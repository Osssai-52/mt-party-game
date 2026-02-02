import { useState, useEffect } from 'react';
import { MafiaPlayer, MafiaPhase } from '../types/mafia';
import gameApi from '../services/gameApi';

export default function useMafiaHost(roomId: string, players: any[], eventSource: EventSource | null) {
    const [phase, setPhase] = useState<MafiaPhase>('NIGHT');
    const [timer, setTimer] = useState(0);
    const [systemMessage, setSystemMessage] = useState("게임 시작 대기 중...");
    const [mafiaPlayers, setMafiaPlayers] = useState<MafiaPlayer[]>([]);

    // 1. 게임 시작 (실제)
    const startGame = async () => {
        try {
            await gameApi.mafia.init(roomId);
            // 초기화: 로비 인원 그대로 가져옴
            setMafiaPlayers(players.map(p => ({ 
                deviceId: p.deviceId, 
                nickname: p.nickname, 
                isAlive: true,
                profileImage: p.profileImage 
            })));
            setPhase('NIGHT');
            setSystemMessage("밤이 되었습니다. 마피아는 고개를 들어주세요.");
        } catch (e) { console.error(e); }
    };

    // 2. SSE 이벤트 리스너
    useEffect(() => {
        if (!eventSource) return;

        eventSource.addEventListener('MAFIA_TIMER', (e: any) => {
            const data = JSON.parse(e.data);
            setTimer(data.timer);
        });

        eventSource.addEventListener('MAFIA_NIGHT', () => {
            setPhase('NIGHT');
            setSystemMessage("밤이 되었습니다. 마피아는 고개를 들어주세요.");
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
        });

        eventSource.addEventListener('MAFIA_FINAL_VOTE_START', () => {
            setPhase('FINAL_VOTE');
            setSystemMessage("최후의 변론이 끝났습니다. 찬반 투표를 진행합니다.");
        });

    }, [eventSource]);

    // ============================================================
    // 🛠️ [마피아 테스트 모드]
    // ============================================================
    const handleTestStart = () => {
        // 더미 플레이어 생성
        const dummies: MafiaPlayer[] = [
            { deviceId: 'd1', nickname: '철수', isAlive: true },
            { deviceId: 'd2', nickname: '영희', isAlive: true },
            { deviceId: 'd3', nickname: '민수', isAlive: true },
            { deviceId: 'd4', nickname: '지수', isAlive: true },
            { deviceId: 'd5', nickname: '길동', isAlive: true },
        ];
        setMafiaPlayers(dummies);
        setPhase('NIGHT');
        setSystemMessage("[TEST] 게임이 시작되었습니다 (밤)");
    };

    const handleTestNextPhase = () => {
        // 순환: NIGHT -> DAY -> VOTE -> FINAL -> NIGHT
        if (phase === 'NIGHT') {
            setPhase('DAY_ANNOUNCEMENT');
            setSystemMessage("[TEST] 낮이 되었습니다.");
        } else if (phase === 'DAY_ANNOUNCEMENT') {
            setPhase('VOTE');
            setSystemMessage("[TEST] 투표 시간입니다.");
        } else if (phase === 'VOTE') {
            setPhase('FINAL_VOTE');
            setSystemMessage("[TEST] 최종 찬반 투표입니다.");
        } else {
            setPhase('NIGHT');
            setSystemMessage("[TEST] 다시 밤이 되었습니다.");
        }
    };

    const handleTestKillRandom = () => {
        // 살아있는 사람 중 한 명 랜덤 처형
        const survivors = mafiaPlayers.filter(p => p.isAlive);
        if (survivors.length === 0) return;
        
        const victim = survivors[Math.floor(Math.random() * survivors.length)];
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
        startGame, // 실제 게임 시작
        testHandlers: { // 테스트용 함수들
            handleTestStart,
            handleTestNextPhase,
            handleTestKillRandom
        }
    };
}