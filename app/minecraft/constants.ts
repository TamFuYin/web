import { BlockDef, BlockType } from './types';

export const GRAVITY = 30.0;
export const JUMP_FORCE = 10.0;
export const SPEED = 5.0;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_WIDTH = 0.4;
export const EYE_HEIGHT = 1.6;

export const BLOCKS: Record<BlockType, BlockDef> = {
    grass: { id: 1, name: 'Grass', type: 'grass', color: '#567d46', texture: ['/textures/grass_side.png', '/textures/grass_side.png', '/textures/grass_top.png', '/textures/dirt.png', '/textures/grass_side.png', '/textures/grass_side.png'] },
    dirt: { id: 2, name: 'Dirt', type: 'dirt', color: '#5d4037', texture: ['/textures/dirt.png', '/textures/dirt.png', '/textures/dirt.png', '/textures/dirt.png', '/textures/dirt.png', '/textures/dirt.png'] },
    stone: { id: 3, name: 'Stone', type: 'stone', color: '#757575', texture: ['/textures/stone.png', '/textures/stone.png', '/textures/stone.png', '/textures/stone.png', '/textures/stone.png', '/textures/stone.png'] },
    wood: { id: 4, name: 'Wood', type: 'wood', color: '#5d4037', texture: ['/textures/wood_side.png', '/textures/wood_side.png', '/textures/wood_top.png', '/textures/wood_top.png', '/textures/wood_side.png', '/textures/wood_side.png'] },
    leaves: { id: 5, name: 'Leaves', type: 'leaves', color: '#388e3c', texture: ['/textures/leaves.png', '/textures/leaves.png', '/textures/leaves.png', '/textures/leaves.png', '/textures/leaves.png', '/textures/leaves.png'] },
    sand: { id: 6, name: 'Sand', type: 'sand', color: '#e1c699', texture: ['/textures/sand.png', '/textures/sand.png', '/textures/sand.png', '/textures/sand.png', '/textures/sand.png', '/textures/sand.png'] },
    glass: { id: 7, name: 'Glass', type: 'glass', color: '#ffffff', texture: ['/textures/glass.png', '/textures/glass.png', '/textures/glass.png', '/textures/glass.png', '/textures/glass.png', '/textures/glass.png'] },
    tnt: { id: 8, name: 'TNT', type: 'tnt', color: '#db3e3e', texture: ['/textures/tnt_side.png', '/textures/tnt_side.png', '/textures/tnt_top.png', '/textures/tnt_top.png', '/textures/tnt_side.png', '/textures/tnt_side.png'] },
};

export const BLOCK_TYPES = Object.values(BLOCKS).map(b => b.type);
