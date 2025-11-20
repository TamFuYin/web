import * as THREE from 'three';
import { BlockType } from '../types';
import { BLOCKS } from '../constants';

class SimpleNoise {
    noise2D(x: number, y: number) {
        const sin = Math.sin(x * 0.1 + y * 0.1) * 5;
        const cos = Math.cos(x * 0.05 - y * 0.05) * 5;
        return Math.sin(x * 0.05) + Math.cos(y * 0.05) + (sin + cos) * 0.2;
    }
}

const MAX_INSTANCES = 50000;

export class WorldManager {
    private scene: THREE.Scene;
    // Map coordinate "x,y,z" to { type, instanceId }
    private blockMap = new Map<string, { type: BlockType, instanceId: number }>();

    private meshes = new Map<BlockType, THREE.InstancedMesh>();
    private counts = new Map<BlockType, number>();

    private geometry = new THREE.BoxGeometry(1, 1, 1);
    private noise = new SimpleNoise();
    private textureLoader = new THREE.TextureLoader();
    private dummy = new THREE.Object3D();

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.initMeshes();
        this.generateTerrain();
    }

    private initMeshes() {
        Object.values(BLOCKS).forEach(block => {
            let material: THREE.Material | THREE.Material[];

            if (block.texture && block.texture.length === 6) {
                material = block.texture.map(t => {
                    const tex = this.textureLoader.load(t);
                    tex.magFilter = THREE.NearestFilter;
                    tex.minFilter = THREE.NearestFilter;
                    tex.colorSpace = THREE.SRGBColorSpace;
                    return new THREE.MeshLambertMaterial({ map: tex });
                });
            } else {
                const texPath = block.texture ? block.texture[0] : '';
                const tex = this.textureLoader.load(texPath);
                tex.magFilter = THREE.NearestFilter;
                tex.minFilter = THREE.NearestFilter;
                tex.colorSpace = THREE.SRGBColorSpace;

                const isGlass = block.type === 'glass';
                material = new THREE.MeshLambertMaterial({
                    map: tex,
                    transparent: isGlass,
                    opacity: isGlass ? 0.5 : 1,
                    side: isGlass ? THREE.DoubleSide : THREE.FrontSide
                });
            }

            const mesh = new THREE.InstancedMesh(this.geometry, material, MAX_INSTANCES);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.count = 0; // Start with 0 visible
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

            this.scene.add(mesh);
            this.meshes.set(block.type, mesh);
            this.counts.set(block.type, 0);
        });
    }

    private getBlockKey(x: number, y: number, z: number) {
        return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    }

    public getBlock(x: number, y: number, z: number) {
        return this.blockMap.get(this.getBlockKey(x, y, z));
    }

    public addBlock(x: number, y: number, z: number, type: BlockType) {
        x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
        const key = this.getBlockKey(x, y, z);
        if (this.blockMap.has(key)) return;

        const mesh = this.meshes.get(type);
        const count = this.counts.get(type) || 0;

        if (!mesh || count >= MAX_INSTANCES) {
            console.warn(`Max instances reached for ${type}`);
            return;
        }

        this.dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(count, this.dummy.matrix);
        mesh.count = count + 1;
        mesh.instanceMatrix.needsUpdate = true;

        this.blockMap.set(key, { type, instanceId: count });
        this.counts.set(type, count + 1);
    }

    public removeBlock(x: number, y: number, z: number) {
        x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
        const key = this.getBlockKey(x, y, z);
        const block = this.blockMap.get(key);
        if (!block) return;

        const mesh = this.meshes.get(block.type);
        const count = this.counts.get(block.type) || 0;

        if (!mesh || count === 0) return;

        // Swap with last instance to fill gap
        const lastInstanceId = count - 1;

        // If the removed block is not the last one, we need to move the last one to this slot
        if (block.instanceId !== lastInstanceId) {
            const lastMatrix = new THREE.Matrix4();
            mesh.getMatrixAt(lastInstanceId, lastMatrix);
            mesh.setMatrixAt(block.instanceId, lastMatrix);

            // Find the block that was at the last position and update its ID
            // This is slow (O(N)), but for a simple clone it's acceptable. 
            // To optimize, we could store a reverse map: Map<instanceId, key> per block type.
            // Let's do the reverse search for now.
            for (const [k, v] of this.blockMap.entries()) {
                if (v.type === block.type && v.instanceId === lastInstanceId) {
                    v.instanceId = block.instanceId;
                    this.blockMap.set(k, v);
                    break;
                }
            }
        }

        mesh.count = count - 1;
        mesh.instanceMatrix.needsUpdate = true;

        this.counts.set(block.type, count - 1);
        this.blockMap.delete(key);
    }

    public generateTerrain() {
        // Generate base terrain (64x64)
        for (let x = -32; x < 32; x++) {
            for (let z = -32; z < 32; z++) {
                const h = Math.floor(this.noise.noise2D(x, z) * 4) + 4;
                this.addBlock(x, 0, z, 'stone');
                for (let y = 1; y <= h; y++) {
                    this.addBlock(x, y, z, y === h ? 'grass' : 'dirt');
                }
            }
        }

        // Generate trees
        for (let x = -32; x < 32; x++) {
            for (let z = -32; z < 32; z++) {
                const h = Math.floor(this.noise.noise2D(x, z) * 4) + 4;
                // 5% chance to spawn a tree on grass
                if (Math.random() < 0.05 && this.getBlock(x, h, z)?.type === 'grass') {
                    this.generateTree(x, h + 1, z);
                }
            }
        }
    }

    private generateTree(x: number, y: number, z: number) {
        const trunkHeight = 4 + Math.floor(Math.random() * 3); // 4-6 blocks

        // Generate trunk
        for (let i = 0; i < trunkHeight; i++) {
            this.addBlock(x, y + i, z, 'wood');
        }

        // Generate leaves (3x3x3 cube around top of trunk)
        const leavesY = y + trunkHeight - 1;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dz = -1; dz <= 1; dz++) {
                    // Skip the center trunk block
                    if (dx === 0 && dy === 0 && dz === 0) continue;
                    this.addBlock(x + dx, leavesY + dy, z + dz, 'leaves');
                }
            }
        }

        // Add extra layer on top
        this.addBlock(x, leavesY + 2, z, 'leaves');
    }

    public getObjects() {
        // Raycaster needs meshes to intersect against
        // InstancedMesh is a Mesh, so we can return the array of meshes
        return Array.from(this.meshes.values());
    }

    public dispose() {
        this.meshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.dispose();
        });
        this.meshes.clear();
        this.blockMap.clear();
        this.counts.clear();
        this.geometry.dispose();
    }
}
