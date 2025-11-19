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

// CONFIGURATION
const GRAVITY = 28.0;
const JUMP_FORCE = 8.0;
const SPEED = 1; 
const PLAYER_HEIGHT = 1.8;
const PLAYER_WIDTH = 0.4;
const PHYSICS_STEPS = 10; // Increased physics sub-steps for accuracy

const USE_EXTERNAL_TEXTURES = false;

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

const createProceduralTexture = (name: string, colorHex: string) => {
    if (typeof document === 'undefined') return new THREE.Texture();
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();

    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, 64, 64);

    for (let i = 0; i < 200; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.2})`;
        ctx.fillRect(Math.random() * 64, Math.random() * 64, 4, 4);
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.1})`;
        ctx.fillRect(Math.random() * 64, Math.random() * 64, 4, 4);
    }
    // ... (rest of the texture generation is unchanged)
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    return tex;
};

const loadTextures = () => {
    const loader = new THREE.TextureLoader();
    const matMap = new Map<string, THREE.Material | THREE.Material[]>();

    Object.values(BLOCKS).forEach(block => {
         if (USE_EXTERNAL_TEXTURES) {
            // ... (unchanged)
        } else {
            if (block.texture && block.texture.length === 6) {
                const mats = block.texture.map((t, i) => {
                    const color = (t.includes('grass_top')) ? '#567d46' : (t.includes('dirt') ? '#5d4037' : block.color);
                    return new THREE.MeshLambertMaterial({ map: createProceduralTexture(t, color) });
                });
                matMap.set(block.type, mats);
            } else {
                const map = createProceduralTexture(block.type, block.color);
                const isGlass = block.type === 'glass';
                matMap.set(block.type, new THREE.MeshLambertMaterial({ map, transparent: isGlass, opacity: isGlass ? 0.5 : 1 }));
            }
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
    const [debugInfo, setDebugInfo] = useState({ fps: 0, x: 0, y: 0, z: 0 });

    useEffect(() => {
        if (!mountRef.current) return;

        // --- CORE THREE.JS SETUP ---
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87CEEB);
        scene.fog = new THREE.Fog(0x87CEEB, 10, 50);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.y = 10;

        const renderer = new THREE.WebGLRenderer({ antialias: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        mountRef.current.appendChild(renderer.domElement);

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

        const getBlockKey = (x: number, y: number, z: number) => `${x},${y},${z}`;

        const getBlock = (x: number, y: number, z: number) => {
            return world.get(getBlockKey(Math.floor(x), Math.floor(y), Math.floor(z)));
        };

        const addBlock = (x: number, y: number, z: number, type: BlockType) => {
            x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
            const key = getBlockKey(x, y, z);
            if (world.has(key)) return;

            const mat = materials.get(type);
            const mesh = new THREE.Mesh(geometry, mat);
            mesh.position.set(x + 0.5, y + 0.5, z + 0.5); // Center the mesh
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
            world.delete(key);
            const idx = objects.indexOf(block.mesh);
            if (idx > -1) objects.splice(idx, 1);
        };

        // --- TERRAIN GENERATION ---
        for (let x = -16; x < 16; x++) {
            for (let z = -16; z < 16; z++) {
                const h = Math.floor(noise.noise2D(x, z) * 4) + 4;
                addBlock(x, 0, z, 'stone');
                for (let y = 1; y <= h; y++) {
                    addBlock(x, y, z, y === h ? 'grass' : 'dirt');
                }
            }
        }

        // --- CONTROLS & PHYSICS STATE ---
        const controls = new PointerLockControls(camera, renderer.domElement);
        controlsRef.current = controls;
        controls.addEventListener('lock', () => setIsLocked(true));
        controls.addEventListener('unlock', () => setIsLocked(false));

        const moveState = { forward: false, backward: false, left: false, right: false, jump: false };
        const velocity = new THREE.Vector3();
        const playerBox = new THREE.Box3();

        // --- INPUT HANDLERS ---
        const onKeyDown = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'KeyW': moveState.forward = true; break;
                case 'KeyA': moveState.left = true; break;
                case 'KeyS': moveState.backward = true; break;
                case 'KeyD': moveState.right = true; break;
                case 'Space': if (!moveState.jump && velocity.y === 0) { velocity.y = JUMP_FORCE; moveState.jump = true; } break;
            }
        };
        const onKeyUp = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'KeyW': moveState.forward = false; break;
                case 'KeyA': moveState.left = false; break;
                case 'KeyS': moveState.backward = false; break;
                case 'KeyD': moveState.right = false; break;
                case 'Space': moveState.jump = false; break;
            }
        };
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        
        const onMouseDown = (event: MouseEvent) => {
            if (!controls.isLocked) return;
            
            raycaster.setFromCamera({x:0, y:0}, camera);
            const intersects = raycaster.intersectObjects(objects);

            if (intersects.length > 0) {
                const hit = intersects[0];
                if (!hit.face) return;

                if (event.button === 0) { // Left click: Break
                    const pos = hit.point.clone().sub(hit.face.normal.multiplyScalar(0.5));
                    removeBlock(pos.x, pos.y, pos.z);
                } else if (event.button === 2) { // Right click: Place
                    const pos = hit.point.clone().add(hit.face.normal.multiplyScalar(0.5));
                    const blockType = document.body.dataset.selectedBlock as BlockType || 'stone';
                    addBlock(pos.x, pos.y, pos.z, blockType);
                }
            }
        };
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

        const animate = () => {
            requestAnimationFrame(animate);
            
            const time = performance.now();
            const delta = (time - prevTime) / 1000;

            if (controls.isLocked) {
                const subDelta = delta / PHYSICS_STEPS;
                for (let i = 0; i < PHYSICS_STEPS; i++) {
                    updatePlayer(subDelta);
                }
            }

            // Update debug info, selector, etc.
            setDebugInfo({
                fps: Math.round(1 / delta),
                x: Math.round(camera.position.x),
                y: Math.round(camera.position.y),
                z: Math.round(camera.position.z)
            });
            
            raycaster.setFromCamera({x:0, y:0}, camera);
            const intersects = raycaster.intersectObjects(objects);
            selectorMesh.visible = intersects.length > 0;
            if (intersects.length > 0 && intersects[0].object.position) {
                 selectorMesh.position.copy(intersects[0].object.position);
            }
            
            renderer.render(scene, camera);
            prevTime = time;
        };

        const updatePlayer = (delta: number) => {
            // --- MOVEMENT ---
            const speed = SPEED * delta * 10; // Adjusted for sub-stepping
            velocity.x -= velocity.x * 10.0 * delta;
            velocity.z -= velocity.z * 10.0 * delta;
            velocity.y -= GRAVITY * delta;

            const direction = new THREE.Vector3();
            direction.z = Number(moveState.forward) - Number(moveState.backward);
            direction.x = Number(moveState.left) - Number(moveState.right);
            direction.normalize();

            if (moveState.forward || moveState.backward) velocity.z -= direction.z * speed;
            if (moveState.left || moveState.right) velocity.x -= direction.x * speed;

            const moveX = -velocity.x * delta;
            const moveZ = -velocity.z * delta;

            controls.moveRight(moveX);
            controls.moveForward(moveZ);

            // --- COLLISION DETECTION (AABB) ---
            const oldPosition = camera.position.clone();
            camera.position.y += velocity.y * delta;
            
            playerBox.setFromCenterAndSize(
                camera.position,
                new THREE.Vector3(PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_WIDTH)
            );

            let onGround = false;
            // Y-axis collision
            for (let x = Math.floor(playerBox.min.x); x <= Math.ceil(playerBox.max.x); x++) {
                for (let z = Math.floor(playerBox.min.z); z <= Math.ceil(playerBox.max.z); z++) {
                    for (let y = Math.floor(playerBox.min.y); y <= Math.ceil(playerBox.max.y); y++) {
                        if (getBlock(x, y, z)) {
                            if (velocity.y < 0) { // Moving down
                                camera.position.y = y + 1 + PLAYER_HEIGHT / 2;
                                velocity.y = 0;
                                onGround = true;
                            } else if (velocity.y > 0) { // Moving up
                                camera.position.y = y - PLAYER_HEIGHT / 2;
                                velocity.y = 0;
                            }
                        }
                    }
                }
            }

            // X & Z axis collision with auto-jump
            const checkCollisionAndStep = () => {
                playerBox.setFromCenterAndSize(camera.position, new THREE.Vector3(PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_WIDTH));
                 for (let x = Math.floor(playerBox.min.x); x <= Math.ceil(playerBox.max.x); x++) {
                    for (let z = Math.floor(playerBox.min.z); z <= Math.ceil(playerBox.max.z); z++) {
                        // Check player's feet level for collision
                        const feetY = Math.floor(playerBox.min.y);
                        if (getBlock(x, feetY, z)) {
                            // Can we step up?
                            const headY = Math.floor(playerBox.min.y + 1);
                            if (onGround && !getBlock(x, headY, z) && !getBlock(x, headY + 1, z) && (moveX !== 0 || moveZ !== 0)) {
                                camera.position.y += 1; // Auto-jump
                                return false; // Don't register as a collision
                            }
                            return true; // Is a collision
                        }
                    }
                }
                return false;
            };

            if (checkCollisionAndStep()) {
                camera.position.copy(oldPosition); // Revert horizontal movement if collision
                velocity.x = 0;
                velocity.z = 0;
            }
             if (camera.position.y < -10) {
                camera.position.set(0, 20, 0);
                velocity.set(0, 0, 0);
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
            window.removeEventListener('resize', onResize);
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('keyup', onKeyUp);
            document.removeEventListener('mousedown', onMouseDown);
            controls.removeEventListener('lock', () => setIsLocked(true));
            controls.removeEventListener('unlock', () => setIsLocked(false));
            if (mountRef.current) mountRef.current.innerHTML = '';
        };
    }, []);

    useEffect(() => {
        document.body.dataset.selectedBlock = selectedBlock;
    }, [selectedBlock]);

    const handleOverlayClick = () => {
        if(controlsRef.current && !isLocked) {
             controlsRef.current.lock();
        }
    };
    
    return (
        <div className="relative w-full h-screen overflow-hidden">
            <div ref={mountRef} className="w-full h-full" />
            
            <div className="absolute top-1/2 left-1/2 w-4 h-4 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
                <div className="w-full h-0.5 bg-white/80 absolute top-1/2"></div>
                <div className="h-full w-0.5 bg-white/80 absolute left-1/2"></div>
            </div>

            <div className="absolute top-2 left-2 text-white font-mono text-sm drop-shadow-md pointer-events-none">
                <div>FPS: {debugInfo.fps}</div>
                <div>POS: {debugInfo.x}, {debugInfo.y}, {debugInfo.z}</div>
                <div>Next.js + Three.js Voxel Engine</div>
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
