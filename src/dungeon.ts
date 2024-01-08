import { Actor } from "./actor";
import { GameMove, GameState } from "./logic";
import { createMonster } from "./monsters";

export interface Point {
    x: number;
    y: number;
}

export interface Door {
    x: number;
    y: number;
    open: boolean;
}

export interface Room {
    discovered: boolean;
    start: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    depth: number;
}

export interface Dungeon {
    id: number;
    rooms: Room[];
    doors: Door[];
    actors: Actor[];
}

// special intersection routine that allows walls to overlay but not
// open spaces
function roomIntersection(a: Room, fullRoom: Room): boolean {
    const r1 = { left: a.x + 1, right: a.x + a.width - 2, top: a.y + 1, bottom: a.y + a.height - 2 };
    const r2 = { left: fullRoom.x, right: fullRoom.x + fullRoom.width - 1, top: fullRoom.y, bottom: fullRoom.y + fullRoom.height - 1 };
    return !(r2.left > r1.right
        || r2.right < r1.left
        || r2.top > r1.bottom
        || r2.bottom < r1.top
    );
}

enum Direction {
    NORTH = 0,
    SOUTH = 1,
    WEST = 2,
    EAST = 3
}

// Generate the dungeon level. We create a start room with some stairs in. Then recursively
// find an existing room and pick a direction (N/S/E/W) - try to generate a room in that
// direction. If it fits (i.e. it doesn't clash with any other existing room) then 
// place it and add an appropriate door
export function generateDungeon(game: GameState): Dungeon {
    const dungeon: Dungeon = {
        id: game.nextId++,
        rooms: [],
        doors: [],
        actors: []
    }

    // the target number of rooms to create
    const targetCount = 20;
    // guard condition for the rare case
    // we can't place 20 rooms
    let maxCycles = 1000;

    // add the start room
    dungeon.rooms.push({ x: 0, y: 0, width: 5, height: 5, discovered: true, start: true, depth: 0 });

    while (dungeon.rooms.length < targetCount && maxCycles > 0) {
        maxCycles--;

        // pick a room to start the link from
        const source = dungeon.rooms[Math.floor(Math.random() * dungeon.rooms.length)];

        // pick a random direction
        const dir = Math.floor(Math.random() * 4);

        // create a new room with a random size
        const newRoom = {
            x: 0,
            y: 0,
            width: Math.floor(Math.random() * 3) + 5,
            height: Math.floor(Math.random() * 3) + 5,
            discovered: false,
            start: false,
            depth: source.depth + 1
        };

        // based ont he direction place the room relative to the source room
        if (dir === Direction.NORTH) {
            // room to north
            newRoom.y = (source.y - newRoom.height) + 1;
            newRoom.x = (source.x + Math.floor(source.width / 2)) - Math.floor(newRoom.width / 2);
        } else if (dir === Direction.SOUTH) {
            // room to south
            newRoom.y = (source.y + source.height) - 1;
            newRoom.x = (source.x + Math.floor(source.width / 2)) - Math.floor(newRoom.width / 2);
        } else if (dir === Direction.WEST) {
            // room to west
            newRoom.x = (source.x - newRoom.width) + 1;
            newRoom.y = (source.y + Math.floor(source.height / 2)) - Math.floor(newRoom.height / 2);
        } else if (dir === Direction.EAST) {
            // room to east
            newRoom.x = (source.x + source.width) - 1;
            newRoom.y = (source.y + Math.floor(source.height / 2)) - Math.floor(newRoom.height / 2);
        }

        // find any room that intersects with our new room in the body
        const intersects = dungeon.rooms.filter(r => roomIntersection(newRoom, r));

        // If the room doesn't hit any others then place it and add a door
        if (intersects.length === 0) {
            dungeon.rooms.push(newRoom);
            if (dir === Direction.NORTH) {
                dungeon.doors.push({ x: source.x + Math.floor(source.width / 2), y: source.y, open: false });
            } else if (dir === Direction.SOUTH) {
                dungeon.doors.push({ x: source.x + Math.floor(source.width / 2), y: source.y + source.height - 1, open: false });
            } else if (dir === Direction.WEST) {
                dungeon.doors.push({ x: source.x, y: source.y + Math.floor(source.height / 2), open: false });
            } else if (dir === Direction.EAST) {
                dungeon.doors.push({ x: source.x + source.width - 1, y: source.y + Math.floor(source.height / 2), open: false });
            }

            // add a random monster to the room
            const mx = Math.floor(Math.random() * (newRoom.width - 2)) + 1 + newRoom.x;
            const my = Math.floor(Math.random() * (newRoom.height - 2)) + 1 + newRoom.y;

            dungeon.actors.push(createMonster(game, "goblin", dungeon.id, mx, my))
        }
    }

    return dungeon;
}

export function getDungeonById(state: GameState, id: number) {
    return state.dungeons.find(d => d.id === id);
}
export function blocked(dungeon: Dungeon, actor: Actor, x: number, y: number): boolean {
    const blockingActor = getActorAt(dungeon, x, y);
    if (blockingActor === actor) {
        return true;
    }
    if (blockingActor && blockingActor.good !== actor.good) {
        return true;
    }
    const door = getDoorAt(dungeon, x, y);
    if (door && door.open) {
        return false;
    }
    const room = getRoomAt(dungeon, x, y);
    if (!room) {
        return true;
    }
    if (room.start && x === room.width + room.x - 2 && y === room.y + 1) {
        return true;
    }
    if (x === room.x || y === room.y || x === room.x + room.width - 1 || y === room.y + room.height - 1) {
        return true;
    }
    if (!room.discovered) {
        return true;
    }

    return false;
}

function floodFillMoves(game: GameState, dungeon: Dungeon, actor: Actor, x: number, y: number, depth: number, max: number): void {
    if (depth > max) {
        return;
    }
    let existingMove = game.possibleMoves.find(m => m.x === x && m.y === y);

    const door = getDoorAt(dungeon, x, y);
    if (door && !door.open) {
        if (existingMove) {
            if (existingMove.depth > depth) {
                game.possibleMoves.splice(game.possibleMoves.indexOf(existingMove), 1);
                existingMove = undefined;
            }
        }
        if (!existingMove) {
            game.possibleMoves.push({ x, y, type: "open", depth });
        }
        return;
    }

    if (blocked(dungeon, actor, x, y)) {
        return;
    }

    if (existingMove) {
        if (existingMove.depth > depth) {
            game.possibleMoves.splice(game.possibleMoves.indexOf(existingMove), 1);
        } else {
            return;
        }
    }

    game.possibleMoves.push({ x, y, type: "move", depth });
    floodFillMoves(game, dungeon, actor, x + 1, y, depth + 1, max);
    floodFillMoves(game, dungeon, actor, x - 1, y, depth + 1, max);
    floodFillMoves(game, dungeon, actor, x, y + 1, depth + 1, max);
    floodFillMoves(game, dungeon, actor, x, y - 1, depth + 1, max);
}

export function calcMoves(game: GameState, actor: Actor): void {
    const dungeon = getDungeonById(game, actor.dungeonId);
    // Djk to find possible movements
    game.possibleMoves = [];
    if (dungeon) {
        floodFillMoves(game, dungeon, actor, actor.x + 1, actor.y, 1, actor.moves);
        floodFillMoves(game, dungeon, actor, actor.x - 1, actor.y, 1, actor.moves);
        floodFillMoves(game, dungeon, actor, actor.x, actor.y + 1, 1, actor.moves);
        floodFillMoves(game, dungeon, actor, actor.x, actor.y - 1, 1, actor.moves);
    }
}

export function getMoveAt(game: GameState, x: number, y: number): GameMove | undefined {
    return game.possibleMoves.find(m => m.x === x && m.y === y);
}

export function findNextStep(game: GameState, mover: Actor, x: number, y: number): GameMove | undefined {
    const targetMove = getMoveAt(game, x, y);
    if (targetMove) {
        let currentMove = targetMove;
        // keep going til we give up or we find the move thats next to our actor
        while (Math.abs(currentMove.x - mover.x) + Math.abs(currentMove.y - mover.y) !== 1) {
            // check down
            let nextMove = getMoveAt(game, currentMove.x, currentMove.y + 1);
            if (nextMove?.depth !== currentMove.depth - 1) {
                nextMove = undefined;
            }
            // check up
            if (!nextMove) {
                nextMove = getMoveAt(game, currentMove.x, currentMove.y - 1);
                if (nextMove?.depth !== currentMove.depth - 1) {
                    nextMove = undefined;
                }
            }
            // check right
            if (!nextMove) {
                nextMove = getMoveAt(game, currentMove.x + 1, currentMove.y);
                if (nextMove?.depth !== currentMove.depth - 1) {
                    nextMove = undefined;
                }
            }
            // check left
            if (!nextMove) {
                nextMove = getMoveAt(game, currentMove.x - 1, currentMove.y);
                if (nextMove?.depth !== currentMove.depth - 1) {
                    nextMove = undefined;
                }
            }
            // if we don't have a move now then its an invalid path
            if (!nextMove) {
                console.log("No move found");
                return undefined;
            }

            currentMove = nextMove;
        }

        // at this point we've got to the move next to the player so return it 
        return currentMove;
    } else {
        return undefined;
    }
}

export function getActorById(game: GameState, dungeonId: number, id: number): Actor | undefined {
    const dungeon = getDungeonById(game, dungeonId);
    if (dungeon) {
        return dungeon.actors.find(a => a.id === id);
    }

    return dungeon;
}

export function getDoorAt(dungeon: Dungeon, x: number, y: number): Door | undefined {
    return dungeon.doors.find(d => d.x === x && d.y === y);
}

export function getActorAt(dungeon: Dungeon, x: number, y: number): Actor | undefined {
    return dungeon.actors.find(a => a.x === x && a.y === y);
}

export function getRoomAt(dungeon: Dungeon, x: number, y: number): Room | undefined {
    const room = dungeon.rooms.find(room =>
        x >= room.x && y >= room.y && x < room.x + room.width && y < room.y + room.height
    );

    return room;
}

export function getAllRoomsAt(dungeon: Dungeon, x: number, y: number): Room[] {
    return dungeon.rooms.filter(room =>
        x >= room.x && y >= room.y && x < room.x + room.width && y < room.y + room.height
    );
}