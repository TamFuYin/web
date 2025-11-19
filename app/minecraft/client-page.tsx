"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

// =========================================
// TYPES & CONSTANTS
// =========================================

type BlockType = 'grass' | 'dirt' | 'stone' | 'wood' | 'leaves' | 'sand' | 'glass' | 'tnt';

interface BlockDef {
    id: number;
    name: string;
    type: BlockType;
    color: string;
    texture?: string[];
}

const BLOCKS: Record<BlockType, BlockDef> = {
    grass: { id: 1, name: 'Grass', type: 'grass', color: '#567d46', texture: ['grass_side', 'grass_side', 'grass_top', 'dirt', 'grass_side', 'grass_side'] },
    dirt: { id: 2, name: 'Dirt', type: 'dirt', color: '#5d4037', texture: ['dirt'] },
    stone: { id: 3, name: 'Stone', type: 'stone', color: '#757575', texture: ['stone'] },
    wood: { id: 4, name: 'Wood', type: 'wood', color: '#5d4037', texture: ['log_oak'] },
    leaves: { id: 5, name: 'Leaves', type: 'leaves', color: '#388e3c', texture: ['leaves_oak'] },
    sand: { id: 6, name: 'Sand', type: 'sand', color: '#e1c699', texture: ['sand'] },
    glass: { id: 7, name: 'Glass', type: 'glass', color: '#ffffff', texture: ['glass'] },
    tnt: { id: 8, name: 'TNT', type: 'tnt', color: '#db3e3e', texture: ['tnt_side', 'tnt_side', 'tnt_top', 'tnt_bottom', 'tnt_side', 'tnt_side'] },
};
const blockTypes = Object.values(BLOCKS).map(b => b.type);

// CONFIGURATION
const GRAVITY = 30.0;
const JUMP_FORCE = 8.0;
const SPEED = 5.0; 
const PLAYER_HEIGHT = 1.8;
const PLAYER_WIDTH = 0.4;

// =========================================
// UTILITIES
// =========================================

class SimpleNoise {
    noise2D(x: number, y: number) {
        const sin = Math.sin(x * 0.1 + y * 0.1) * 5;
        const cos = Math.cos(x * 0.05 - y * 0.05) * 5;
        return Math.sin(x * 0.05) + Math.cos(y * 0.05) + (sin + cos) * 0.2;
    }
}
const noise = new SimpleNoise();

// =========================================
// ASSET MANAGER
// =========================================

const createProceduralTexture = (colorHex: string) => {
    if (typeof document === 'undefined') return new THREE.Texture();
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();

    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, 64, 64);

    for (let i = 0; i < 200; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
        ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.1})`;
        ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
};

const loadTextures = () => {
    const matMap = new Map<string, THREE.Material | THREE.Material[]>();
    Object.values(BLOCKS).forEach(block => {
        if (block.texture && block.texture.length === 6) {
            const mats = block.texture.map(t => {
                const color = (t.includes('grass_top')) ? '#567d46' : (t.includes('dirt') ? '#5d4037' : block.color);
                return new THREE.MeshLambertMaterial({ map: createProceduralTexture(color) });
            });
            matMap.set(block.type, mats);
        } else {
            const map = createProceduralTexture(block.color);
            const isGlass = block.type === 'glass';
            matMap.set(block.type, new THREE.MeshLambertMaterial({ map, transparent: isGlass, opacity: isGlass ? 0.5 : 1 }));
        }
    });
    return matMap;
};

// =========================================
// MAIN COMPONENT
// =========================================

export default function MinecraftGame() {
    const mountRef = useRef<HTMLDivElement>(null);
    const controlsRef = useRef<PointerLockControls | null>(null);
    const [isLocked, setIsLocked] = useState(false);
    const [selectedBlock, setSelectedBlock] = useState<BlockType>('grass');
    const [debugInfo, setDebugInfo] = useState({ x: 0, y: '0.00', z: 0, fps: 0 });

    useEffect(() => {
        if (!mountRef.current) return;
        const currentMount = mountRef.current;

        // --- CORE THREE.JS SETUP ---
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87CEEB);
        scene.fog = new THREE.Fog(0x87CEEB, 10, 50);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        const renderer = new THREE.WebGLRenderer({ antialias: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        currentMount.appendChild(renderer.domElement);

        // --- LIGHTING ---
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
        sunLight.position.set(50, 100, 50);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.set(2048, 2048);
        scene.add(sunLight);

        // --- MATERIALS & WORLD STATE ---
        const materials = loadTextures();
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const world = new Map<string, { mesh: THREE.Mesh, type: BlockType }>();
        const objects: THREE.Object3D[] = [];
        const getBlockKey = (x: number, y: number, z: number) => `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
        const getBlock = (x: number, y: number, z: number) => world.get(getBlockKey(x, y, z));

        const addBlock = (x: number, y: number, z: number, type: BlockType) => {
            x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
            const key = getBlockKey(x, y, z);
            if (world.has(key)) return;

            const mat = materials.get(type);
            if (!mat) return;
            const mesh = new THREE.Mesh(geometry, mat);
            mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            world.set(key, { mesh, type });
            objects.push(mesh);
        };

        const removeBlock = (x: number, y: number, z: number) => {
            x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
            const key = getBlockKey(x, y, z);
            const block = world.get(key);
            if (!block) return;

            scene.remove(block.mesh);
            if (Array.isArray(block.mesh.material)) {
                block.mesh.material.forEach(m => m.dispose());
            } else {
                (block.mesh.material as THREE.Material).dispose();
            }
            block.mesh.geometry.dispose();
            world.delete(key);
            const idx = objects.indexOf(block.mesh);
            if (idx > -1) objects.splice(idx, 1);
        };

        for (let x = -16; x < 16; x++) {
            for (let z = -16; z < 16; z++) {
                const h = Math.floor(noise.noise2D(x, z) * 4) + 4;
                addBlock(x, 0, z, 'stone');
                for (let y = 1; y <= h; y++) {
                    addBlock(x, y, z, y === h ? 'grass' : 'dirt');
                }
            }
        }

        const findSafeSpawnY = (x: number, z: number) => {
            let y = 30;
            while (y > 0) {
                if (getBlock(x, y, z)) {
                    return y + PLAYER_HEIGHT;
                }
                y--;
            }
            return 20;
        };

        camera.position.set(0, findSafeSpawnY(0, 0), 0);

        // --- CONTROLS & PHYSICS STATE ---
        const controls = new PointerLockControls(camera, renderer.domElement);
        controlsRef.current = controls;

        const onLock = () => setIsLocked(true);
        const onUnlock = () => setIsLocked(false);
        controls.addEventListener('lock', onLock);
        controls.addEventListener('unlock', onUnlock);

        const moveState = { forward: false, backward: false, left: false, right: false };
        const velocity = new THREE.Vector3();
        let onGround = false;

        // --- INPUT HANDLERS ---
        const onKeyDown = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'KeyW': moveState.forward = true; break;
                case 'KeyA': moveState.left = true; break;
                case 'KeyS': moveState.backward = true; break;
                case 'KeyD': moveState.right = true; break;
                case 'Space': if (onGround) velocity.y = JUMP_FORCE; break;
            }
            if (e.code.startsWith('Digit')) {
                const digit = parseInt(e.code.slice(5), 10);
                if (digit > 0 && digit <= blockTypes.length) {
                    setSelectedBlock(blockTypes[digit - 1]);
                }
            }
        };
        const onKeyUp = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'KeyW': moveState.forward = false; break;
                case 'KeyA': moveState.left = false; break;
                case 'KeyS': moveState.backward = false; break;
                case 'KeyD': moveState.right = false; break;
            }
        };

        const onMouseDown = (event: MouseEvent) => {
            if (!controls.isLocked) return;
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            const intersects = raycaster.intersectObjects(objects);

            if (intersects.length > 0) {
                const hit = intersects[0];
                if (!hit.face) return;

                if (event.button === 0) { // Left click
                    const pos = hit.point.clone().sub(hit.face.normal.multiplyScalar(0.5));
                    removeBlock(pos.x, pos.y, pos.z);
                } else if (event.button === 2) { // Right click
                    const pos = hit.point.clone().add(hit.face.normal.multiplyScalar(0.5));
                    addBlock(pos.x, pos.y, pos.z, selectedBlock);
                }
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        document.addEventListener('mousedown', onMouseDown);

        // --- RAYCASTER & SELECTOR ---
        const raycaster = new THREE.Raycaster();
        raycaster.far = 6;
        const selectorMesh = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01)),
            new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
        );
        selectorMesh.visible = false;
        scene.add(selectorMesh);

        // --- PHYSICS & ANIMATION LOOP ---
        let prevTime = performance.now();
        let animationFrameId: number;

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            const time = performance.now();
            const delta = (time - prevTime) / 1000;

            if (controls.isLocked) {
                updatePlayer(delta);
            }

            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            const intersects = raycaster.intersectObjects(objects);
            if (intersects.length > 0) {
                selectorMesh.visible = true;
                selectorMesh.position.copy(intersects[0].object.position);
            } else {
                selectorMesh.visible = false;
            }

            renderer.render(scene, camera);
            setDebugInfo({
                x: Math.round(camera.position.x),
                y: camera.position.y.toFixed(2),
                z: Math.round(camera.position.z),
                fps: Math.round(1 / delta)
            });

            prevTime = time;
        };
        
        const playerBox = new THREE.Box3();
        const getPlayerBox = (position: THREE.Vector3) => {
            return new THREE.Box3().setFromCenterAndSize(
                position,
                new THREE.Vector3(PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_WIDTH)
            );
        }

        const checkCollision = (box: THREE.Box3) => {
            for (let x = Math.floor(box.min.x); x <= Math.ceil(box.max.x); x++) {
                for (let y = Math.floor(box.min.y); y <= Math.ceil(box.max.y); y++) {
                    for (let z = Math.floor(box.min.z); z <= Math.ceil(box.max.z); z++) {
                        if (getBlock(x, y, z)) return true;
                    }
                }
            }
            return false;
        };

        const updatePlayer = (delta: number) => {
            // --- 1. UPDATE VELOCITY BASED ON INPUT AND GRAVITY ---
            velocity.y -= GRAVITY * delta;
        
            if (controls.isLocked) {
                const speed = onGround ? SPEED : SPEED * 0.9; // Air control
                const cameraDirection = new THREE.Vector3();
                camera.getWorldDirection(cameraDirection);
                cameraDirection.y = 0;
                cameraDirection.normalize();
        
                const right = new THREE.Vector3().crossVectors(camera.up, cameraDirection).normalize();
                
                const moveX = Number(moveState.right) - Number(moveState.left);
                const moveZ = Number(moveState.forward) - Number(moveState.backward);

                const walkDirection = new THREE.Vector3()
                    .addScaledVector(cameraDirection, moveZ)
                    .addScaledVector(right, -moveX) // Corrected A/D direction
                    .normalize();
                
                if (moveX !== 0 || moveZ !== 0) {
                    velocity.x = walkDirection.x * speed;
                    velocity.z = walkDirection.z * speed;
                } else {
                    velocity.x -= velocity.x * 10.0 * delta; // Ground friction
                    velocity.z -= velocity.z * 10.0 * delta;
                }
            }
        
            // --- 2. APPLY MOVEMENT AND COLLIDE ON EACH AXIS SEPARATELY ---
            const moveStep = velocity.clone().multiplyScalar(delta);
            const playerPosition = camera.position;

            // Y-AXIS
            playerBox.copy(getPlayerBox(playerPosition)).translate(new THREE.Vector3(0, moveStep.y, 0));
            if (checkCollision(playerBox)) {
                if (velocity.y < 0) {
                    onGround = true;
                    playerPosition.y = Math.floor(playerBox.min.y) + PLAYER_HEIGHT;
                }
                velocity.y = 0;
            } else {
                playerPosition.y += moveStep.y;
                onGround = false;
            }
        
            // X-AXIS
            playerBox.copy(getPlayerBox(playerPosition)).translate(new THREE.Vector3(moveStep.x, 0, 0));
            if (checkCollision(playerBox)) {
                velocity.x = 0;
            } else {
                playerPosition.x += moveStep.x;
            }
        
            // Z-AXIS
            playerBox.copy(getPlayerBox(playerPosition)).translate(new THREE.Vector3(0, 0, moveStep.z));
            if (checkCollision(playerBox)) {
                velocity.z = 0;
            } else {
                playerPosition.z += moveStep.z;
            }
        };

        animate();

        const onResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', onResize);

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', onResize);
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('keyup', onKeyUp);
            document.removeEventListener('mousedown', onMouseDown);
            if (controlsRef.current) {
                controlsRef.current.removeEventListener('lock', onLock);
                controlsRef.current.removeEventListener('unlock', onUnlock);
                controlsRef.current.dispose();
            }
            if (currentMount) {
                currentMount.innerHTML = '';
            }
        };
    }, [selectedBlock]);

    const handleOverlayClick = () => {
        if (controlsRef.current && !controlsRef.current.isLocked) {
            controlsRef.current.lock();
        }
    };

    return (
        <div className="relative w-full h-screen overflow-hidden">
            <div ref={mountRef} className="w-full h-full" />
            <div className="absolute top-1/2 left-1/2 w-4 h-4 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
                <div className="w-full h-0.5 bg-white/80 absolute top-1/2 -translate-y-1/2"></div>
                <div className="h-full w-0.5 bg-white/80 absolute left-1/2 -translate-x-1/2"></div>
            </div>
            <div className="absolute top-2 left-2 text-white font-mono text-sm drop-shadow-md pointer-events-none">
                <div>POS: {debugInfo.x}, {debugInfo.y}, {debugInfo.z}</div>
                <div>FPS: {debugInfo.fps}</div>
            </div>
            {!isLocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white z-50 cursor-pointer" onClick={handleOverlayClick}>
                    <div className="text-center p-6 border-2 border-white rounded max-w-md">
                        <h1 className="text-2xl font-bold mb-4">MINECRAFT CLONE</h1>
                        <p className="mb-2">Click to Start</p>
                        <div className="grid grid-cols-2 gap-2 text-left text-sm font-mono bg-black/40 p-4 rounded">
                            <span>Move</span> <span>W A S D</span>
                            <span>Jump</span> <span>SPACE</span>
                            <span>Break</span> <span>Left Click</span>
                            <span>Place</span> <span>Right Click</span>
                            <span>Hotbar</span> <span>1 - 8</span>
                        </div>
                    </div>
                </div>
            )}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 p-2 rounded">
                {Object.values(BLOCKS).map((block, i) => (
                    <div
                        key={block.id}
                        onClick={() => setSelectedBlock(block.type)}
                        className={`w-10 h-10 border-2 flex items-center justify-center cursor-pointer transition-all ${selectedBlock === block.type ? 'border-white scale-110 bg-white/20' : 'border-gray-500 hover:border-gray-300'}`}
                        style={{ backgroundColor: block.color }}
                        title={block.name}
                    >
                        <span className="text-[10px] font-bold text-white drop-shadow-md truncate w-full text-center">{i + 1}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
