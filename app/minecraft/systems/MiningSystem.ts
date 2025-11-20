import * as THREE from 'three';
import { BLOCKS, TOOLS } from '../constants';
import { BlockType, ItemStack, ItemType, ToolType } from '../types';
import { WorldManager } from './WorldManager';

interface MiningTarget {
    position: THREE.Vector3;
    type: BlockType;
}

interface MiningSystemOptions {
    getSelectedStack: () => ItemStack | null;
    onBlockBroken: (target: MiningTarget) => void;
}

const BASE_BREAK_TIME = 0.8; // seconds, multiplied by block hardness / tool efficiency
const NOISE_TEXTURE_SIZE = 32;

export class MiningSystem {
    private overlayMesh: THREE.Mesh | null = null;
    private overlayTexture: THREE.CanvasTexture;
    private overlayContext: CanvasRenderingContext2D;
    private overlayPixels: ImageData;
    private currentNoiseLevel = 0;

    private breaking = false;
    private progress = 0;
    private requiredTime = 1;
    private target: MiningTarget | null = null;

    constructor(
        private scene: THREE.Scene,
        private world: WorldManager,
        private options: MiningSystemOptions
    ) {
        const canvas = document.createElement('canvas');
        canvas.width = NOISE_TEXTURE_SIZE;
        canvas.height = NOISE_TEXTURE_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Unable to create mining overlay context');
        }
        this.overlayContext = ctx;
        this.overlayPixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        this.overlayTexture = new THREE.CanvasTexture(canvas);
        this.overlayTexture.colorSpace = THREE.SRGBColorSpace;
        this.overlayTexture.magFilter = THREE.NearestFilter;
        this.overlayTexture.minFilter = THREE.NearestFilter;
    }

    public startBreaking(camera: THREE.Camera, raycaster: THREE.Raycaster, objects: THREE.Object3D[]): boolean {
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const intersects = raycaster.intersectObjects(objects);
        if (!intersects.length) return false;

        const hit = intersects[0];
        if (!hit.face) return false;
        const point = hit.point.clone().sub(hit.face.normal.multiplyScalar(0.1));
        const targetPos = new THREE.Vector3(
            Math.floor(point.x),
            Math.floor(point.y),
            Math.floor(point.z)
        );

        const block = this.world.getBlock(targetPos.x, targetPos.y, targetPos.z);
        if (!block) return false;

        const blockDef = BLOCKS[block.type];
        if (!blockDef) return false;

        const selectedStack = this.options.getSelectedStack();
        const hasTool = selectedStack && this.isTool(selectedStack.item);

        if (block.type === 'stone' && !hasTool) {
            return false;
        }

        const efficiency = hasTool
            ? TOOLS[selectedStack!.item as ToolType].efficiency
            : 1;
        this.requiredTime = Math.max(0.15, BASE_BREAK_TIME * blockDef.hardness / efficiency);

        this.target = {
            position: targetPos,
            type: block.type,
        };
        this.progress = 0;
        this.breaking = true;
        this.currentNoiseLevel = 0;
        this.resetOverlay();
        this.ensureOverlayMesh();
        this.overlayMesh!.visible = true;
        this.overlayMesh!.position.set(targetPos.x + 0.5, targetPos.y + 0.5, targetPos.z + 0.5);

        return true;
    }

    public stopBreaking() {
        this.breaking = false;
        this.progress = 0;
        this.target = null;
        if (this.overlayMesh) {
            this.overlayMesh.visible = false;
        }
    }

    public update(delta: number) {
        if (!this.breaking || !this.target) return;
        this.progress += delta;
        const ratio = Math.min(1, this.progress / this.requiredTime);
        this.applyNoise(ratio);

        if (this.progress >= this.requiredTime) {
            this.options.onBlockBroken(this.target);
            this.stopBreaking();
        }
    }

    public dispose() {
        if (this.overlayMesh) {
            this.scene.remove(this.overlayMesh);
            this.overlayMesh.geometry.dispose();
            (this.overlayMesh.material as THREE.Material).dispose();
        }
        this.overlayTexture.dispose();
    }

    private ensureOverlayMesh() {
        if (this.overlayMesh) return;
        const geometry = new THREE.BoxGeometry(1.02, 1.02, 1.02);
        const material = new THREE.MeshBasicMaterial({
            map: this.overlayTexture,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
        });
        this.overlayMesh = new THREE.Mesh(geometry, material);
        this.overlayMesh.visible = false;
        this.scene.add(this.overlayMesh);
    }

    private resetOverlay() {
        const data = this.overlayPixels.data;
        data.fill(0);
        this.overlayContext.putImageData(this.overlayPixels, 0, 0);
        this.overlayTexture.needsUpdate = true;
    }

    private applyNoise(level: number) {
        if (level <= this.currentNoiseLevel) return;
        const totalPixels = NOISE_TEXTURE_SIZE * NOISE_TEXTURE_SIZE;
        const previousCount = Math.floor(this.currentNoiseLevel * totalPixels);
        const nextCount = Math.floor(level * totalPixels);
        const delta = nextCount - previousCount;
        const data = this.overlayPixels.data;

        for (let i = 0; i < delta; i++) {
            const idx = Math.floor(Math.random() * totalPixels);
            const offset = idx * 4;
            data[offset] = 0;
            data[offset + 1] = 0;
            data[offset + 2] = 0;
            data[offset + 3] = 220;
        }

        this.overlayContext.putImageData(this.overlayPixels, 0, 0);
        this.overlayTexture.needsUpdate = true;
        this.currentNoiseLevel = level;
    }

    private isTool(item: ItemType): item is ToolType {
        return Object.prototype.hasOwnProperty.call(TOOLS, item);
    }
}
