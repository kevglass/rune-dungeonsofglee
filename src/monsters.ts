import { Actor, ActorDef, createActor } from "./actor";
import { Point, getDungeonById, getRoomAt } from "./dungeon";
import { Item, createItem } from "./items";
import { errorLog } from "./log";
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
        minLevel: 1,
        goldOnKill: {
            min: 1,
            max: 2
        },
        loot: [
            { type: "heal-potion", chance: 0.05, minLevel: 0 }
        ]
    },
    "wolf": {
        name: "Wolf",
        health: 1,
        attack: 1,
        defense: 2,
        magic: 0,
        moves: 6,
        sprite: 9,
        good: false,
        ranged: false,
        minLevel: 1,
        goldOnKill: {
            min: 1,
            max: 2
        },
        loot: [
            { type: "heal-potion", chance: 0.05, minLevel: 0 }
        ]
    },
    "bear": {
        name: "Bear",
        health: 1,
        attack: 2,
        defense: 2,
        magic: 0,
        moves: 6,
        sprite: 12,
        good: false,
        ranged: false,
        minLevel: 2,
        goldOnKill: {
            min: 2,
            max: 3
        },
        loot: [
            { type: "heal-potion", chance: 0.05, minLevel: 0 }
        ]
    },
    "skeleton": {
        name: "Skeleton",
        health: 2,
        attack: 2,
        defense: 3,
        magic: 0,
        moves: 6,
        sprite: 10,
        good: false,
        ranged: false,
        minLevel: 3,
        goldOnKill: {
            min: 2,
            max: 5
        },
        loot: [
            { type: "mana-potion", chance: 0.05, minLevel: 0 }
        ]
    },
    "ghost": {
        name: "Ghost",
        health: 2,
        attack: 2,
        defense: 2,
        magic: 0,
        moves: 6,
        sprite: 13,
        good: false,
        ranged: false,
        minLevel: 4,
        goldOnKill: {
            min: 2,
            max: 5
        },
        loot: [
            { type: "mana-potion", chance: 0.05, minLevel: 0 }
        ]
    },
    "bat": {
        name: "Bat",
        health: 2,
        attack: 2,
        defense: 1,
        magic: 0,
        moves: 8,
        sprite: 14,
        good: false,
        ranged: false,
        minLevel: 6,
        goldOnKill: {
            min: 2,
            max: 5
        },
        loot: [
        ]
    },
    "vampire": {
        name: "Vampire",
        health: 2,
        attack: 3,
        defense: 3,
        magic: 0,
        moves: 6,
        sprite: 11,
        good: false,
        ranged: false,
        minLevel: 8,
        goldOnKill: {
            min: 2,
            max: 5
        },
        loot: [
            { type: "mana-potion", chance: 0.05, minLevel: 0 }
        ]
    },
    "beholder": {
        name: "Beholder",
        health: 4,
        attack: 4,
        defense: 3,
        magic: 0,
        moves: 7,
        sprite: 15,
        good: false,
        ranged: false,
        minLevel: 10,
        goldOnKill: {
            min: 2,
            max: 5
        },
        loot: [
            { type: "mana-potion", chance: 0.05, minLevel: 0 }
        ]
    },
}

export function getRandomMonster(level: number): string {
    const possible: string[] = [];
    for (const defId in MONSTER_DEFS) {
        const def = MONSTER_DEFS[defId];

        if (def.minLevel !== undefined && level >= def.minLevel) {
            possible.push(defId)
        }
    }

    return possible[Math.floor(Math.random() * possible.length)];
}

export function createMonsterItemLoot(game: GameState, actor: Actor): Item | undefined {
    if (actor.loot) {
        for (const loot of actor.loot) {
            const dungeon = getDungeonById(game, actor.dungeonId);
            if (dungeon && dungeon.level >= loot.minLevel) {
                if (Math.random() < loot.chance) {
                    return createItem(game, loot.type);
                }
            }
        }
    }
    return undefined;
}

// utility method to just wrap up monster creation
export function createMonster(game: GameState, type: string, dungeonId: number, x: number, y: number): Actor {
    const def = MONSTER_DEFS[type];

    if (!def) {
        errorLog("Monster type: " + type + " not found");
    }
    return createActor(game, def, dungeonId, x, y);
}

// find any monsters that are potentially able to move at this point
export function findActiveMonsters(game: GameState): Actor[] {
    const result: Actor[] = [];

    game.dungeons.forEach((dungeon) => {
        if (dungeon.actors.find(a => a.good)) {
            result.push(...dungeon.actors.filter(a => !a.good && getRoomAt(dungeon, a.x, a.y)?.discovered));
        }
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