import { Actor, ActorDef, createActor } from "./actor";
import { GameState } from "./logic";

const MONSTER_DEFS: Record<string, ActorDef> = {
    "goblin": {
        name: "Goblin",
        health: 1,
        attack: 1,
        defense: 1, 
        magic: 0,
        moves: 5,
        icon: 8
    }
}

export function createMonster(game: GameState, type: string, dungeonId: number, x: number, y: number): Actor {
    const def = MONSTER_DEFS[type];

    return createActor(game, def, dungeonId, x, y);
}