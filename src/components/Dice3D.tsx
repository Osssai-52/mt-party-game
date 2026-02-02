'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface Dice3DProps {
    value: number; // 1~6
    rolling: boolean;
    size?: number;
}

export default function Dice3D({ value, rolling, size = 100 }: Dice3DProps) {
    // 3D 회전값 (rx, ry)
    // 각 숫자가 정면을 보게 하기 위한 회전 각도
    const getRotation = (val: number) => {
        switch (val) {
            case 1: return { x: 0, y: 0 };
            case 2: return { x: 0, y: -90 };
            case 3: return { x: 0, y: -180 };
            case 4: return { x: 0, y: 90 };
            case 5: return { x: -90, y: 0 };
            case 6: return { x: 90, y: 0 };
            default: return { x: 0, y: 0 };
        }
    };

    const targetRotation = getRotation(value);

    // 주사위 면 스타일
    const faceStyle = "absolute w-full h-full bg-white border-2 border-gray-200 rounded-xl flex items-center justify-center shadow-[inset_0_0_20px_rgba(0,0,0,0.1)] backface-hidden";
    const dotStyle = "w-[20%] h-[20%] bg-black rounded-full shadow-inner";

    // 점 배치 (Grid 활용)
    const renderDots = (count: number) => {
        // 점 위치 패턴 (3x3 그리드 기준)
        const patterns: Record<number, number[]> = {
            1: [4],
            2: [0, 8],
            3: [0, 4, 8],
            4: [0, 2, 6, 8],
            5: [0, 2, 4, 6, 8],
            6: [0, 2, 3, 5, 6, 8]
        };

        return (
            <div className="w-[60%] h-[60%] grid grid-cols-3 grid-rows-3 gap-1">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div key={i} className="flex items-center justify-center">
                        {patterns[count].includes(i) && <div className={dotStyle} />}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="relative flex items-center justify-center placeholder-3d" style={{ width: size, height: size, perspective: '1000px' }}>
            <motion.div
                className="w-full h-full relative"
                style={{ transformStyle: 'preserve-3d' }}
                animate={
                    rolling
                        ? {
                            rotateX: [0, 720, 1080, 1440],
                            rotateY: [0, 720, 1080, 1440],
                            rotateZ: [0, 360, 720]
                        }
                        : {
                            rotateX: targetRotation.x,
                            rotateY: targetRotation.y,
                            rotateZ: 0
                        }
                }
                transition={
                    rolling
                        ? { duration: 2, ease: "linear", repeat: Infinity }
                        : { duration: 0.5, type: "spring", stiffness: 100, damping: 20 }
                }
            >
                {/* 1 (Front) */}
                <div className={`${faceStyle}`} style={{ transform: `translateZ(${size / 2}px)` }}>
                    {renderDots(1)}
                </div>
                {/* 2 (Right) */}
                <div className={`${faceStyle}`} style={{ transform: `rotateY(90deg) translateZ(${size / 2}px)` }}>
                    {renderDots(2)}
                </div>
                {/* 3 (Back) */}
                <div className={`${faceStyle}`} style={{ transform: `rotateY(180deg) translateZ(${size / 2}px)` }}>
                    {renderDots(3)}
                </div>
                {/* 4 (Left) */}
                <div className={`${faceStyle}`} style={{ transform: `rotateY(-90deg) translateZ(${size / 2}px)` }}>
                    {renderDots(4)}
                </div>
                {/* 5 (Top) */}
                <div className={`${faceStyle}`} style={{ transform: `rotateX(90deg) translateZ(${size / 2}px)` }}>
                    {renderDots(5)}
                </div>
                {/* 6 (Bottom) */}
                <div className={`${faceStyle}`} style={{ transform: `rotateX(-90deg) translateZ(${size / 2}px)` }}>
                    {renderDots(6)}
                </div>
            </motion.div>
        </div>
    );
}
