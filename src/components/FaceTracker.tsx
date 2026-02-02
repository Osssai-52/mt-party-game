'use client';

import { useEffect, useRef } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import gameApi from '../services/gameApi';
import { 
    calculateEAR, 
    getDistance, 
    getIrisPosition, 
    calculateNostrilDilatation,
    calculateStdDev,
    determineMicroExpression
} from '../utils/faceMath';
import { FaceAnalysisData } from '../types/truth';

interface FaceTrackerProps {
    roomId: string;
    targetDeviceId: string; // 현재 답변자의 deviceId (데이터 전송용)
    onStatusChange?: (msg: string) => void;
    onAnalyze?: (data: FaceAnalysisData) => void; // ✨ 부모에게 데이터 전달용 콜백
}

export default function FaceTracker({ roomId, targetDeviceId, onStatusChange, onAnalyze }: FaceTrackerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const lastTimeRef = useRef<number>(-1);
    const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
    
    // 1초 동안 데이터를 쌓아둘 통계 창고
    const statsRef = useRef({
        blinks: 0,
        isEyeClosed: false,
        irisMovements: [] as number[],
        headMovements: [] as number[],
        nostrilSizes: [] as number[],
        lastIris: null as any,
        lastNose: null as any,
    });

    useEffect(() => {
        const setupFaceMesh = async () => {
            onStatusChange?.("AI 모델 로딩 중...");
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );
            
            faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                    delegate: "GPU"
                },
                outputFaceBlendshapes: true,
                runningMode: "VIDEO",
                numFaces: 1
            });
            startCamera();
        };
        setupFaceMesh();
    }, []);

    const startCamera = async () => {
        if (!videoRef.current) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480, facingMode: "user" } 
            });
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener("loadeddata", predictWebcam);
            onStatusChange?.("진실의 눈 가동 중... 👁️");
        } catch (err) {
            console.error(err);
            onStatusChange?.("카메라 권한 필요 📷");
        }
    };

    const predictWebcam = () => {
        const video = videoRef.current;
        const landmarker = faceLandmarkerRef.current;
        
        if (video && landmarker) {
            let startTimeMs = performance.now();
            if (lastTimeRef.current !== video.currentTime) {
                lastTimeRef.current = video.currentTime;
                const results = landmarker.detectForVideo(video, startTimeMs);

                if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                    const landmarks = results.faceLandmarks[0];
                    const stats = statsRef.current;

                    // 1. 눈 깜빡임 (Count)
                    const ear = calculateEAR(landmarks);
                    if (ear < 0.25) {
                        if (!stats.isEyeClosed) {
                            stats.blinks += 1;
                            stats.isEyeClosed = true;
                        }
                    } else {
                        stats.isEyeClosed = false;
                    }

                    // 2. 시선 불안정 (Iris Movement)
                    const currentIris = getIrisPosition(landmarks);
                    if (stats.lastIris) {
                        const dist = getDistance(currentIris.left, stats.lastIris.left);
                        stats.irisMovements.push(dist);
                    }
                    stats.lastIris = currentIris;

                    // 3. 얼굴 떨림 (Head Tremor - 코 끝 기준)
                    const currentNose = landmarks[1];
                    if (stats.lastNose) {
                        const dist = getDistance(currentNose, stats.lastNose);
                        stats.headMovements.push(dist);
                    }
                    stats.lastNose = currentNose;

                    // 4. 콧구멍 움직임 (Nostril)
                    const currentNostrilSize = calculateNostrilDilatation(landmarks);
                    stats.nostrilSizes.push(currentNostrilSize);
                }
            }
            requestAnimationFrame(predictWebcam);
        }
    };

    // ⏱️ 1초마다 데이터 분석 및 전송
    useEffect(() => {
        const interval = setInterval(async () => {
            const stats = statsRef.current;
            
            // 데이터가 충분치 않으면 패스
            if (stats.headMovements.length < 5) return;

            // --- 점수 변환 로직 ---
            const eyeMovementScore = Math.min(calculateStdDev(stats.irisMovements) * 50, 1.0); 
            const tremorScore = Math.min((stats.headMovements.reduce((a,b)=>a+b, 0) / stats.headMovements.length) * 30, 1.0);
            const nostrilScore = Math.min(calculateStdDev(stats.nostrilSizes) * 100, 1.0);
            
            // 종합 스트레스 지수 (0 ~ 100)
            const stressLevel = Math.min(
                (stats.blinks * 10) + (eyeMovementScore * 40) + (tremorScore * 30) + (nostrilScore * 20), 
                100
            );

            const isLie = stressLevel >= 55; // 판정 기준
            
            // 데이터 패키징
            const analysisData: FaceAnalysisData = {
                eyeBlinkRate: stats.blinks,
                eyeMovement: parseFloat(eyeMovementScore.toFixed(2)),
                facialTremor: parseFloat(tremorScore.toFixed(2)),
                nostrilMovement: parseFloat(nostrilScore.toFixed(2)),
                stressLevel: Math.round(stressLevel),
                isLie
            };

            // 1. 📡 서버로 전송 (게임 API 사용)
            try {
                // targetDeviceId는 지금 답변하고 있는 사람의 ID여야 함
                if (targetDeviceId) {
                    await gameApi.truth.sendFaceData(roomId, targetDeviceId, analysisData);
                    console.log(`[FaceTracker] 전송 완료: Stress ${stressLevel}`);
                }
            } catch (e) { console.error("데이터 전송 실패", e); }

            // 2. ✨ 부모(HUD) 화면 업데이트
            if (onAnalyze) {
                onAnalyze(analysisData);
            }

            // 초기화
            stats.blinks = 0;
            stats.irisMovements = [];
            stats.headMovements = [];
            stats.nostrilSizes = [];

        }, 1000); 

        return () => clearInterval(interval);
    }, [roomId, targetDeviceId, onAnalyze]);

    return (
        // FaceTracker는 이제 배경으로 쓰일 거라 스타일을 조금 수정했어
        <div className="w-full h-full">
            <video 
                ref={videoRef} 
                autoPlay 
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]" 
            />
        </div>
    );
}