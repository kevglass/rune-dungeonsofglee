import { GameState } from "./logic";

export type ItemType = "heal-potion";

// evil internalised configuration that should
// be in asset management somewhere
const ITEM_ICONS: Record<ItemType, number> = {
    "heal-potion": 76,
}

export function getItemIcon(type: ItemType): number {
    return ITEM_ICONS[type];
}

export interface Item {
    id: number;
    count: number;
    type: ItemType;
}

export interface ItemChance {
    type: ItemType;
    chance: number;
}

export function createItem(game: GameState, type: ItemType) {
    return {
        id: game.nextId++,
        count: 1,
        type
    }
}

export function addItemToInvetory(game: GameState, item: Item) {
    const existing = game.items.find(i => i.type === item.type);
    if (existing) {
        existing.count += item.count;
    } else {
        game.items.push(item);
    }
}

const ITEM_IN_CHEST_CHANCE = [
    { type: "heal-potion", chance: 1 }
];

export function rollChestItem(): ItemType {
    for (const chance of ITEM_IN_CHEST_CHANCE) {
        if (Math.random() < chance.chance) {
            return chance.type as ItemType;
        }
    }

    return "heal-potion";
}