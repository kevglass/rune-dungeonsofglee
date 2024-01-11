import { ItemType } from "./items";
import { GameState } from "./logic";

export interface MinMax {
    min: number;
    max: number;
}

export interface ItemChance {
    chance: number;
    item: ItemType;
}

// The definition of a actor type describing its attributes
// at creation
export interface ActorDef {
    name: string;
    health: number;
    attack: number;
    defense: number;
    magic: number;
    moves: number;
    sprite: number;
    good: boolean;
    ranged: boolean;
    goldOnKill?: MinMax;
    loot?: ItemChance[];
}

// An actor is a player or monsters in the world. They have stats
// and the ability to take moves
export interface Actor {
    id: number;
    x: number;
    y: number;
    sprite: number;
    playerId: string;
    good: boolean;
    lx: number;
    ly: number;
    lt: number;
    moves: number;
    maxMoves: number;
    health: number;
    maxHealth: number;
    actions: number;
    magic: number;
    attack: number;
    defense: number;
    maxMagic: number;
    dungeonId: number;
    facingRight: boolean;
    ranged: boolean;
    goldOnKill?: MinMax;
    loot?: ItemChance[];
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
        sprite: def.sprite,
        playerId: "",
        good: def.good,
        health: def.health,
        maxHealth: def.health,
        attack: def.attack,
        defense: def.defense,
        moves: def.moves,
        maxMoves: def.moves,
        actions: 1,
        magic: def.magic,
        maxMagic: def.magic,
        dungeonId: dungeonId,
        facingRight: true,
        ranged: def.ranged,
        goldOnKill: def.goldOnKill,
        loot: def.loot
    };
}

export function copyActor(actor: Actor): Actor {
    const copy = {};
    Object.assign(copy, actor);

    return copy as Actor;
}