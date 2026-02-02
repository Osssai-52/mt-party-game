import { createServer, IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";

// --- GameStore Logic ---
export type GamePhase = 'LOBBY' | 'SUBMIT' | 'VOTE' | 'GAME';

export interface Player {
    socketId: string;
    nickname: string;
    submittedCount: number;
    isVoteFinished: boolean; // New
}

export interface Penalty {
    id: string;
    text: string;
    author: string;
    votes: number;
    voters: string[]; // New: track who voted
}

export interface RoomData {
    id: string;
    players: Record<string, Player>;
    penalties: Penalty[];
    phase: GamePhase;
    gameBoard: string[];
    currentTurnIndex: number;
    diceValue: number;
}

class GameStore {
    private rooms: Map<string, RoomData> = new Map();

    createRoom(roomId: string) {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, {
                id: roomId,
                players: {},
                penalties: [],
                phase: 'SUBMIT', // Default to SUBMIT phase directly
                gameBoard: [],
                currentTurnIndex: 0,
                diceValue: 0
            });
        }
    }

    getRoom(roomId: string) {
        return this.rooms.get(roomId);
    }

    addPlayer(roomId: string, socketId: string, nickname: string) {
        const room = this.getRoom(roomId);
        if (room) {
            room.players[socketId] = {
                socketId,
                nickname,
                submittedCount: 0,
                isVoteFinished: false
            };
        }
    }

    removePlayer(roomId: string, socketId: string) {
        const room = this.getRoom(roomId);
        if (room) {
            delete room.players[socketId];
        }
    }

    submitPenalty(roomId: string, socketId: string, text: string) {
        const room = this.getRoom(roomId);
        if (!room) return false;

        const player = room.players[socketId];
        if (!player || player.submittedCount >= 2) return false;

        room.penalties.push({
            id: Date.now() + Math.random().toString(),
            text,
            author: player.nickname,
            votes: 0,
            voters: []
        });
        player.submittedCount++;
        return true;
    }

    toggleVote(roomId: string, penaltyId: string, socketId: string) {
        const room = this.getRoom(roomId);
        if (!room) return false;

        const penalty = room.penalties.find(p => p.id === penaltyId);
        if (penalty) {
            const voterIndex = penalty.voters.indexOf(socketId);
            if (voterIndex === -1) {
                // Add vote
                penalty.voters.push(socketId);
                penalty.votes++; // Sync
            } else {
                // Remove vote (Toggle)
                penalty.voters.splice(voterIndex, 1);
                penalty.votes--; // Sync
            }
            return true;
        }
        return false;
    }

    setVoteFinished(roomId: string, socketId: string, finished: boolean) {
        const room = this.getRoom(roomId);
        console.log(`[GameStore] setVoteFinished: Room=${roomId}, Socket=${socketId}, Finished=${finished}`);
        if (room) {
            const player = room.players[socketId];
            if (player) {
                player.isVoteFinished = finished;
                console.log(`[GameStore] Player ${player.nickname} vote finished set to ${finished}`);
                return true;
            } else {
                console.log(`[GameStore] Player not found in room! Keys: ${Object.keys(room.players).join(', ')}`);
            }
        } else {
            console.log(`[GameStore] Room not found!`);
        }
        return false;
    }

    setPhase(roomId: string, phase: GamePhase) {
        const room = this.getRoom(roomId);
        if (room) {
            room.phase = phase;
        }
    }
}

const gameStore = new GameStore();

// --- End GameStore Logic ---


const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// Helper to read JSON body
const readBody = (req: IncomingMessage): Promise<any> => {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString() });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                resolve({});
            }
        });
        req.on('error', reject);
    });
};

app.prepare().then(() => {
    const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        const parsedUrl = parse(req.url!, true);
        const { pathname } = parsedUrl;

        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // --- API ROUTES ---

        // 1. Penalty Submit
        if (pathname === '/penalty/submit' && req.method === 'POST') {
            const body = await readBody(req);
            const { roomId, socketId, text } = body;
            const success = gameStore.submitPenalty(roomId, socketId, text);

            if (success) {
                io.to(roomId).emit('MARBLE_PENALTY_SUBMITTED', {
                    count: gameStore.getRoom(roomId)?.penalties.length
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Failed or limit reached' }));
            }
            return;
        }

        // 2. Penalty Status
        if (pathname?.startsWith('/penalty/status/') && req.method === 'GET') {
            const roomId = pathname.split('/').pop()!;
            const room = gameStore.getRoom(roomId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                count: room?.penalties.length || 0,
                submittedPlayers: Object.values(room?.players || {}).filter(p => p.submittedCount > 0).length
            }));
            return;
        }

        // 3. Vote List
        if (pathname?.startsWith('/vote/penalties/') && req.method === 'GET') {
            const roomId = pathname.split('/').pop()!;
            const room = gameStore.getRoom(roomId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(room?.penalties || []));
            return;
        }

        // 4. Vote Action (Toggle)
        if (pathname === '/vote' && req.method === 'POST') {
            const body = await readBody(req);
            const { roomId, penaltyId, socketId } = body;
            const success = gameStore.toggleVote(roomId, penaltyId, socketId);
            if (success) {
                // No need to broadcast every click usually, but if we want live ranking...
                // Let's just ack.
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } else {
                res.writeHead(400);
                res.end(JSON.stringify({ success: false }));
            }
            return;
        }

        // 4.5 Vote Complete
        if (pathname === '/vote/complete' && req.method === 'POST') {
            const body = await readBody(req);
            const { roomId, socketId } = body;
            gameStore.setVoteFinished(roomId, socketId, true);

            // Notify Host
            io.to(roomId).emit('MARBLE_VOTE_UPDATE');

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
            return;
        }

        // 5. Game Init (Finish Voting -> Start Game)
        if (pathname === '/init' && req.method === 'POST') {
            const body = await readBody(req);
            const { roomId } = body;
            const room = gameStore.getRoom(roomId);
            if (room) {
                const sorted = [...room.penalties].sort((a, b) => b.votes - a.votes).slice(0, 26);
                gameStore.setPhase(roomId, 'GAME');
                // Send the final list to everyone
                io.to(roomId).emit('MARBLE_INIT', { penalties: sorted });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } else {
                res.writeHead(404);
                res.end();
            }
            return;
        }

        // 6. Generic State
        if (pathname?.startsWith('/state/') && req.method === 'GET') {
            const roomId = pathname.split('/').pop()!;
            const room = gameStore.getRoom(roomId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                phase: room?.phase || 'LOBBY',
                players: Object.values(room?.players || {})
            }));
            return;
        }

        // Host triggers phase change manually
        if (pathname === '/phase/change' && req.method === 'POST') {
            const body = await readBody(req);
            const { roomId, phase } = body;
            gameStore.setPhase(roomId, phase);
            io.to(roomId).emit('MARBLE_PHASE_CHANGE', { phase });
            res.writeHead(200);
            res.end(JSON.stringify({ success: true }));
            return;
        }

        handle(req, res, parsedUrl);
    });

    const io = new Server(httpServer, {
        path: "/api/socket/io",
        addTrailingSlash: false,
        cors: { origin: "*" }
    });

    io.on("connection", (socket) => {
        console.log("Connection:", socket.id);

        socket.on("join-room", (data) => {
            const { roomId, nickname } = data;
            socket.join(roomId);

            if (nickname !== 'HOST') {
                gameStore.createRoom(roomId);
                gameStore.addPlayer(roomId, socket.id, nickname);
            } else {
                gameStore.createRoom(roomId);
            }

            const room = gameStore.getRoom(roomId);
            socket.emit('MARBLE_PHASE_CHANGE', { phase: room?.phase || 'LOBBY' });

            io.to(roomId).emit("user-joined", { nickname, socketId: socket.id });
        });

        socket.on("roll-dice", (data) => {
            const { roomId } = data;
            const diceValue = Math.floor(Math.random() * 6) + 1;
            console.log(`[Dice] Room ${roomId} result: ${diceValue}`);
            io.to(roomId).emit("dice-rolled", {
                value: diceValue,
                playerId: socket.id
            });
        });

        socket.on("reaction", (data) => {
            socket.to(data.roomId).emit("reaction-received", data.emoji);
        });

        socket.on("disconnect", () => {
            // Optional: handle disconnect
        });
    });

    const PORT = 3000;
    httpServer.listen(PORT, () => {
        console.log(`> Ready on http://localhost:${PORT}`);
        console.log(`> Socket & API Server Ready`);
    });
});