import { GameState } from "./logic";
import { PlayerClass } from "./player";

export type ItemType = "heal-potion";

export interface ItemInfo {
    icon: number;
    onlyUsedBy?: PlayerClass[];
    sound?: string;
}

// evil internalised configuration that should
// be in asset management somewhere
const ITEMS: Record<ItemType, ItemInfo> = {
    "heal-potion": {
        icon: 76,
        sound: "glug"
    }
}

export function getItemInfo(type: ItemType): ItemInfo {
    return ITEMS[type];
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

export function removeItemFromInventory(game: GameState, type: ItemType) {
    const item = game.items.find(i => i.type === type);
    if (item) {
        if (item.count === 1) {
            game.items.splice(game.items.indexOf(item), 1);
        } else {
            item.count--;
        }
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