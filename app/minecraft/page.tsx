"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
// Fix: Add .js extension to the import path for Three.js examples in some environments
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

// ==========================================
// TYPES & CONSTANTS
// ==========================================

type BlockType = 'grass' | 'dirt' | 'stone' | 'wood' | 'leaves' | 'sand' | 'glass' | 'tnt';

interface BlockDef {
    id: number;
    name: string;
    type: BlockType;
    color: string; // Fallback color
    texture?: string[]; // [right, left, top, bottom, front, back] or single string
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
const WORLD_SIZE = 32; // Radius of chunks to generate
const CHUNK_HEIGHT = 32;
const GRAVITY = 30.0;
const JUMP_FORCE = 10.0;
const SPEED = 6.0;

// TOGGLE THIS TO TRUE TO USE EXTERNAL IMAGES from /public/textures/
const USE_EXTERNAL_TEXTURES = false; 

// ==========================================
// UTILITIES: Math & Noise
// ==========================================

class SimpleNoise {
    // A very simple pseudo-random noise for terrain
    // In a real app, use 'simplex-noise' package
    noise2D(x: number, y: number) {
        const sin = Math.sin(x * 0.1 + y * 0.1) * 5;
        const cos = Math.cos(x * 0.05 - y * 0.05) * 5;
        return Math.sin(x * 0.05) + Math.cos(y * 0.05) + (sin + cos) * 0.2;
    }
}
const noise = new SimpleNoise();

// ==========================================
// ASSET MANAGER
// ==========================================

const createProceduralTexture = (name: string, colorHex: string) => {
    if (typeof document === 'undefined') return new THREE.Texture();
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();

    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, 64, 64);

    // Add noise
    for (let i = 0; i < 200; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.2})`;
        ctx.fillRect(Math.random() * 64, Math.random() * 64, 4, 4);
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.1})`;
        ctx.fillRect(Math.random() * 64, Math.random() * 64, 4, 4);
    }

    // Specific details
    if (name.includes('log') || name.includes('wood')) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        for(let i=0; i<64; i+=8) ctx.fillRect(i, 0, 2, 64); // vertical lines
    }
    if (name.includes('leaves')) {
        ctx.fillStyle = '#2e7d32';
        for(let i=0; i<20; i++) ctx.fillRect(Math.random()*60, Math.random()*60, 8, 8);
    }
    if (name.includes('tnt')) {
        ctx.fillStyle = 'white';
        ctx.fillRect(10, 20, 44, 24);
        ctx.fillStyle = 'black';
        ctx.font = '16px monospace';
        ctx.fillText('TNT', 18, 38);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    return tex;
};

const loadTextures = () => {
    const loader = new THREE.TextureLoader();
    const matMap = new Map<string, THREE.Material | THREE.Material[]>();

    Object.values(BLOCKS).forEach(block => {
        if (USE_EXTERNAL_TEXTURES) {
            // EXPECTS images in /public/textures/name.png
            if (block.texture && block.texture.length === 6) {
                const mats = block.texture.map(t => new THREE.MeshLambertMaterial({ map: loader.load(`/textures/${t}.png`) }));
                matMap.set(block.type, mats);
            } else {
                const t = block.texture ? block.texture[0] : block.type;
                const map = loader.load(`/textures/${t}.png`);
                map.magFilter = THREE.NearestFilter;
                matMap.set(block.type, new THREE.MeshLambertMaterial({ map }));
            }
        } else {
            // Procedural
            if (block.texture && block.texture.length === 6) {
                const mats = block.texture.map((t, i) => {
                    const color = (t.includes('grass_top')) ? '#567d46' : (t.includes('dirt') ? '#5d4037' : block.color);
                    return new THREE.MeshLambertMaterial({ map: createProceduralTexture(t, color) });
                });
                matMap.set(block.type, mats);
            } else {
                const map = createProceduralTexture(block.type, block.color);
                // Glass transparency
                const isGlass = block.type === 'glass';
                matMap.set(block.type, new THREE.MeshLambertMaterial({ 
                    map, 
                    transparent: isGlass, 
                    opacity: isGlass ? 0.5 : 1 
                }));
            }
        }
    });
    return matMap;
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function MinecraftGame() {
    const mountRef = useRef<HTMLDivElement>(null);
    const [isLocked, setIsLocked] = useState(false);
    const [selectedBlock, setSelectedBlock] = useState<BlockType>('grass');
    const [debugInfo, setDebugInfo] = useState({ fps: 0, x: 0, y: 0, z: 0 });

    useEffect(() => {
        if (!mountRef.current) return;

        // --- SCENE SETUP ---
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87CEEB);
        scene.fog = new THREE.Fog(0x87CEEB, 10, 50);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.y = 10;

        const renderer = new THREE.WebGLRenderer({ antialias: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        mountRef.current.appendChild(renderer.domElement);

        // --- LIGHTING ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
        sunLight.position.set(50, 100, 50);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.set(2048, 2048);
        scene.add(sunLight);

        // --- MATERIALS & GEOMETRY ---
        const materials = loadTextures();
        const geometry = new THREE.BoxGeometry(1, 1, 1);

        // --- INSTANCED MESHING (Optimized) ---
        // We use a simple approach: A map of "key" -> { type, instanceId } is not enough for dynamic edits with InstancedMesh easily.
        // For this demo, to support easy editing, we will use regular Mesh for dynamic blocks and InstancedMesh for static terrain?
        // Actually, for simplicity and "runnability" without complex chunk managers, we will use standard Meshes but manage them carefully.
        // To make it "Beautiful" and performant, we limit world size.
        
        const world = new Map<string, { mesh: THREE.Mesh, type: BlockType }>();
        const objects: THREE.Object3D[] = []; // For collision/raycasting

        const getBlockKey = (x: number, y: number, z: number) => `${x},${y},${z}`;

        const addBlock = (x: number, y: number, z: number, type: BlockType) => {
            const key = getBlockKey(x, y, z);
            if (world.has(key)) return;

            const mat = materials.get(type);
            const mesh = new THREE.Mesh(geometry, mat);
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            scene.add(mesh);
            world.set(key, { mesh, type });
            objects.push(mesh);
        };

        const removeBlock = (mesh: THREE.Mesh) => {
            scene.remove(mesh);
            const key = getBlockKey(mesh.position.x, mesh.position.y, mesh.position.z);
            world.delete(key);
            const idx = objects.indexOf(mesh);
            if (idx > -1) objects.splice(idx, 1);
        };

        // --- TERRAIN GENERATION ---
        const generateWorld = () => {
            for (let x = -16; x < 16; x++) {
                for (let z = -16; z < 16; z++) {
                    const h = Math.floor(noise.noise2D(x, z) * 4) + 4; // Base height
                    
                    // Bedrock
                    addBlock(x, 0, z, 'stone');

                    for (let y = 1; y <= h; y++) {
                        if (y === h) {
                            addBlock(x, y, z, 'grass');
                            // Trees
                            if (Math.random() > 0.97 && x > -10 && x < 10) {
                                // Tree trunk
                                addBlock(x, y+1, z, 'wood');
                                addBlock(x, y+2, z, 'wood');
                                addBlock(x, y+3, z, 'wood');
                                // Leaves
                                for(let lx=-1; lx<=1; lx++){
                                    for(let lz=-1; lz<=1; lz++){
                                        addBlock(x+lx, y+3, z+lz, 'leaves');
                                        addBlock(x+lx, y+4, z+lz, 'leaves');
                                    }
                                }
                                addBlock(x, y+5, z, 'leaves');
                            }
                        } else if (y > h - 3) {
                            addBlock(x, y, z, 'dirt');
                        } else {
                            addBlock(x, y, z, 'stone');
                        }
                    }
                }
            }
        };

        generateWorld();

        // --- CONTROLS & PHYSICS ---
        const controls = new PointerLockControls(camera, document.body);
        
        const onLock = () => setIsLocked(true);
        const onUnlock = () => setIsLocked(false);
        
        controls.addEventListener('lock', onLock);
        controls.addEventListener('unlock', onUnlock);

        // Input State
        const moveState = { forward: false, backward: false, left: false, right: false, jump: false };
        const velocity = new THREE.Vector3();
        const direction = new THREE.Vector3();

        const onKeyDown = (event: KeyboardEvent) => {
            switch (event.code) {
                case 'KeyW': moveState.forward = true; break;
                case 'KeyA': moveState.left = true; break;
                case 'KeyS': moveState.backward = true; break;
                case 'KeyD': moveState.right = true; break;
                case 'Space': if (!moveState.jump && velocity.y === 0) velocity.y = JUMP_FORCE; moveState.jump = true; break;
            }
        };
        const onKeyUp = (event: KeyboardEvent) => {
            switch (event.code) {
                case 'KeyW': moveState.forward = false; break;
                case 'KeyA': moveState.left = false; break;
                case 'KeyS': moveState.backward = false; break;
                case 'KeyD': moveState.right = false; break;
                case 'Space': moveState.jump = false; break;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        // --- SELECTOR & RAYCASTER ---
        const raycaster = new THREE.Raycaster();
        raycaster.far = 6;
        const mouseCenter = new THREE.Vector2(0, 0);
        
        // Wireframe selection box
        const selectorGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
        const selectorMat = new THREE.LineBasicMaterial({ color: 0x000000 });
        const selectorMesh = new THREE.LineSegments(new THREE.EdgesGeometry(selectorGeo), selectorMat);
        selectorMesh.visible = false;
        scene.add(selectorMesh);

        const onMouseDown = (event: MouseEvent) => {
            if (!controls.isLocked) {
                controls.lock();
                return;
            }
            
            raycaster.setFromCamera(mouseCenter, camera);
            const intersects = raycaster.intersectObjects(objects);

            if (intersects.length > 0) {
                const hit = intersects[0];
                if (event.button === 0) { // Left click: Break
                    if (hit.object instanceof THREE.Mesh) {
                        removeBlock(hit.object);
                    }
                } else if (event.button === 2) { // Right click: Place
                    // @ts-ignore - normal is present on intersection
                    const normal = hit.face!.normal;
                    const pos = hit.point.clone().add(normal.multiplyScalar(0.5)).floor();
                    
                    // Physics check: don't place block inside player
                    const playerPos = camera.position.clone();
                    const dx = Math.abs(pos.x - Math.floor(playerPos.x));
                    const dy = Math.abs(pos.y - Math.floor(playerPos.y));
                    const dz = Math.abs(pos.z - Math.floor(playerPos.z));
                    
                    // Simple bounding box check (player height ~1.8)
                    const isInsidePlayer = (dx < 1 && dz < 1 && (pos.y === Math.floor(playerPos.y) || pos.y === Math.floor(playerPos.y)-1));
                    
                    if (!isInsidePlayer) {
                        // Check current react state via ref or direct access (tricky in effect, using simple global var logic for demo)
                        // To fix scope issue with selectedBlock state inside event listener:
                        const currentBlockType = document.body.dataset.selectedBlock as BlockType || 'grass';
                        addBlock(pos.x, pos.y, pos.z, currentBlockType);
                    }
                }
            }
        };
        document.addEventListener('mousedown', onMouseDown);

        // --- MOB SYSTEM ---
        const creeperGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.6, 8);
        const creeperMat = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
        const creeper = new THREE.Mesh(creeperGeo, creeperMat);
        creeper.position.set(5, 10, 5);
        scene.add(creeper);

        let creeperVel = new THREE.Vector3();

        // --- LOOP ---
        let prevTime = performance.now();
        let frames = 0;
        let lastTimeFPS = 0;

        const checkCollision = (newPos: THREE.Vector3) => {
            const x = Math.floor(newPos.x);
            const y = Math.floor(newPos.y); // Feet
            const z = Math.floor(newPos.z);
            const yHead = Math.floor(newPos.y + 1.5); // Head

            // Check feet and head
            if (world.has(getBlockKey(x, y, z)) || world.has(getBlockKey(x, yHead, z))) {
                return true;
            }
            return false;
        };

        const animate = () => {
            const requestParams = requestAnimationFrame(animate);
            
            const time = performance.now();
            const delta = (time - prevTime) / 1000;
            prevTime = time;

            if (controls.isLocked) {
                // --- PHYSICS ---
                velocity.x -= velocity.x * 10.0 * delta;
                velocity.z -= velocity.z * 10.0 * delta;
                velocity.y -= GRAVITY * delta;

                direction.z = Number(moveState.forward) - Number(moveState.backward);
                direction.x = Number(moveState.right) - Number(moveState.left);
                direction.normalize();

                if (moveState.forward || moveState.backward) velocity.z -= direction.z * 400.0 * delta;
                if (moveState.left || moveState.right) velocity.x -= direction.x * 400.0 * delta;

                // Try X Movement
                controls.moveRight(-velocity.x * delta);
                if (checkCollision(camera.position)) {
                    controls.moveRight(velocity.x * delta); // Revert
                    velocity.x = 0;
                }

                // Try Z Movement
                controls.moveForward(-velocity.z * delta);
                if (checkCollision(camera.position)) {
                    controls.moveForward(velocity.z * delta); // Revert
                    velocity.z = 0;
                }

                // Y Movement
                camera.position.y += velocity.y * delta;
                // Ground collision
                if (checkCollision(camera.position)) {
                    // Simple snap up
                    camera.position.y = Math.floor(camera.position.y) + 1.001; // A bit above block
                    velocity.y = 0;
                }

                if (camera.position.y < -10) {
                    camera.position.set(0, 20, 0);
                    velocity.set(0, 0, 0);
                }

                // Update Debug Info
                if (time - lastTimeFPS > 500) {
                    setDebugInfo({
                        fps: Math.round(1/delta),
                        x: Math.round(camera.position.x),
                        y: Math.round(camera.position.y),
                        z: Math.round(camera.position.z)
                    });
                    lastTimeFPS = time;
                }

                // --- RAYCASTER UPDATE ---
                raycaster.setFromCamera(mouseCenter, camera);
                const intersects = raycaster.intersectObjects(objects);
                if (intersects.length > 0) {
                    const hit = intersects[0];
                    selectorMesh.visible = true;
                    selectorMesh.position.copy(hit.object.position);
                } else {
                    selectorMesh.visible = false;
                }
            }

            // --- MOB AI ---
            // Simple hop towards player
            const dist = creeper.position.distanceTo(camera.position);
            if (dist < 15 && dist > 2) {
                const dir = new THREE.Vector3().subVectors(camera.position, creeper.position).normalize();
                creeper.position.x += dir.x * delta * 2;
                creeper.position.z += dir.z * delta * 2;
                creeper.lookAt(camera.position);
            }
            // Mob Gravity (simple)
            const cPos = creeper.position;
            if (!world.has(getBlockKey(Math.floor(cPos.x), Math.floor(cPos.y - 1), Math.floor(cPos.z)))) {
                cPos.y -= delta * 5; 
            } else {
                 cPos.y = Math.floor(cPos.y) + 0.8; // floor snap
            }

            renderer.render(scene, camera);
        };

        animate();

        // Resize
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
            controls.removeEventListener('lock', onLock);
            controls.removeEventListener('unlock', onUnlock);
            if (mountRef.current) mountRef.current.innerHTML = '';
        };
    }, []);

    // Sync state with DOM for event listener access
    useEffect(() => {
        document.body.dataset.selectedBlock = selectedBlock;
    }, [selectedBlock]);

    return (
        <div className="relative w-full h-screen overflow-hidden bg-sky-300">
            <div ref={mountRef} className="w-full h-full" />
            
            {/* CROSSHAIR */}
            <div className="absolute top-1/2 left-1/2 w-4 h-4 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
                <div className="w-full h-0.5 bg-white/80 absolute top-1/2"></div>
                <div className="h-full w-0.5 bg-white/80 absolute left-1/2"></div>
            </div>

            {/* DEBUG UI */}
            <div className="absolute top-2 left-2 text-white font-mono text-sm drop-shadow-md pointer-events-none">
                <div>FPS: {debugInfo.fps}</div>
                <div>POS: {debugInfo.x}, {debugInfo.y}, {debugInfo.z}</div>
                <div>Next.js + Three.js Voxel Engine</div>
            </div>

            {/* INSTRUCTIONS OVERLAY */}
            {!isLocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white z-50 cursor-pointer"
                     onClick={() => document.body.requestPointerLock()}>
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

            {/* HOTBAR */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 p-2 rounded">
                {Object.values(BLOCKS).map((block, i) => (
                    <div 
                        key={block.id}
                        onClick={() => setSelectedBlock(block.type)}
                        className={`w-10 h-10 border-2 flex items-center justify-center cursor-pointer transition-all
                            ${selectedBlock === block.type ? 'border-white scale-110 bg-white/20' : 'border-gray-500 hover:border-gray-300'}
                        `}
                        style={{ backgroundColor: block.color }}
                        title={block.name}
                    >
                        <span className="text-[10px] font-bold text-white drop-shadow-md truncate w-full text-center">
                            {i+1}
                        </span>
                    </div>
                ))}
            </div>
            
            {/* KEYBOARD LISTENER FOR HOTBAR (React side) */}
            {/* We attach this via a hidden utility or just main effect, simpler to map global keys in main effect, 
                but for UI updates we can add a small listener here for visual feedback */}
        </div>
    );
}