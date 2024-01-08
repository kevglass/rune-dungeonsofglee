import { Actor, ActorDef, createActor } from "./actor";
import { getRoomAt } from "./dungeon";
import { GameState } from "./logic";

// the list of monsters that can appear in the game
const MONSTER_DEFS: Record<string, ActorDef> = {
    "goblin": {
        name: "Goblin",
        health: 1,
        attack: 1,
        defense: 1, 
        magic: 0,
        moves: 5,
        icon: 8,
        good: false,
    }
}

// utility method to just wrap up monster creation
export function createMonster(game: GameState, type: string, dungeonId: number, x: number, y: number): Actor {
    const def = MONSTER_DEFS[type];

    return createActor(game, def, dungeonId, x, y);
}

// find any monsters that are potentially able to move at this point
export function findActiveMonsters(game: GameState): Actor[] {
    const result: Actor[] = [];

    game.dungeons.forEach((dungeon) => {
        result.push(...dungeon.actors.filter(a => !a.good && getRoomAt(dungeon, a.x, a.y)?.discovered));
    });

    return result;
}