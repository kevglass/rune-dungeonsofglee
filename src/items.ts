export type ItemType = "heal-potion";

export interface Item {
    id: number;
    count: number;
    type: ItemType;
}