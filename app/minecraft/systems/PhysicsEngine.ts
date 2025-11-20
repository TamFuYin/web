import * as THREE from 'three';
import { WorldManager } from './WorldManager';
import { InputManager } from './InputManager';
import { GRAVITY, JUMP_FORCE, SPEED, PLAYER_HEIGHT, PLAYER_WIDTH, EYE_HEIGHT } from '../constants';

const AIRBORNE_PADDING = 0.02;

export class PhysicsEngine {
    private velocity = new THREE.Vector3();
    private onGround = false;
    private playerBox = new THREE.Box3();

    constructor() { }

    private getPlayerBox(position: THREE.Vector3) {
        const center = position.clone();
        center.y -= (EYE_HEIGHT - PLAYER_HEIGHT / 2);
        return new THREE.Box3().setFromCenterAndSize(
            center,
            new THREE.Vector3(PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_WIDTH)
        );
    }

    private checkCollision(box: THREE.Box3, world: WorldManager) {
        for (let x = Math.floor(box.min.x); x < box.max.x; x++) {
            for (let y = Math.floor(box.min.y); y < box.max.y; y++) {
                for (let z = Math.floor(box.min.z); z < box.max.z; z++) {
                    if (world.getBlock(x, y, z)) return true;
                }
            }
        }
        return false;
    }

    public update(delta: number, player: THREE.Camera, world: WorldManager, input: InputManager) {
        // 1. Gravity & Input (Velocity Update)
        this.velocity.y -= GRAVITY * delta;

        if (input.controls.isLocked) {
            // --- Horizontal Friction ---
            const horizontalVelocity = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
            const horizontalSpeed = horizontalVelocity.length();
            const frictionFactor = this.onGround ? 8.0 : 0.5;

            if (horizontalSpeed > 0) {
                const friction = horizontalVelocity.normalize().multiplyScalar(horizontalSpeed * frictionFactor * delta);
                if (friction.length() > horizontalSpeed) {
                    this.velocity.x = 0;
                    this.velocity.z = 0;
                } else {
                    this.velocity.x -= friction.x;
                    this.velocity.z -= friction.z;
                }
            }

            // --- Horizontal Input ---
            const moveSpeed = this.onGround ? SPEED * (input.sprint ? 1.5 : 1.0) : SPEED * 0.5;
            // Note: Original code had SPEED * 10 for ground and SPEED * 5 for air? 
            // Let's stick to the constants but maybe boost them a bit to match original feel if needed.
            // Actually original code: onGround ? SPEED * 10 : SPEED * 5. 
            // Wait, SPEED was 5.0. So 50 and 25? That seems high for acceleration.
            // Let's use the original values to preserve feel.
            const accel = this.onGround ? SPEED * 10 : SPEED * 5;

            const cameraDirection = new THREE.Vector3();
            player.getWorldDirection(cameraDirection);
            cameraDirection.y = 0;
            cameraDirection.normalize();

            const right = new THREE.Vector3().crossVectors(cameraDirection, player.up).normalize();

            const moveX = Number(input.moveState.right) - Number(input.moveState.left);
            const moveZ = Number(input.moveState.forward) - Number(input.moveState.backward);

            const walkDirection = new THREE.Vector3();
            if (moveZ !== 0) walkDirection.addScaledVector(cameraDirection, moveZ);
            if (moveX !== 0) walkDirection.addScaledVector(right, moveX);

            if (walkDirection.lengthSq() > 0) {
                walkDirection.normalize();
                this.velocity.x += walkDirection.x * accel * delta;
                this.velocity.z += walkDirection.z * accel * delta;
            }

            // --- Speed Limit ---
            const maxSpeed = SPEED * (input.sprint ? 1.5 : 1.0);
            const currentSpeedSq = this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z;
            if (currentSpeedSq > maxSpeed * maxSpeed) {
                const currentSpeed = Math.sqrt(currentSpeedSq);
                this.velocity.x = (this.velocity.x / currentSpeed) * maxSpeed;
                this.velocity.z = (this.velocity.z / currentSpeed) * maxSpeed;
            }

            // --- Jump ---
            if (input.jump && this.onGround) {
                this.velocity.y = JUMP_FORCE;
                input.jump = false; // Consume jump
            }
        }

        // 2. Movement & Collision (Sub-stepping)
        const subSteps = 5;
        const subDelta = delta / subSteps;
        let groundedThisFrame = false;

        for (let i = 0; i < subSteps; i++) {
            const moveStep = this.velocity.clone().multiplyScalar(subDelta);
            const playerPosition = player.position;

            // Y-AXIS
            this.playerBox.copy(this.getPlayerBox(playerPosition)).translate(new THREE.Vector3(0, moveStep.y, 0));
            if (this.checkCollision(this.playerBox, world)) {
                if (this.velocity.y < 0) {
                    groundedThisFrame = true;
                    const blockTop = Math.floor(this.playerBox.min.y) + 1;
                    playerPosition.y = blockTop + EYE_HEIGHT;
                } else if (this.velocity.y > 0) {
                    const blockBottom = Math.ceil(this.playerBox.max.y) - 1;
                    playerPosition.y = blockBottom - (PLAYER_HEIGHT - EYE_HEIGHT) - 0.001;
                }
                this.velocity.y = 0;
            } else {
                playerPosition.y += moveStep.y;
            }

            // X-AXIS
            const currentlyGrounded = groundedThisFrame || this.onGround;
            this.playerBox.copy(this.getPlayerBox(playerPosition)).translate(new THREE.Vector3(moveStep.x, 0, 0));
            if (currentlyGrounded) {
                this.playerBox.min.y += 0.1;
            } else {
                this.playerBox.min.addScalar(-AIRBORNE_PADDING);
                this.playerBox.max.addScalar(AIRBORNE_PADDING);
            }
            if (this.checkCollision(this.playerBox, world)) {
                // Auto-Jump Logic
                if (groundedThisFrame) {
                    const climbBox = this.playerBox.clone().translate(new THREE.Vector3(0, 1.1, 0));
                    climbBox.min.y -= 0.1; // Restore original height for the check

                    if (!this.checkCollision(climbBox, world)) {
                        this.velocity.y = JUMP_FORCE;
                        groundedThisFrame = false;
                        this.onGround = false;
                        playerPosition.y += 0.01;
                    }
                }
                this.velocity.x = 0;
            } else {
                playerPosition.x += moveStep.x;
            }

            // Z-AXIS
            const groundedForZ = groundedThisFrame || this.onGround;
            this.playerBox.copy(this.getPlayerBox(playerPosition)).translate(new THREE.Vector3(0, 0, moveStep.z));
            if (groundedForZ) {
                this.playerBox.min.y += 0.1;
            } else {
                this.playerBox.min.addScalar(-AIRBORNE_PADDING);
                this.playerBox.max.addScalar(AIRBORNE_PADDING);
            }
            if (this.checkCollision(this.playerBox, world)) {
                // Auto-Jump Logic
                if (groundedThisFrame) {
                    const climbBox = this.playerBox.clone().translate(new THREE.Vector3(0, 1.1, 0));
                    climbBox.min.y -= 0.1; // Restore original height for the check

                    if (!this.checkCollision(climbBox, world)) {
                        this.velocity.y = JUMP_FORCE;
                        groundedThisFrame = false;
                        this.onGround = false;
                        playerPosition.y += 0.01;
                    }
                }
                this.velocity.z = 0;
            } else {
                playerPosition.z += moveStep.z;
            }
        }

        this.onGround = groundedThisFrame;
    }
}
