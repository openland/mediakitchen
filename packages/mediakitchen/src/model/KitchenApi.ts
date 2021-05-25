import { WebRtcTransportStats, PipeTransportStats, PlainTransportStats } from './../Stats';
import { ConnectionInfo } from '../ConnectionInfo';
import {
    Commands,
    CommandBox,
    routerCloseResponseCodec,
    RouterCreateCommand,
    routerCreateResponseCodec,
    WebRTCTransportCreateCommand,
    webRTCTransportCreateResponseCodec,
    webRtcTransportCloseResponseCodec,
    WebRTCTransportConnectCommand,
    webRtcTransportConnectResponseCodec,
    ProduceCommand,
    produceResponseCodec,
    produceCloseResponseCodec,
    ConsumeCommand,
    consumeResponseCodec,
    producePauseResponseCodec,
    produceResumeResponseCodec,
    consumeCloseResponseCodec,
    consumePauseResponseCodec,
    consumeResumeResponseCodec,
    getStateResponseCodec,
    getEventsResponseCodec,
    eventBoxCodec,
    Event,
    backoff,
    PlainTransportCreateCommand,
    plainTransportCreateResponseCodec,
    plainTransportCloseResponseCodec,
    PipeTransportCreateCommand,
    PlainTransportConnectCommand,
    webRtcTransportRestartResponseCodec,
    pipeTransportCreateResponseCodec,
    PipeTransportConnectCommand,
    pipeTransportConnectResponseCodec,
    pipeTransportCloseResponseCodec,
    statsResponseCodec
} from 'mediakitchen-common';
import * as nats from 'ts-nats';
import * as t from 'io-ts';
import { ConsumerStats, ProducerStats } from '../Stats';

export class KitchenApi {
    #id: string;
    #seq!: number;
    #invalidating: boolean = false;
    #pending = new Map<number, Event>();
    #closed = false;
    #rootTopic: string

    #subscription: nats.Subscription | null = null;
    #client: nats.Client

    onEvent?: (event: Event) => void;

    constructor(id: string, connectionInfo: ConnectionInfo) {
        this.#id = id;
        this.#client = connectionInfo.nc;
        this.#rootTopic = connectionInfo.rootTopic || 'mediakitchen';
        this.#init();
    }

    // Router

    createRouter = (command: RouterCreateCommand['args'], retryKey: string) => {
        return this.#doCommand({ type: 'router-create', args: command }, retryKey, routerCreateResponseCodec);
    }

    closeRouter = (id: string) => {
        return this.#doCommand({ type: 'router-close', args: { id } }, '', routerCloseResponseCodec);
    }

    // WebRTC Transport

    createWebRtcTransport = (routerId: string, command: WebRTCTransportCreateCommand['args'], retryKey: string) => {
        return this.#doCommand({ type: 'transport-webrtc-create', routerId, args: command }, retryKey, webRTCTransportCreateResponseCodec);
    }

    connectWebRtcTransport = (command: WebRTCTransportConnectCommand['args']) => {
        return this.#doCommand({ type: 'transport-webrtc-connect', args: command }, '', webRtcTransportConnectResponseCodec);
    }

    restartWebRtcTransport = (id: string) => {
        return this.#doCommand({ type: 'transport-webrtc-restart', args: { id } }, '', webRtcTransportRestartResponseCodec);
    }

    closeWebRtcTransport = (id: string) => {
        return this.#doCommand({ type: 'transport-webrtc-close', args: { id } }, '', webRtcTransportCloseResponseCodec);
    }

    getWebRtcTransportStats = (id: string) => {
        return this.#getStats<WebRtcTransportStats>(id);
    }

    // Plain Transport

    createPlainTransport = (routerId: string, command: PlainTransportCreateCommand['args'], retryKey: string) => {
        return this.#doCommand({ type: 'transport-plain-create', routerId, args: command }, retryKey, plainTransportCreateResponseCodec);
    }

    connectPlainTransport = (command: PlainTransportConnectCommand['args']) => {
        return this.#doCommand({ type: 'transport-plain-connect', args: command }, '', plainTransportCreateResponseCodec);
    }

    closePlainTransport = (id: string) => {
        return this.#doCommand({ type: 'transport-plain-close', args: { id } }, '', plainTransportCloseResponseCodec);
    }

    getPlainTransportStats = (id: string) => {
        return this.#getStats<PlainTransportStats>(id);
    }

    // Pipe Transport

    createPipeTransport = (routerId: string, command: PipeTransportCreateCommand['args'], retryKey: string) => {
        return this.#doCommand({ type: 'transport-pipe-create', routerId, args: command }, retryKey, pipeTransportCreateResponseCodec);
    }

    connectPipeTransport = (command: PipeTransportConnectCommand['args']) => {
        return this.#doCommand({ type: 'transport-pipe-connect', args: command }, '', pipeTransportConnectResponseCodec);
    }

    closePipeTransport = (id: string) => {
        return this.#doCommand({ type: 'transport-pipe-close', args: { id } }, '', pipeTransportCloseResponseCodec);
    }

    getPipeTransportStats = (id: string) => {
        return this.#getStats<PipeTransportStats>(id);
    }

    // Producer

    createProducer = (transportId: string, command: ProduceCommand['args'], retryKey: string) => {
        return this.#doCommand({ type: 'produce-create', transportId, args: command }, retryKey, produceResponseCodec)
    }

    pauseProducer = (producerId: string) => {
        return this.#doCommand({ type: 'produce-pause', args: { id: producerId } }, '', producePauseResponseCodec);
    }

    resumeProducer = (producerId: string) => {
        return this.#doCommand({ type: 'produce-resume', args: { id: producerId } }, '', produceResumeResponseCodec);
    }

    closeProducer = (producerId: string) => {
        return this.#doCommand({ type: 'produce-close', args: { id: producerId } }, '', produceCloseResponseCodec);
    }

    getProducerStats = (id: string) => {
        return this.#getStats<ProducerStats>(id);
    }

    // Consumer

    createConsumer = (transportId: string, producerId: string, command: ConsumeCommand['args'], retryKey: string) => {
        return this.#doCommand({ type: 'consume-create', transportId, producerId, args: command }, retryKey, consumeResponseCodec);
    }

    pauseConsumer = (consumerId: string) => {
        return this.#doCommand({ type: 'consume-pause', args: { id: consumerId } }, '', consumePauseResponseCodec);
    }

    resumeConsumer = (consumerId: string) => {
        return this.#doCommand({ type: 'consume-resume', args: { id: consumerId } }, '', consumeResumeResponseCodec);
    }

    closeConsumer = (consumerId: string) => {
        return this.#doCommand({ type: 'consume-close', args: { id: consumerId } }, '', consumeCloseResponseCodec);
    }

    getConsumerStats = (id: string) => {
        return this.#getStats<ConsumerStats>(id);
    }

    // Worker

    killWorker = async () => {
        await this.#doCommand({ type: 'worker-kill' }, '', t.type({}));
    }

    getState = async () => {
        return await this.#doCommand({ type: 'worker-state' }, '', getStateResponseCodec);
    }

    getEvents = async (seq: number) => {
        return await this.#doCommand({ type: 'worker-events', seq, batchSize: 500 }, '', getEventsResponseCodec);
    }

    //
    // Close 
    //

    close() {
        if (!this.#closed) {
            this.#closed = true;
            if (this.#subscription) {
                this.#subscription.unsubscribe();
                this.#subscription = null;
            }
        }
    }

    //
    // Implementation
    //

    #init = async () => {
        let subscription = await this.#client.subscribe(this.#rootTopic + '.' + this.#id + '.events', (e, msg) => {
            if (this.#closed) {
                return;
            }

            let box = msg.data;
            if (!box) {
                return;
            }
            if (!eventBoxCodec.is(box)) {
                return;
            }
            this.#onEvent(box.seq, box.event);
        });
        if (this.#closed) {
            subscription.unsubscribe();
            return;
        }
        this.#subscription = subscription;

        let state = await backoff(async () => {
            if (this.#closed) {
                return null;
            }
            let r = await this.getState();
            if (this.#closed) {
                return null;
            }
            return r;
        });
        if (!state) {
            return;
        }
        if (this.#closed) {
            return;
        }
        this.#seq = state.seq;
        this.#flushEvents();
    }

    #flushEvents = () => {
        // Remove Old
        let toRemove: number[] = [];
        for (let k of this.#pending.keys()) {
            if (k <= this.#seq) {
                toRemove.push(k);
            }
        }
        for (let k of toRemove) {
            this.#pending.delete(k);
        }

        // Flush next
        while (this.#pending.size > 0) {
            let ev = this.#pending.get(this.#seq + 1);
            if (ev) {
                this.#seq++;
                this.#pending.delete(this.#seq);
                if (this.onEvent) {
                    this.onEvent(ev);
                }
            } else {
                return;
            }
        }
    }

    #onEvent = (seq: number, event: Event) => {
        if (this.#seq === undefined) {
            this.#pending.set(seq, event);
        } else {
            if (seq === this.#seq + 1) {
                this.#seq = seq;
                if (this.onEvent) {
                    this.onEvent(event);
                }
                this.#flushEvents();
            } else if (seq <= this.#seq) {
                return; // Ignore
            } else {
                this.#pending.set(seq, event);
                this.#doInvalidateIfNeeded();
            }
        }
    }

    #doInvalidateIfNeeded = () => {
        if (!this.#invalidating) {
            this.#invalidating = true;
            backoff(async () => {
                while (true) {
                    if (this.#closed) {
                        return;
                    }
                    let s = this.#seq;
                    let response = (await this.getEvents(s));
                    if (this.#closed) {
                        return;
                    }
                    s++;
                    for (let e of response.events) {
                        this.#pending.set(s, e);
                        s++;
                    }
                    this.#flushEvents();
                    if (!response.hasMore) {
                        return;
                    }
                }
            });
        }
    };

    #doCommand = async<T>(command: Commands, repeatKey: string, responseCodec: t.Type<T>): Promise<T> => {
        let box: CommandBox = {
            command,
            repeatKey,
            time: Date.now()
        };
        let res = await this.#client.request(this.#rootTopic + '.' + this.#id + '.commands', 5000, box);
        if (!res.data) {
            throw Error('Unknown error');
        }
        if (res.data.response === 'success') {
            let response = res.data.data;
            if (responseCodec.is(response)) {
                return response;
            }
        } else if (res.data.response === 'error') {
            let message = res.data.message;
            if (typeof message === 'string') {
                throw Error(message);
            }
        }
        throw Error('Unknown error');
    }

    #getStats = async <T>(id: string) => {
        let res = await this.#doCommand({ type: 'get-stats', args: { id } }, '', statsResponseCodec);
        if (res.data) {
            return JSON.parse(res.data) as T;
        } else {
            return null;
        }
    }
}