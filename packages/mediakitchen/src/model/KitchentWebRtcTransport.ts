import {
    IceCandidate,
    DtlsState,
    IceState,
    WebRtcTransportState,
    ProduceCommand,
    ConsumeCommand,
    SimpleMap,
    DtlsParameters,
    IceParameters,
    backoff
} from 'mediakitchen-common';
import { WebRtcTransport } from '../WebRtcTransport';
import { KitchenConsumer } from './KitchenConsumer';
import { KitchenProducer } from './KitchenProducer';
import { KitchenApi } from './KitchenApi';

export class KitchenWebRtcTransport {
    id: string;
    appData: SimpleMap;

    closed: boolean;
    closedExternally: boolean = false;
    lastSeen: number;

    dtlsParameters: DtlsParameters;
    dtlsState: DtlsState;

    iceParameters: IceParameters;
    iceCandidates: IceCandidate[];
    iceState: IceState;

    api: KitchenApi;
    facade: WebRtcTransport;

    producers = new Map<string, KitchenProducer>();
    consumers = new Map<string, KitchenConsumer>();

    constructor(
        id: string,
        state: WebRtcTransportState,
        api: KitchenApi
    ) {
        this.id = id;
        this.appData = state.appData;
        this.api = api;

        this.closed = state.closed;
        this.lastSeen = state.time;

        this.dtlsParameters = state.dtlsParameters;
        this.dtlsState = state.dtlsState;

        this.iceParameters = state.iceParameters;
        this.iceCandidates = state.iceCandidates;
        this.iceState = state.iceState;

        this.facade = new WebRtcTransport(this);
    }

    async connect(args: { dtlsParameters: DtlsParameters }) {
        if (this.closed) {
            throw Error('Transport already closed');
        }
        let r = await this.api.connectWebRtcTransport({ id: this.id, dtlsParameters: args.dtlsParameters });
        if (this.closed) {
            throw Error('Transport already closed');
        }
        this.applyState(r);
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
            this.dtlsState = 'closed';
            this.iceState = 'closed';
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
                await this.api.closeWebRtcTransport(this.id)
            });
        }
    }

    applyState(state: WebRtcTransportState) {
        if (this.closed) {
            return;
        }
        if (this.lastSeen >= state.time) {
            return;
        }

        this.closed = state.closed;
        this.dtlsState = state.dtlsState;
        this.iceState = state.iceState;
        if (this.closed) {
            this.onClosed();
        }
    }

    onClosed = () => {
        this.closedExternally = true;
        if (!this.closed) {
            this.closed = true;
            this.dtlsState = 'closed';
            this.iceState = 'closed';

            for (let p of this.producers.values()) {
                p.onClosed();
            }
            for (let c of this.consumers.values()) {
                c.onClosed();
            }
        }
    }
}