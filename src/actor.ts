import { GameState } from "./logic";

// The definition of a actor type describing its attributes
// at creation
export interface ActorDef {
    name: string;
    health: number;
    attack: number;
    defense: number;
    magic: number;
    moves: number;
    icon: number;
    good: boolean;
}

// An actor is a player or monsters in the world. They have stats
// and the ability to take moves
export interface Actor {
    id: number;
    x: number;
    y: number;
    icon: number;
    playerId: string;
    good: boolean;
    lx: number;
    ly: number;
    lt: number;
    moves: number;
    maxMoves: number;
    health: number;
    attacks: number;
    magic: number;
    attack: number;
    defense: number;
    maxMagic: number;
    dungeonId: number;
}

// create a new actor in a specific dungeon with some initial characteristics. This is used for both
// players and monsters.
export function createActor(game: GameState, def: ActorDef, dungeonId: number, x: number, y: number): Actor {
    return {
        id: game.nextId++,
        x: x,
        y: y,
        lx: x,
        ly: y,
        lt: 0,
        icon: def.icon,
        playerId: "",
        good: def.good,
        health: def.health,
        attack: def.attack,
        defense: def.defense,
        moves: def.moves,
        maxMoves: def.moves,
        attacks: 1,
        magic: def.magic,
        maxMagic: def.magic,
        dungeonId: dungeonId
    };
}