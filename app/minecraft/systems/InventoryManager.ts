import { BlockType, ItemStack, ItemType, ToolType } from '../types';
import { BLOCKS, TOOLS } from '../constants';

export const HOTBAR_SIZE = 8;
const BLOCK_STACK_LIMIT = 64;
const TOOL_STACK_LIMIT = 1;

function isBlock(item: ItemType): item is BlockType {
    return Boolean((BLOCKS as Record<string, unknown>)[item]);
}

function isTool(item: ItemType): item is ToolType {
    return Boolean((TOOLS as Record<string, unknown>)[item as ToolType]);
}

function getStackLimit(item: ItemType) {
    return isTool(item) ? TOOL_STACK_LIMIT : BLOCK_STACK_LIMIT;
}

export class InventoryManager {
    private slots: Array<ItemStack | null>;
    private selectedSlot = 0;

    constructor(private size: number = HOTBAR_SIZE) {
        this.slots = new Array(this.size).fill(null);
    }

    public getHotbarSize() {
        return this.size;
    }

    public getSelectedIndex() {
        return this.selectedSlot;
    }

    public selectSlot(index: number) {
        if (index < 0 || index >= this.size) return;
        this.selectedSlot = index;
    }

    public scrollSelection(delta: number) {
        if (delta === 0) return this.selectedSlot;
        const next = (this.selectedSlot + delta) % this.size;
        this.selectedSlot = next < 0 ? next + this.size : next;
        return this.selectedSlot;
    }

    public getHotbarSnapshot() {
        return this.slots.map(stack => stack ? { ...stack } : null);
    }

    public getSlot(index: number) {
        return this.slots[index] ? { ...this.slots[index]! } : null;
    }

    public getSelectedStack() {
        return this.getSlot(this.selectedSlot);
    }

    public setSlot(index: number, stack: ItemStack | null) {
        if (index < 0 || index >= this.size) return;
        this.slots[index] = stack ? { ...stack } : null;
    }

    public populateHotbar(defaults: ItemStack[]) {
        defaults.slice(0, this.size).forEach((stack, idx) => {
            this.slots[idx] = { ...stack };
        });
    }

    public addItem(item: ItemType, count: number) {
        if (count <= 0) return 0;
        let remaining = count;
        const stackLimit = getStackLimit(item);

        // Fill existing stacks first
        this.slots.forEach(slot => {
            if (!slot || slot.item !== item || remaining <= 0) return;
            const room = stackLimit - slot.count;
            if (room <= 0) return;
            const transfer = Math.min(room, remaining);
            slot.count += transfer;
            remaining -= transfer;
        });

        // Fill empty slots
        for (let i = 0; i < this.slots.length && remaining > 0; i++) {
            if (this.slots[i]) continue;
            const transfer = Math.min(stackLimit, remaining);
            this.slots[i] = { item, count: transfer };
            remaining -= transfer;
        }

        return remaining;
    }

    public consumeSelected(amount: number) {
        if (amount <= 0) return;
        const slot = this.slots[this.selectedSlot];
        if (!slot) return;
        slot.count -= amount;
        if (slot.count <= 0) {
            this.slots[this.selectedSlot] = null;
        }
    }

    public isBlockItem(item?: ItemType | null): item is BlockType {
        return !!item && isBlock(item);
    }

    public isToolItem(item?: ItemType | null): item is ToolType {
        return !!item && isTool(item);
    }
}
