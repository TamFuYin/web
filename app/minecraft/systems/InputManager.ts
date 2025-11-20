import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { BlockType } from '../types';
import { BLOCKS } from '../constants';

export class InputManager {
    public controls: PointerLockControls;
    public moveState = { forward: false, backward: false, left: false, right: false };
    public jump = false;
    public sprint = false;

    private onSelectBlock: (block: BlockType) => void;
    private onPlaceBlock: () => void;
    private onRemoveBlock: () => void;

    constructor(camera: THREE.Camera, domElement: HTMLElement, callbacks: {
        onSelectBlock: (block: BlockType) => void,
        onPlaceBlock: () => void,
        onRemoveBlock: () => void
    }) {
        this.controls = new PointerLockControls(camera, domElement);
        this.onSelectBlock = callbacks.onSelectBlock;
        this.onPlaceBlock = callbacks.onPlaceBlock;
        this.onRemoveBlock = callbacks.onRemoveBlock;

        this.addEventListeners();
    }

    private onKeyDown = (e: KeyboardEvent) => {
        switch (e.code) {
            case 'KeyW': this.moveState.forward = true; break;
            case 'KeyA': this.moveState.left = true; break;
            case 'KeyS': this.moveState.backward = true; break;
            case 'KeyD': this.moveState.right = true; break;
            case 'Space': this.jump = true; break;
            case 'ShiftLeft': this.sprint = true; break;
        }

        if (e.code.startsWith('Digit')) {
            const digit = parseInt(e.code.slice(5), 10);
            const blockTypes = Object.values(BLOCKS).map(b => b.type);
            if (digit > 0 && digit <= blockTypes.length) {
                this.onSelectBlock(blockTypes[digit - 1]);
            }
        }
    };

    private onKeyUp = (e: KeyboardEvent) => {
        switch (e.code) {
            case 'KeyW': this.moveState.forward = false; break;
            case 'KeyA': this.moveState.left = false; break;
            case 'KeyS': this.moveState.backward = false; break;
            case 'KeyD': this.moveState.right = false; break;
            case 'Space': this.jump = false; break;
            case 'ShiftLeft': this.sprint = false; break;
        }
    };

    private onMouseDown = (event: MouseEvent) => {
        if (!this.controls.isLocked) return;
        if (event.button === 0) { // Left click
            this.onRemoveBlock();
        } else if (event.button === 2) { // Right click
            this.onPlaceBlock();
        }
    };

    private addEventListeners() {
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
        document.addEventListener('mousedown', this.onMouseDown);
    }

    public dispose() {
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
        document.removeEventListener('mousedown', this.onMouseDown);
        this.controls.dispose();
    }
}
