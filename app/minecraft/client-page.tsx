"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { WorldManager } from './systems/WorldManager';
import { InputManager } from './systems/InputManager';
import { PhysicsEngine } from './systems/PhysicsEngine';
import { BLOCKS, PLAYER_HEIGHT, TOOLS } from './constants';
import { InventoryManager, HOTBAR_SIZE } from './systems/InventoryManager';
import { CommandLogEntry, CommandSystem } from './systems/CommandSystem';
import { MiningSystem } from './systems/MiningSystem';
import { BlockType, ItemStack, ToolType } from './types';

const DEFAULT_HOTBAR: ItemStack[] = [
    { item: 'grass', count: 64 },
    { item: 'dirt', count: 64 },
    { item: 'stone', count: 32 },
    { item: 'sand', count: 32 },
    { item: 'wooden_pickaxe', count: 1 },
    { item: 'stone_pickaxe', count: 1 },
];

const isBlockItemType = (item: string): item is BlockType => Object.prototype.hasOwnProperty.call(BLOCKS, item);
const isToolItemType = (item: string): item is ToolType => Object.prototype.hasOwnProperty.call(TOOLS, item);

const getItemTexture = (stack: ItemStack | null) => {
    if (!stack) return null;
    if (isBlockItemType(stack.item)) {
        return BLOCKS[stack.item].texture?.[0] ?? null;
    }
    if (isToolItemType(stack.item)) {
        return TOOLS[stack.item].texture;
    }
    return null;
};

const getItemName = (stack: ItemStack | null) => {
    if (!stack) return '空';
    if (isBlockItemType(stack.item)) {
        return BLOCKS[stack.item].name;
    }
    if (isToolItemType(stack.item)) {
        return TOOLS[stack.item].name;
    }
    return stack.item;
};

export default function MinecraftGame() {
    const mountRef = useRef<HTMLDivElement>(null);
    const controlsRef = useRef<any>(null);
    const inventoryRef = useRef<InventoryManager | null>(null);
    const commandSystemRef = useRef<CommandSystem | null>(null);
    const miningSystemRef = useRef<MiningSystem | null>(null);
    const [isLocked, setIsLocked] = useState(false);
    const [hotbarItems, setHotbarItems] = useState<Array<ItemStack | null>>(() => new Array(HOTBAR_SIZE).fill(null));
    const [selectedSlot, setSelectedSlot] = useState(0);
    const [debugInfo, setDebugInfo] = useState({ x: 0, y: '0.00', z: 0, fps: 0 });
    const [isConsoleOpen, setIsConsoleOpen] = useState(false);
    const [commandInput, setCommandInput] = useState('');
    const [commandLogs, setCommandLogs] = useState<CommandLogEntry[]>([]);
    const commandInputRef = useRef<HTMLInputElement | null>(null);

    const syncHotbar = useCallback(() => {
        const inventory = inventoryRef.current;
        if (!inventory) return;
        setHotbarItems(inventory.getHotbarSnapshot());
        setSelectedSlot(inventory.getSelectedIndex());
    }, []);

    const handleConsoleClose = useCallback(() => {
        setIsConsoleOpen(false);
        setCommandInput('');
        controlsRef.current?.lock();
    }, []);

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
        const raycaster = new THREE.Raycaster();
        raycaster.far = 6;

        const inventory = new InventoryManager(HOTBAR_SIZE);
        inventory.populateHotbar(DEFAULT_HOTBAR);
        inventoryRef.current = inventory;
        syncHotbar();

        const commandSystem = new CommandSystem(inventory);
        commandSystemRef.current = commandSystem;

        const miningSystem = new MiningSystem(scene, world, {
            getSelectedStack: () => inventory.getSelectedStack(),
            onBlockBroken: ({ position, type }) => {
                world.removeBlock(position.x, position.y, position.z);
                inventory.addItem(type, 1);
                syncHotbar();
            }
        });
        miningSystemRef.current = miningSystem;

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

        const performPlacement = () => {
            const stack = inventory.getSelectedStack();
            if (!stack || !inventory.isBlockItem(stack.item)) return;
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            const intersects = raycaster.intersectObjects(world.getObjects());
            if (!intersects.length) return;
            const hit = intersects[0];
            if (!hit.face) return;
            const pos = hit.point.clone().add(hit.face.normal.multiplyScalar(0.5));
            world.addBlock(pos.x, pos.y, pos.z, stack.item);
            inventory.consumeSelected(1);
            syncHotbar();
        };

        const input = new InputManager(camera, renderer.domElement, {
            hotbarSize: HOTBAR_SIZE,
            onSelectSlot: (index) => {
                inventory.selectSlot(index);
                syncHotbar();
            },
            onPlaceBlock: performPlacement,
            onBreakStart: () => {
                miningSystem.startBreaking(camera, raycaster, world.getObjects());
            },
            onBreakEnd: () => miningSystem.stopBreaking(),
            onScrollSlot: (delta) => {
                inventory.scrollSelection(delta);
                syncHotbar();
            },
            onOpenConsole: (prefill) => {
                setIsConsoleOpen(true);
                setCommandInput(prefill ?? '');
                controlsRef.current?.unlock();
            }
        });
        controlsRef.current = input.controls;

        // Hook up lock state
        input.controls.addEventListener('lock', () => setIsLocked(true));
        input.controls.addEventListener('unlock', () => setIsLocked(false));

        // --- RAYCASTER & SELECTOR ---
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
            miningSystem.update(delta);

            // Update selector
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            const intersects = raycaster.intersectObjects(world.getObjects());
            if (intersects.length > 0) {
                const hit = intersects[0];
                if (hit.face) {
                    selectorMesh.visible = true;
                    const p = hit.point.clone().sub(hit.face.normal.multiplyScalar(0.1));
                    const x = Math.floor(p.x) + 0.5;
                    const y = Math.floor(p.y) + 0.5;
                    const z = Math.floor(p.z) + 0.5;
                    selectorMesh.position.set(x, y, z);
                } else {
                    selectorMesh.visible = false;
                }
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
            miningSystem.dispose();
            world.dispose();
            if (currentMount) {
                currentMount.innerHTML = '';
            }
        };
    }, [syncHotbar]);

    useEffect(() => {
        if (!isConsoleOpen) return;
        const handleKey = (event: KeyboardEvent) => {
            if (event.code === 'Escape') {
                event.preventDefault();
                handleConsoleClose();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [handleConsoleClose, isConsoleOpen]);

    useEffect(() => {
        if (isConsoleOpen) {
            setTimeout(() => commandInputRef.current?.focus(), 0);
        }
    }, [isConsoleOpen]);

    const handleCommandSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const system = commandSystemRef.current;
        const inventory = inventoryRef.current;
        if (!system || !inventory) return;
        const trimmed = commandInput.trim();
        if (!trimmed) return;
        const entry = system.execute(trimmed);
        setCommandLogs(prev => [...prev.slice(-9), entry]);
        setCommandInput('');
        setIsConsoleOpen(false);
        controlsRef.current?.lock();
        syncHotbar();
    };

    const handleHotbarClick = (index: number) => {
        const inventory = inventoryRef.current;
        if (!inventory) return;
        inventory.selectSlot(index);
        syncHotbar();
    };

    const getSelectedStack = () => hotbarItems[selectedSlot];

    const handleOverlayClick = () => {
        if (isConsoleOpen) return;
        controlsRef.current?.lock();
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
            {!isLocked && !isConsoleOpen && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white z-40 cursor-pointer" onClick={handleOverlayClick}>
                    <div className="text-center p-6 border-2 border-white rounded max-w-md">
                        <h1 className="text-2xl font-bold mb-4">MINECRAFT CLONE</h1>
                        <p className="mb-2">Click to Start</p>
                        <div className="grid grid-cols-2 gap-2 text-left text-sm font-mono bg-black/40 p-4 rounded">
                            <span>Move</span> <span>W A S D</span>
                            <span>Jump</span> <span>SPACE</span>
                            <span>Break</span> <span>Left Click</span>
                            <span>Place</span> <span>Right Click</span>
                            <span>Hotbar</span> <span>1 - {HOTBAR_SIZE} / Scroll</span>
                            <span>Console</span> <span>T 或 /</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Command logs preview when console is closed */}
            {!isConsoleOpen && commandLogs.length > 0 && (
                <div className="absolute left-4 bottom-32 max-w-xs bg-black/60 text-white text-xs font-mono p-2 rounded z-30 space-y-1">
                    {commandLogs.slice(-4).map(log => (
                        <div key={log.id} className={log.level === 'error' ? 'text-red-300' : 'text-green-300'}>
                            {log.message}
                        </div>
                    ))}
                </div>
            )}

            {/* Hotbar */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 sm:gap-2 bg-black/60 p-2 rounded z-30 max-w-[95vw] overflow-x-auto no-scrollbar">
                {hotbarItems.map((stack, index) => {
                    const texture = getItemTexture(stack);
                    const isSelected = index === selectedSlot;
                    return (
                        <button
                            key={index}
                            onClick={(e) => { e.stopPropagation(); handleHotbarClick(index); }}
                            className={`relative flex-shrink-0 w-10 h-10 border-2 transition-all ${isSelected ? 'border-white scale-110 bg-white/20' : 'border-gray-500 hover:border-gray-300'}`}
                        >
                            {texture ? (
                                <img src={texture} alt={getItemName(stack)} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                            ) : (
                                <span className="text-[10px] text-white/70">空</span>
                            )}
                            {stack?.count && (
                                <span className="absolute bottom-0 right-0 text-[10px] font-bold text-white drop-shadow-md px-1">
                                    {stack.count}
                                </span>
                            )}
                            <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white drop-shadow">{index + 1}</span>
                        </button>
                    );
                })}
            </div>

            {/* Selected item hint */}
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white text-sm font-mono bg-black/50 px-3 py-1 rounded z-30">
                {getItemName(getSelectedStack())}
            </div>

            {/* Command Console */}
            {isConsoleOpen && (
                <div className="absolute inset-x-0 bottom-0 bg-black/80 text-white p-4 z-50">
                    <div className="max-h-40 overflow-y-auto text-xs font-mono space-y-1 mb-3">
                        {commandLogs.length === 0 && <div className="text-gray-300">输入 /give &lt;物品&gt; [数量]</div>}
                        {commandLogs.map(log => (
                            <div key={log.id} className={log.level === 'error' ? 'text-red-300' : 'text-green-300'}>
                                {log.message}
                            </div>
                        ))}
                    </div>
                    <form onSubmit={handleCommandSubmit} className="flex gap-2">
                        <input
                            ref={commandInputRef}
                            value={commandInput}
                            onChange={(e) => setCommandInput(e.target.value)}
                            className="flex-1 bg-black/60 border border-white/40 rounded px-3 py-2 text-white font-mono"
                            placeholder="输入命令..."
                        />
                        <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded">执行</button>
                        <button type="button" onClick={handleConsoleClose} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded">关闭</button>
                    </form>
                </div>
            )}
        </div>
    );
}
