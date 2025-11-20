export type BlockType = 'grass' | 'dirt' | 'stone' | 'wood' | 'leaves' | 'sand' | 'glass' | 'tnt';

export interface BlockDef {
    id: number;
    name: string;
    type: BlockType;
    color: string;
    texture?: string[];
}
