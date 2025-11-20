import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
export class InputManager {
    public controls: PointerLockControls;
    public moveState = { forward: false, backward: false, left: false, right: false };
    public jump = false;
    public sprint = false;

    private hotbarSize: number;
    private onSelectSlot: (index: number) => void;
    private onPlaceBlock: () => void;
    private onBreakStart: () => void;
    private onBreakEnd: () => void;
    private onScrollSlot: (delta: number) => void;
    private onOpenConsole: (prefill?: string) => void;

    constructor(camera: THREE.Camera, domElement: HTMLElement, options: {
        hotbarSize: number;
        onSelectSlot: (index: number) => void;
        onPlaceBlock: () => void;
        onBreakStart: () => void;
        onBreakEnd: () => void;
        onScrollSlot: (delta: number) => void;
        onOpenConsole: (prefill?: string) => void;
    }) {
        this.controls = new PointerLockControls(camera, domElement);
        this.hotbarSize = options.hotbarSize;
        this.onSelectSlot = options.onSelectSlot;
        this.onPlaceBlock = options.onPlaceBlock;
        this.onBreakStart = options.onBreakStart;
        this.onBreakEnd = options.onBreakEnd;
        this.onScrollSlot = options.onScrollSlot;
        this.onOpenConsole = options.onOpenConsole;

        this.addEventListeners();
    }

    private onKeyDown = (e: KeyboardEvent) => {
        if (this.controls.isLocked && e.code === 'Space') {
            e.preventDefault();
        }
        switch (e.code) {
            case 'KeyW': this.moveState.forward = true; break;
            case 'KeyA': this.moveState.left = true; break;
            case 'KeyS': this.moveState.backward = true; break;
            case 'KeyD': this.moveState.right = true; break;
            case 'Space': this.jump = true; break;
            case 'ShiftLeft': this.sprint = true; break;
        }

        let digit = -1;
        if (e.code.startsWith('Digit')) {
            digit = parseInt(e.code.slice(5), 10);
        } else if (e.code.startsWith('Numpad')) {
            digit = parseInt(e.code.slice(6), 10);
        }

        if (digit > 0 && digit <= this.hotbarSize) {
            this.onSelectSlot(digit - 1);
        }

        if (e.code === 'KeyT' || e.code === 'Slash') {
            e.preventDefault();
            this.onOpenConsole(e.code === 'Slash' ? '/' : '');
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
            case 'ShiftRight': this.sprint = false; break;
        }
    };

    private onMouseDown = (event: MouseEvent) => {
        if (!this.controls.isLocked) return;
        if (event.button === 0) { // Left click
            this.onBreakStart();
        } else if (event.button === 2) { // Right click
            this.onPlaceBlock();
        }
    };

    private onMouseUp = (event: MouseEvent) => {
        if (event.button === 0) {
            this.onBreakEnd();
        }
    };

    private onWheel = (event: WheelEvent) => {
        if (!this.controls.isLocked) return;
        event.preventDefault(); // Prevent page scrolling
        const delta = Math.sign(event.deltaY);
        if (delta !== 0) {
            this.onScrollSlot(delta);
        }
    };

    private addEventListeners() {
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
        document.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('wheel', this.onWheel, { passive: false });
    }

    public dispose() {
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
        document.removeEventListener('mousedown', this.onMouseDown);
        document.removeEventListener('mouseup', this.onMouseUp);
        document.removeEventListener('wheel', this.onWheel);
        this.controls.dispose();
    }
}
