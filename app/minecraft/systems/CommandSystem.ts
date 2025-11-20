import { BLOCKS, TOOLS } from '../constants';
import { InventoryManager } from './InventoryManager';
import { ItemType } from '../types';

export type CommandLogLevel = 'info' | 'error';

export interface CommandLogEntry {
    id: number;
    message: string;
    level: CommandLogLevel;
}

let entryId = 0;

const KNOWN_ITEMS: Record<string, ItemType> = {
    ...Object.keys(BLOCKS).reduce<Record<string, ItemType>>((acc, key) => {
        acc[key] = key as ItemType;
        return acc;
    }, {}),
    ...Object.keys(TOOLS).reduce<Record<string, ItemType>>((acc, key) => {
        acc[key] = key as ItemType;
        return acc;
    }, {}),
};

export class CommandSystem {
    constructor(private inventory: InventoryManager) { }

    public execute(rawInput: string): CommandLogEntry {
        const trimmed = rawInput.trim();
        if (!trimmed) {
            return this.log('请输入命令', 'error');
        }

        const clean = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
        const [command, ...args] = clean.split(/\s+/);

        switch (command.toLowerCase()) {
            case 'give':
                return this.handleGive(args);
            default:
                return this.log(`未知命令: ${command}`, 'error');
        }
    }

    private handleGive(args: string[]): CommandLogEntry {
        if (args.length === 0) {
            return this.log('用法: /give <物品名> [数量]', 'error');
        }

        const itemKey = args[0].toLowerCase();
        const amount = args[1] ? parseInt(args[1], 10) : 1;
        if (!Number.isFinite(amount) || amount <= 0) {
            return this.log('数量必须为正整数', 'error');
        }

        const item = KNOWN_ITEMS[itemKey];
        if (!item) {
            return this.log(`未知物品: ${itemKey}`, 'error');
        }

        const remaining = this.inventory.addItem(item, amount);
        const received = amount - remaining;
        if (received === 0) {
            return this.log('背包已满，无法获得更多物品', 'error');
        }

        const suffix = remaining > 0 ? `，剩余 ${remaining} 个无法放入` : '';
        return this.log(`已获得 ${received} 个 ${itemKey}${suffix}`, 'info');
    }

    private log(message: string, level: CommandLogLevel): CommandLogEntry {
        return {
            id: entryId++,
            message,
            level,
        };
    }
}
