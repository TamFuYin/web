"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { WorldManager } from './systems/WorldManager';
import { InputManager } from './systems/InputManager';
import { PhysicsEngine } from './systems/PhysicsEngine';
import { BLOCKS, EYE_HEIGHT, PLAYER_HEIGHT } from './constants';
import { BlockType } from './types';

export default function MinecraftGame() {
    const mountRef = useRef<HTMLDivElement>(null);
    const controlsRef = useRef<any>(null);
    const [isLocked, setIsLocked] = useState(false);
    const [selectedBlock, setSelectedBlock] = useState<BlockType>('grass');
    const selectedBlockRef = useRef<BlockType>('grass');
    const [debugInfo, setDebugInfo] = useState({ x: 0, y: '0.00', z: 0, fps: 0 });

    // Keep ref in sync with state for event handlers
    useEffect(() => {
        selectedBlockRef.current = selectedBlock;
    }, [selectedBlock]);

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

        // --- SYSTEMS INITIALIZATION ---
        const world = new WorldManager(scene);
        const physics = new PhysicsEngine();

        // Find safe spawn
        const findSafeSpawnY = (x: number, z: number) => {
            let y = 30;
            while (y > 0) {
                if (world.getBlock(x, y, z)) {
                    return y + PLAYER_HEIGHT;
                }
                y--;
            }
            return 20;
        };
        camera.position.set(0, findSafeSpawnY(0, 0), 0);

        const input = new InputManager(camera, renderer.domElement, {
            onSelectBlock: (block) => setSelectedBlock(block),
            onPlaceBlock: () => {
                // Raycast for placement
                raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
                const intersects = raycaster.intersectObjects(world.getObjects());
                if (intersects.length > 0) {
                    const hit = intersects[0];
                    if (hit.face) {
                        const pos = hit.point.clone().add(hit.face.normal.multiplyScalar(0.5));
                        world.addBlock(pos.x, pos.y, pos.z, selectedBlockRef.current);
                    }
                }
            },
            onRemoveBlock: () => {
                // Raycast for removal
                raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
                const intersects = raycaster.intersectObjects(world.getObjects());
                if (intersects.length > 0) {
                    const hit = intersects[0];
                    if (hit.face) {
                        const pos = hit.point.clone().sub(hit.face.normal.multiplyScalar(0.5));
                        world.removeBlock(pos.x, pos.y, pos.z);
                    }
                }
            }
        });
        controlsRef.current = input.controls;

        // Hook up lock state
        input.controls.addEventListener('lock', () => setIsLocked(true));
        input.controls.addEventListener('unlock', () => setIsLocked(false));

        // --- RAYCASTER & SELECTOR ---
        const raycaster = new THREE.Raycaster();
        raycaster.far = 6;
        const selectorMesh = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01)),
            new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
        );
        selectorMesh.visible = false;
        scene.add(selectorMesh);

        // --- GAME LOOP ---
        let prevTime = performance.now();
        let animationFrameId: number;

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            const time = performance.now();
            const delta = (time - prevTime) / 1000;

            physics.update(delta, camera, world, input);

            // Update selector
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            const intersects = raycaster.intersectObjects(world.getObjects());
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
            input.dispose();
            world.dispose();
            if (currentMount) {
                currentMount.innerHTML = '';
            }
        };
    }, []);

    const handleOverlayClick = () => {
        if (controlsRef.current) {
            controlsRef.current.lock();
        }
    };

    return (
        <div className="relative w-full h-screen overflow-hidden">
            <div ref={mountRef} className="w-full h-full" onClick={handleOverlayClick} />
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
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 p-2 rounded z-50">
                {Object.values(BLOCKS).map((block, i) => (
                    <div
                        key={block.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedBlock(block.type); }}
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
