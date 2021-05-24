import {
    ProduceCommand,
    ConsumeCommand,
    SimpleMap,
    backoff
} from 'mediakitchen-common';
import { KitchenConsumer } from './KitchenConsumer';
import { KitchenProducer } from './KitchenProducer';
import { KitchenApi } from './KitchenApi';

export abstract class KitchenTransport<T extends { appData: any, closed: boolean, time: number }> {
    id: string;
    appData: SimpleMap;

    closed: boolean;
    closedExternally: boolean = false;
    lastSeen: number;

    api: KitchenApi;

    producers = new Map<string, KitchenProducer>();
    consumers = new Map<string, KitchenConsumer>();

    constructor(
        id: string,
        state: T,
        api: KitchenApi
    ) {
        this.id = id;
        this.appData = state.appData;
        this.api = api;

        this.closed = state.closed;
        this.lastSeen = state.time;
    }

    async produce(args: ProduceCommand['args'], retryKey: string) {
        let res = await this.api.createProducer(this.id, args as ProduceCommand['args'], retryKey);
        if (this.producers.has(res.id)) {
            let r = this.producers.get(res.id)!;
            r.applyState(res);
            return r;
        } else {
            let r = new KitchenProducer(res.id, res, this.api);
            this.producers.set(res.id, r);
            return r;
        }
    }

    async consume(producerId: string, args: ConsumeCommand['args'], retryKey: string) {
        let res = await this.api.createConsumer(this.id, producerId, args, retryKey);
        if (this.consumers.has(res.id)) {
            let r = this.consumers.get(res.id)!;
            r.applyState(res);
            return r;
        } else {
            let r = new KitchenConsumer(res.id, res, this.api);
            this.consumers.set(res.id, r);
            return r;
        }
    }

    async close() {
        if (!this.closed) {
            this.closed = true;
            this.applyClosed();
            for (let p of this.producers.values()) {
                p.onClosed();
            }
            for (let c of this.consumers.values()) {
                c.onClosed();
            }
            await backoff(async () => {
                if (this.closedExternally) {
                    return;
                }
                await this.invokeClose();
            });
        }
    }

    applyState(state: T) {
        if (this.closed) {
            return;
        }
        if (this.lastSeen >= state.time) {
            return;
        }

        this.closed = state.closed;
        this.applyStateInternal(state);
        if (this.closed) {
            this.applyClosed();
            this.onClosed();
        }
    }

    onClosed = () => {
        this.closedExternally = true;
        if (!this.closed) {
            this.closed = true;
            this.applyClosed();
            for (let p of this.producers.values()) {
                p.onClosed();
            }
            for (let c of this.consumers.values()) {
                c.onClosed();
            }
        }
    }

    protected abstract applyStateInternal(state: T): void;
    protected abstract applyClosed(): void;
    protected abstract invokeClose(): Promise<void>;
}