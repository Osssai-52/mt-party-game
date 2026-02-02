'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { generateBoard, MarbleTile } from '../constants/marbleMap';
import PlayerPiece from './PlayerPiece';

// 28칸 배치 좌표 계산
const getTilePosition = (index: number) => {
    if (index >= 0 && index <= 7) return { row: 1, col: index + 1 };
    if (index >= 8 && index <= 13) return { row: index - 7 + 1, col: 8 };
    if (index >= 14 && index <= 21) return { row: 8, col: 8 - (index - 14) };
    return { row: 8 - (index - 21), col: 1 };
};

export default function JuruBoard({ players, penalties }: { players: any[], penalties: { text: string }[] }) {
    const [tiles, setTiles] = useState<MarbleTile[]>([]);

    useEffect(() => {
        setTiles(generateBoard(penalties));
    }, [penalties]);

    return (
        <div className="relative w-full max-w-[1000px] aspect-square bg-[#fdfdfd] p-1 md:p-3 rounded-[30px] md:rounded-[40px] shadow-2xl border-4 md:border-8 border-dashed border-gray-300 font-hand overflow-hidden select-none">

            <div className="grid grid-cols-8 grid-rows-8 gap-0.5 md:gap-1 w-full h-full">

                {tiles.map((tile) => {
                    const pos = getTilePosition(tile.id);

                    const rawColor = tile.bgColor;
                    const isTailwindClass = rawColor?.startsWith('bg-');
                    const bgClassName = isTailwindClass ? rawColor : (rawColor ? '' : 'bg-white');
                    const bgStyle = (!isTailwindClass && rawColor) ? { backgroundColor: rawColor } : {};

                    return (
                        <div
                            key={tile.id}
                            className={`relative border-sketch shadow-sm ${bgClassName} overflow-hidden`}
                            style={{
                                gridRow: pos.row,
                                gridColumn: pos.col,
                                transform: `rotate(${Math.random() * 2 - 1}deg)`,
                                ...bgStyle
                            }}
                        >
                            {/* 🖼️ 이미지/텍스트 영역 */}
                            <div className="w-full h-full flex items-center justify-center p-1 text-center">
                                {tile.image ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                        src={tile.image}
                                        alt={tile.name}
                                        className="w-full h-full object-contain drop-shadow-sm"
                                    />
                                ) : (
                                    <div className="text-sm md:text-lg font-bold break-words leading-tight text-gray-800">
                                        {tile.name}
                                    </div>
                                )}
                            </div>

                            {/* 🔢 번호 */}
                            <span className="absolute top-0.5 left-1 text-[7px] md:text-[9px] text-gray-500/50 font-sans">
                                #{tile.id}
                            </span>
                        </div>
                    );
                })}

                {/* 중앙 로고 */}
                <div className="col-start-2 col-end-8 row-start-2 row-end-8 flex flex-col items-center justify-center relative overflow-hidden">
                    <h1 className="text-4xl md:text-6xl lg:text-8xl font-black text-gray-200 rotate-[-10deg] absolute opacity-50 pointer-events-none whitespace-nowrap">
                        주루마블
                    </h1>
                    <div id="dice-container" className="z-10"></div>
                </div>
            </div>

            {/* 플레이어 말 */}
            {players.map((p) => {
                const pos = getTilePosition(p.currentPosition);
                return (
                    <motion.div
                        key={p.id}
                        layout
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="absolute w-full h-full pointer-events-none flex items-center justify-center"
                        style={{
                            top: `${(pos.row - 1) * 12.5}%`,
                            left: `${(pos.col - 1) * 12.5}%`,
                            width: '12.5%',
                            height: '12.5%'
                        }}
                    >
                        <PlayerPiece
                            nickname={p.nickname}
                            color={p.color}
                            profileImage={p.profileImage}
                            positionIndex={p.currentPosition}
                        />
                    </motion.div>
                );
            })}

        </div>
    );
}