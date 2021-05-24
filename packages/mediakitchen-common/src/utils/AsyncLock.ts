export class AsyncLock {
    private permits: number = 1;
    private promiseResolverQueue: Array<(v: boolean) => void> = [];

    async inLock<T>(func: () => Promise<T> | T): Promise<T> {
        try {
            await this.lock();
            return await func();
        } finally {
            this.unlock();
        }
    }

    private async lock() {
        if (this.permits > 0) {
            this.permits = this.permits - 1;
            return;
        }
        await new Promise<boolean>(resolve => this.promiseResolverQueue.push(resolve));
    }

    private unlock() {
        this.permits += 1;
        if (this.permits > 1 && this.promiseResolverQueue.length > 0) {
            throw new Error('this.permits should never be > 0 when there is someone waiting.');
        } else if (this.permits === 1 && this.promiseResolverQueue.length > 0) {
            // If there is someone else waiting, immediately consume the permit that was released
            // at the beginning of this function and let the waiting function resume.
            this.permits -= 1;

            const nextResolver = this.promiseResolverQueue.shift();
            // Resolve on the next tick
            if (nextResolver) {
                setTimeout(() => {
                    nextResolver(true);
                }, 0);
            }
        }
    }
}

export class AsyncLockMap {
    private isLocked = new Map<string, true>();
    private promiseResolverQueue = new Map<string, Array<(v: boolean) => void>>();

    async inLock<T>(key: string, func: () => Promise<T> | T): Promise<T> {
        try {
            await this.lock(key);
            return await func();
        } finally {
            this.unlock(key);
        }
    }

    private async lock(key: string) {
        if (this.isLocked.get(key)) {
            this.isLocked.delete(key);
            return;
        }
        await new Promise<boolean>(resolve => {
            let ex = this.promiseResolverQueue.get(key);
            if (ex) {
                ex.push(resolve);
            } else {
                this.promiseResolverQueue.set(key, [resolve]);
            }
        });
    }

    private unlock(key: string) {
        if (!this.isLocked.get(key)) {
            throw new Error('Unable to unlock if not locked');
        }

        let queue = this.promiseResolverQueue.get(key);
        if (!queue) {
            this.isLocked.delete(key);
        } else if (queue.length === 0) {
            this.isLocked.delete(key);
            this.promiseResolverQueue.delete(key);
        } else {
            const nextResolver = queue.shift()!;
            setTimeout(() => {
                nextResolver(true);
            }, 0);
        }
    }
}