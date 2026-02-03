import { useState, useEffect } from 'react';
import { LiarPhase, LiarPlayer } from '../types/liar';
import gameApi from '../services/gameApi';

export default function useLiarHost(roomId: string, players: any[], eventSource: EventSource | null) {
    const [phase, setPhase] = useState<LiarPhase>('LOBBY');
    const [timer, setTimer] = useState(0);
    const [categoryName, setCategoryName] = useState("");
    const [keyword, setKeyword] = useState<string | null>(null);
    const [liarName, setLiarName] = useState<string | null>(null);
    
    // 플레이어 순서 및 현재 턴 관리
    const [gamePlayers, setGamePlayers] = useState<LiarPlayer[]>([]);
    const [currentExplainerIndex, setCurrentExplainerIndex] = useState(-1);
    
    // 투표 현황
    const [voteStatus, setVoteStatus] = useState({ agree: 0, disagree: 0 });

    // API: 게임 시작 (기본값 0 = 랜덤)
    const startGame = async (categoryId: number = 0) => {
        try {
            let targetId = categoryId;

            // 0번(랜덤)으로 요청이 오면 카테고리 목록에서 뽑기
            if (targetId === 0) {
                const res = await gameApi.liar.getCategories();
                const categories = res.data; // [{categoryId: 1, name: '동물'}, ...]
                
                if (categories && categories.length > 0) {
                    const randomIndex = Math.floor(Math.random() * categories.length);
                    targetId = categories[randomIndex].categoryId;
                    console.log(`🎲 랜덤 선택된 카테고리 ID: ${targetId} (${categories[randomIndex].name})`);
                } else {
                    targetId = 1; // 목록이 비었을 경우 안전장치 (기본값)
                }
            }

            // 결정된 ID(targetId)로 게임 초기화 요청
            await gameApi.liar.init(roomId, targetId);
            
            // 초기 플레이어 세팅
            setGamePlayers(players.map((p: any) => ({
                deviceId: p.deviceId,
                nickname: p.nickname,
                profileImage: p.profileImage
            })));
        } catch (e) { console.error("게임 시작 실패", e); }
    };

    // SSE 이벤트 리스너
    useEffect(() => {
        if (!eventSource) return;

        // 1. 초기화 (LIAR_INIT)
        eventSource.addEventListener('LIAR_INIT', (e: any) => {
            const data = JSON.parse(e.data);
            setPhase('ROLE_REVEAL');
            setCategoryName(data.categoryName);
            setTimer(30);
        });

        // 2. 타이머 (LIAR_TIMER)
        eventSource.addEventListener('LIAR_TIMER', (e: any) => {
            const data = JSON.parse(e.data);
            setTimer(data.timerSec);
        });

        // 3. 설명자 변경 (LIAR_NEXT_EXPLAINER)
        eventSource.addEventListener('LIAR_NEXT_EXPLAINER', (e: any) => {
            const data = JSON.parse(e.data);
            setPhase('EXPLANATION');
            setCurrentExplainerIndex(data.index); // 현재 설명해야 하는 사람 인덱스
        });

        // 4. 투표 업데이트 (LIAR_VOTE_UPDATE) -> 추가 라운드 찬반
        eventSource.addEventListener('LIAR_VOTE_UPDATE', (e: any) => {
            const data = JSON.parse(e.data);
            setPhase('VOTE_MORE_ROUND');
            setVoteStatus({ agree: data.moreCount, disagree: data.stopCount });
        });

        // 5. 지목 단계 (POINTING) 
        eventSource.addEventListener('LIAR_POINTING_START', () => {
            setPhase('POINTING');
        });

        // 6. 게임 종료 (LIAR_GAME_END)
        eventSource.addEventListener('LIAR_GAME_END', (e: any) => {
            const data = JSON.parse(e.data);
            setPhase('GAME_END');
            setKeyword(data.keyword);
            setLiarName(data.liarName);
        });

    }, [eventSource]);

    // [테스트용 핸들러]
    const testHandlers = {
        start: () => { setPhase('ROLE_REVEAL'); setTimer(30); setCategoryName('테스트(동물)'); },
        nextTurn: () => { setPhase('EXPLANATION'); setCurrentExplainerIndex(prev => (prev + 1) % 4); },
        voteStart: () => { setPhase('VOTE_MORE_ROUND'); },
        endGame: () => { setPhase('GAME_END'); setLiarName('테스트라이어'); setKeyword('사자'); }
    };

    return {
        phase,
        timer,
        categoryName,
        keyword,
        liarName,
        gamePlayers,
        currentExplainerIndex,
        voteStatus,
        startGame,
        testHandlers
    };
}