import { Producer } from './../Producer';
import { RtpParameters } from './../../wire/common';
import { ProducerState } from './../../wire/states';
import { KitchenApi } from './KitchenApi';
import { SimpleMap } from "../../wire/common";
import { backoff } from '../../utils/backoff';

export class KitchenProducer {
    readonly id: string;
    readonly appData: SimpleMap;
    readonly kind: 'video' | 'audio';
    readonly type: 'simple' | 'simulcast' | 'svc';
    readonly rtpParameters: RtpParameters;
    readonly facade: Producer;
    closed: boolean;
    paused: boolean;

    #api: KitchenApi;
    #closedExternally: boolean = false;
    #lastSeen: number;


    constructor(
        id: string,
        state: ProducerState,
        api: KitchenApi
    ) {
        this.id = id;
        this.closed = state.closed;
        this.paused = state.paused;
        this.appData = state.appData;
        this.kind = state.kind
        this.type = state.type;
        this.#lastSeen = state.time;
        this.rtpParameters = state.rtpParameters;
        this.#api = api;
        this.facade = new Producer(this);
    }

    async pause() {
        if (!this.closed) {
            let r = await this.#api.pauseProducer(this.id);
            this.applyState(r);
        }
    }

    async resume() {
        if (!this.closed) {
            let r = await this.#api.resumeProducer(this.id);
            this.applyState(r);
        }
    }

    close() {
        if (!this.closed) {
            this.closed = true;
            this.paused = true;
            backoff(async () => {
                if (this.#closedExternally) {
                    return;
                }
                await this.#api.closeProducer(this.id);
            })
        }
    }

    onClosed = () => {
        this.#closedExternally = true;
        if (!this.closed) {
            this.closed = true;
            this.paused = true;
        }
    }

    applyState(state: ProducerState) {
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