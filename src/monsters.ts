import { Actor, ActorDef, createActor } from "./actor";
import { Point, getDungeonById, getRoomAt } from "./dungeon";
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
        sprite: 8,
        good: false,
        ranged: false,
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

export function standingNextToHero(game: GameState, monster: Actor): boolean {
    return distanceToHero(game, monster.dungeonId, monster) === 1;
}

export function distanceToHero(game: GameState, dungeonId: number, point: Point): number {
    let best = 10000;
    const dungeon = getDungeonById(game, dungeonId);
    if (dungeon) {
        dungeon.actors.filter(a => a.good).forEach(a => {
            const distance = Math.abs(point.x - a.x) + Math.abs(point.y - a.y);
            if (distance < best) {
                best = distance;
            }
        });
    }

    return best;
}

export function getAdjacentHero(game: GameState, dungeonId: number, point: Point): Actor | undefined {
    const dungeon = getDungeonById(game, dungeonId);
    if (dungeon) {
        const possible: Actor[] = [];
        dungeon.actors.filter(a => a.good).forEach(a => {
            const distance = Math.abs(point.x - a.x) + Math.abs(point.y - a.y);
            if (distance === 1) {
                possible.push(a);
            }
        });

        if (possible.length > 0) {
            return possible[Math.floor(Math.random() * possible.length)];
        }
    }

    return undefined;
}