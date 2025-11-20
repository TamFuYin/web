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

export class WorldManager {
    private scene: THREE.Scene;
    private world = new Map<string, { mesh: THREE.Mesh, type: BlockType }>();
    private objects: THREE.Object3D[] = [];
    private materials = new Map<string, THREE.Material | THREE.Material[]>();
    private geometry = new THREE.BoxGeometry(1, 1, 1);
    private noise = new SimpleNoise();

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.loadTextures();
        this.generateTerrain();
    }

    private textureLoader = new THREE.TextureLoader();

    private loadTextures() {
        Object.values(BLOCKS).forEach(block => {
            if (block.texture && block.texture.length === 6) {
                const mats = block.texture.map(t => {
                    const tex = this.textureLoader.load(t);
                    tex.magFilter = THREE.NearestFilter;
                    tex.minFilter = THREE.NearestFilter;
                    tex.colorSpace = THREE.SRGBColorSpace;
                    return new THREE.MeshLambertMaterial({ map: tex });
                });
                this.materials.set(block.type, mats);
            } else {
                // Fallback for single texture definitions if any (though we standardized to 6)
                const texPath = block.texture ? block.texture[0] : '';
                const tex = this.textureLoader.load(texPath);
                tex.magFilter = THREE.NearestFilter;
                tex.minFilter = THREE.NearestFilter;
                tex.colorSpace = THREE.SRGBColorSpace;

                const isGlass = block.type === 'glass';
                this.materials.set(block.type, new THREE.MeshLambertMaterial({
                    map: tex,
                    transparent: isGlass,
                    opacity: isGlass ? 0.5 : 1,
                    side: isGlass ? THREE.DoubleSide : THREE.FrontSide
                }));
            }
        });
    }

    private getBlockKey(x: number, y: number, z: number) {
        return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    }

    public getBlock(x: number, y: number, z: number) {
        return this.world.get(this.getBlockKey(x, y, z));
    }

    public addBlock(x: number, y: number, z: number, type: BlockType) {
        x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
        const key = this.getBlockKey(x, y, z);
        if (this.world.has(key)) return;

        const mat = this.materials.get(type);
        if (!mat) return;

        const mesh = new THREE.Mesh(this.geometry, mat);
        mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        this.world.set(key, { mesh, type });
        this.objects.push(mesh);
    }

    public removeBlock(x: number, y: number, z: number) {
        x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
        const key = this.getBlockKey(x, y, z);
        const block = this.world.get(key);
        if (!block) return;

        this.scene.remove(block.mesh);
        // Note: We don't dispose materials here as they are shared
        // block.mesh.geometry.dispose(); // Geometry is shared too
        this.world.delete(key);
        const idx = this.objects.indexOf(block.mesh);
        if (idx > -1) this.objects.splice(idx, 1);
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
        return this.objects;
    }

    public dispose() {
        this.world.forEach(block => {
            this.scene.remove(block.mesh);
        });
        this.world.clear();
        this.objects = [];
        this.materials.forEach(mat => {
            if (Array.isArray(mat)) {
                mat.forEach(m => {
                    if ((m as any).map) (m as any).map.dispose();
                    m.dispose();
                });
            } else {
                if ((mat as any).map) (mat as any).map.dispose();
                mat.dispose();
            }
        });
        this.materials.clear();
        this.geometry.dispose();
    }
}
