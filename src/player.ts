import { ActorDef } from "./actor";

export type PlayerClass = "dwarf" | "witch" | "elf" | "knight";

// the initial stats for the player characters
// dwarf is strongest but slow
// witch is weak but has magic
// elf is average but fast and ranged
// knight is strong but not so slow
export const PLAYER_CLASS_DEFS: Record<PlayerClass, ActorDef> = {
    "dwarf": {
        name: "Dwarf",
        sprite: 0,
        health: 5,
        attack: 4,
        defense: 4,
        magic: 0,
        moves: 5,
        good: true,
        ranged: false,
    },
    "witch": {
        name: "Witch",
        sprite: 1,
        health: 3,
        attack: 2,
        defense: 1,
        magic: 5,
        moves: 6,
        good: true,
        ranged: false,
    },
    "elf": {
        name: "elf",
        sprite: 2,
        health: 4,
        attack: 2,
        defense: 2,
        magic: 0,
        moves: 7,
        good: true,
        ranged: true,
    },
    "knight": {
        name: "Knight",
        sprite: 3,
        health: 5,
        attack: 4,
        defense: 3,
        magic: 0,
        moves: 6,
        good: true,
        ranged: false,
    }
}

// The information held for each player in the game
export interface PlayerInfo {
  type: PlayerClass;
  actorId: number;
  dungeonId: number;
}

