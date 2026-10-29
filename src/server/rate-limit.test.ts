import { describe, expect, it, vi } from 'vitest';
import { createConcurrencyLimiter, createWindowLimiter } from './rate-limit.ts';

describe('createWindowLimiter', () => {
    it('allows events up to the limit in each window', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        const limiter = createWindowLimiter({ max: 2, windowMs: 1000 });
        expect([limiter.take('a'), limiter.take('a'), limiter.take('a')]).toEqual([
            true,
            true,
            false,
        ]);
        expect(limiter.take('b')).toBe(true);
        vi.setSystemTime(Date.now() + 1000);
        expect(limiter.take('a')).toBe(true);
        vi.useRealTimers();
    });
});

describe('createConcurrencyLimiter', () => {
    /** A task that records when it starts and ends when `finish` is called with its number. */
    function tasks() {
        const started: number[] = [];
        const finishers = new Map<number, () => void>();
        const task = (n: number) => () => {
            started.push(n);
            return new Promise<number>((resolve) => finishers.set(n, () => resolve(n)));
        };
        const finish = (n: number) => finishers.get(n)?.();
        return { started, task, finish };
    }

    it('runs a few tasks at a time, queues some and refuses the rest at once', async () => {
        const limit = createConcurrencyLimiter({ max: 2, queue: 1 });
        const { started, task, finish } = tasks();

        const runs = [1, 2, 3].map((n) => limit.tryRun(task(n)));
        expect(limit.tryRun(task(4))).toBeUndefined();
        expect(started).toEqual([1, 2]);

        finish(1);
        expect(await runs[0]).toBe(1);
        await vi.waitFor(() => expect(started).toEqual([1, 2, 3]));
        finish(2);
        finish(3);
        expect(await Promise.all(runs)).toEqual([1, 2, 3]);
    });

    it('hands a freed slot to the waiting task before any newcomer', async () => {
        const limit = createConcurrencyLimiter({ max: 1, queue: 2 });
        const { started, task, finish } = tasks();

        const first = limit.tryRun(task(1));
        const waiting = limit.tryRun(task(2));
        finish(1);
        await first;
        const newcomer = limit.tryRun(task(3));
        await vi.waitFor(() => expect(started).toEqual([1, 2]));

        finish(2);
        await waiting;
        await vi.waitFor(() => expect(started).toEqual([1, 2, 3]));
        finish(3);
        expect(await newcomer).toBe(3);
    });

    it('frees the slot of a task that fails', async () => {
        const limit = createConcurrencyLimiter({ max: 1, queue: 0 });
        await expect(limit.tryRun(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
        expect(await limit.tryRun(async () => 'next')).toBe('next');
    });
});
