'use client';

import { useEffect, useRef } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { 
    calculateEAR, 
    getDistance, 
    getIrisPosition, 
    calculateNostrilDilatation,
    calculateStdDev,
    determineMicroExpression
    } from '../utils/faceMath';

    interface FaceDataPayload {
    roomId: string;
    deviceId: string;
    data: {
        eyeBlinkRate: number;    // 눈 깜빡임 (회/초)
        eyeMovement: number;     // 시선 불안정 (표준편차)
        facialTremor: number;    // 얼굴 떨림 (평균 이동량)
        nostrilMovement: number; // 콧구멍 움직임 (변화량)
        microExpression: string; // "nervous" | "neutral" | "confident"
    }
    }

    export default function FaceTracker({ roomId, onStatusChange }: { roomId: string, onStatusChange?: (msg: string) => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const lastTimeRef = useRef<number>(-1);
    const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
    
    // 1초 동안 데이터를 쌓아둘 창고 (통계용)
    const statsRef = useRef({
        blinks: 0,
        isEyeClosed: false,
        
        // 데이터 모음집 (1초 뒤에 계산하고 비울 거임)
        irisMovements: [] as number[],   // 눈동자 이동 거리들
        headMovements: [] as number[],   // 머리 이동 거리들 (떨림)
        nostrilSizes: [] as number[],    // 콧구멍 크기들
        
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
            video: { width: 480, height: 480, facingMode: "user" } 
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
                // 왼쪽 눈동자가 움직인 거리
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

    // 1초마다 백엔드로 분석 결과 전송 
    useEffect(() => {
        const interval = setInterval(async () => {
            const stats = statsRef.current;
            
            // 데이터가 너무 적으면 패스
            if (stats.headMovements.length < 5) return;

            // 통계 계산 & 0~1 점수 변환
            
            // 1. 시선 불안정 (표준편차)
            const rawEyeMovement = calculateStdDev(stats.irisMovements);
            const eyeMovementScore = Math.min(rawEyeMovement * 50, 1.0); 

            // 2. 얼굴 떨림 (평균 이동량)
            const rawTremor = stats.headMovements.reduce((a,b)=>a+b, 0) / stats.headMovements.length;
            const tremorScore = Math.min(rawTremor * 30, 1.0);

            // 3. 콧구멍 움직임 (표준편차)
            const rawNostril = calculateStdDev(stats.nostrilSizes);
            const nostrilScore = Math.min(rawNostril * 100, 1.0);

            // 4. 미세표정 판정 (변환된 점수 기준으로 판단)
            const expression = determineMicroExpression(stats.blinks, eyeMovementScore, tremorScore);

            // 전송할 데이터 패키지
            const payload: FaceDataPayload = {
                roomId: roomId,
                deviceId: "player_device_id", 
                data: {
                    eyeBlinkRate: stats.blinks, 
                    
                    eyeMovement: parseFloat(eyeMovementScore.toFixed(2)), 
                    facialTremor: parseFloat(tremorScore.toFixed(2)),
                    nostrilMovement: parseFloat(nostrilScore.toFixed(2)),
                    
                    microExpression: expression
                }
            };

            // 전송
            try {
                await fetch('/api/v1/games/truth/face-tracking', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                // 로그로 점수 확인해보기!
                console.log(`전송: 눈(${payload.data.eyeMovement}) 떨림(${payload.data.facialTremor}) 코(${payload.data.nostrilMovement})`);
                onStatusChange?.(`분석 중... 상태: ${expression}`);
            } catch (e) {
                console.error("전송 실패");
            }

            // 초기화
            stats.blinks = 0;
            stats.irisMovements = [];
            stats.headMovements = [];
            stats.nostrilSizes = [];

        }, 1000); 

        return () => clearInterval(interval);
    }, [roomId]);

    return (
        <div className="relative w-full max-w-[300px] aspect-square bg-gray-900 rounded-2xl overflow-hidden border-2 border-purple-500 shadow-lg mx-auto">
        <video 
            ref={videoRef} 
            autoPlay 
            playsInline
            muted
            className="w-full h-full object-cover transform scale-x-[-1]" 
        />
        <div className="absolute top-2 left-2 bg-black/60 text-xs px-2 py-1 rounded-md text-green-400 border border-green-500/30 animate-pulse">
            ● LIVE ANALYSIS
        </div>
        </div>
    );
}