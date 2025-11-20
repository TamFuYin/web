export type BlockType = 'grass' | 'dirt' | 'stone' | 'wood' | 'leaves' | 'sand' | 'glass' | 'tnt';
export type ToolType = 'wooden_pickaxe' | 'stone_pickaxe';
export type ItemType = BlockType | ToolType;

export interface BlockDef {
    id: number;
    name: string;
    type: BlockType;
    color: string;
    texture?: string[];
    hardness: number; // Higher means slower to mine without tools
}

export interface ToolDef {
    id: number;
    name: string;
    type: ToolType;
    texture: string;
    efficiency: number; // Multiplier applied to block hardness for mining speed
}

export interface ItemStack {
    item: ItemType;
    count: number;
}

