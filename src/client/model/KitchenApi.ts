import { ConnectionInfo } from './../ConnectionInfo';
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
    getEventsResponseCodec
} from './../../wire/commands';
import * as nats from 'ts-nats';
import * as t from 'io-ts';
import { eventBoxCodec, Event } from '../../wire/events';
import { backoff } from '../../utils/backoff';

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

    createRouter = async (command: RouterCreateCommand['args'], retryKey: string) => {
        return await this.#doCommand({ type: 'router-create', args: command }, retryKey, routerCreateResponseCodec);
    }

    closeRouter = async (id: string) => {
        return await this.#doCommand({ type: 'router-close', args: { id } }, '', routerCloseResponseCodec);
    }

    // WebRTC Transport

    createWebRtcTransport = async (routerId: string, command: WebRTCTransportCreateCommand['args'], retryKey: string) => {
        return await this.#doCommand({ type: 'transport-webrtc-create', routerId, args: command }, retryKey, webRTCTransportCreateResponseCodec);
    }

    connectWebRtcTransport = async (command: WebRTCTransportConnectCommand['args']) => {
        return await this.#doCommand({ type: 'transport-webrtc-connect', args: command }, '', webRtcTransportConnectResponseCodec);
    }

    closeWebRtcTransport = async (id: string) => {
        return await this.#doCommand({ type: 'transport-webrtc-close', args: { id } }, '', webRtcTransportCloseResponseCodec);
    }

    // Producer

    createProducer = async (transportId: string, command: ProduceCommand['args'], retryKey: string) => {
        return await this.#doCommand({ type: 'produce-create', transportId, args: command }, retryKey, produceResponseCodec)
    }

    pauseProducer = async (producerId: string) => {
        return await this.#doCommand({ type: 'produce-pause', args: { id: producerId } }, '', producePauseResponseCodec);
    }

    resumeProducer = async (producerId: string) => {
        return await this.#doCommand({ type: 'produce-resume', args: { id: producerId } }, '', produceResumeResponseCodec);
    }

    closeProducer = async (producerId: string) => {
        return await this.#doCommand({ type: 'produce-close', args: { id: producerId } }, '', produceCloseResponseCodec);
    }

    // Consumer

    createConsumer = async (transportId: string, producerId: string, command: ConsumeCommand['args'], retryKey: string) => {
        return await this.#doCommand({ type: 'consume-create', transportId, producerId, args: command }, retryKey, consumeResponseCodec);
    }

    pauseConsumer = async (consumerId: string) => {
        return await this.#doCommand({ type: 'consume-pause', args: { id: consumerId } }, '', consumePauseResponseCodec);
    }

    resumeConsumer = async (consumerId: string) => {
        return await this.#doCommand({ type: 'consume-resume', args: { id: consumerId } }, '', consumeResumeResponseCodec);
    }

    closeConsumer = async (consumerId: string) => {
        return await this.#doCommand({ type: 'consume-close', args: { id: consumerId } }, '', consumeCloseResponseCodec);
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
}