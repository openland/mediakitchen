import { RtpParameters, SimpleMap, ConsumerState, backoff } from 'mediakitchen-common';
import { Consumer } from '../Consumer';
import { KitchenApi } from './KitchenApi';

export class KitchenConsumer {
    readonly id: string;
    readonly appData: SimpleMap;
    readonly kind: 'video' | 'audio';
    readonly type: 'simple' | 'simulcast' | 'svc' | 'pipe';
    readonly rtpParameters: RtpParameters;
    readonly facade: Consumer;
    closed: boolean;
    paused: boolean;

    #closedExternally: boolean = false;
    #lastSeen: number;
    #api: KitchenApi;

    constructor(
        id: string,
        state: ConsumerState,
        api: KitchenApi
    ) {
        this.id = id;
        this.appData = state.appData;
        this.closed = state.closed;
        this.paused = state.paused;
        this.kind = state.kind;
        this.type = state.type;
        this.rtpParameters = state.rtpParameters;
        this.#lastSeen = state.time;
        this.#api = api;
        this.facade = new Consumer(this);
    }

    async close() {
        if (!this.closed) {
            this.closed = true;
            this.paused = true;
            await backoff(async () => {
                if (this.#closedExternally) {
                    return;
                }
                await this.#api.closeConsumer(this.id);
            })
        }
    }

    async pause() {
        if (!this.closed) {
            let r = await this.#api.pauseConsumer(this.id);
            this.applyState(r);
        }
    }

    async resume() {
        if (!this.closed) {
            let r = await this.#api.resumeConsumer(this.id);
            this.applyState(r);
        }
    }

    async getStats() {
        if (!this.closed) {
            return await this.#api.getConsumerStats(this.id);
        } else {
            return null;
        }
    }

    onClosed = () => {
        this.#closedExternally = true;
        if (!this.closed) {
            this.closed = true;
            this.paused = true;
        }
    }

    applyState(state: ConsumerState) {
        if (this.closed) {
            return;
        }
        if (this.#lastSeen >= state.time) {
            return;
        }
        this.#lastSeen = state.time;
        this.paused = state.paused;
        this.closed = state.closed;
        if (this.closed) {
            this.onClosed();
        }
    }
}