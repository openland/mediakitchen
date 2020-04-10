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
    consumeResponseCodec
} from './../../wire/commands';
import * as nats from 'ts-nats';
import * as t from 'io-ts';

export class KitchenApi {
    #client: nats.Client
    #id: string;

    constructor(id: string, client: nats.Client) {
        this.#id = id;
        this.#client = client;
    }

    // Router

    createRouter = async (command: RouterCreateCommand['args'], retryKey: string) => {
        return await this.#doCommand({ type: 'router-create', args: command }, retryKey, routerCreateResponseCodec);
    }

    closeRouter = async (id: string) => {
        return await this.#doCommand({ type: 'router-close', args: { id } }, 'close-router-' + id, routerCloseResponseCodec);
    }

    // WebRTC Transport

    createWebRtcTransport = async (routerId: string, command: WebRTCTransportCreateCommand['args'], retryKey: string) => {
        return await this.#doCommand({ type: 'transport-webrtc-create', routerId, args: command }, retryKey, webRTCTransportCreateResponseCodec);
    }

    connectWebRtcTransport = async (command: WebRTCTransportConnectCommand['args']) => {
        return await this.#doCommand({ type: 'transport-webrtc-connect', args: command }, 'close-webrtc-connect-' + command.id, webRtcTransportConnectResponseCodec);
    }

    closeWebRtcTransport = async (id: string) => {
        return await this.#doCommand({ type: 'transport-webrtc-close', args: { id } }, 'close-webrtc-transport-' + id, webRtcTransportCloseResponseCodec);
    }

    // Producer

    createProducer = async (transportId: string, command: ProduceCommand['args'], retryKey: string) => {
        return await this.#doCommand({ type: 'produce-create', transportId, args: command }, retryKey, produceResponseCodec)
    }

    closeProducer = async (producerId: string) => {
        return await this.#doCommand({ type: 'produce-close', args: { id: producerId } }, 'producer-' + producerId, produceCloseResponseCodec);
    }

    // Consumer

    createConsumer = async (transportId: string, producerId: string, command: ConsumeCommand['args'], retryKey: string) => {
        return await this.#doCommand({ type: 'consume-create', transportId, producerId, args: command }, retryKey, consumeResponseCodec);
    }

    // Worker

    killWorker = async () => {
        await this.#doCommand({ type: 'worker-kill' }, 'worker-kill', t.type({}));
    }

    // Implementation

    #doCommand = async<T>(command: Commands, repeatKey: string, responseCodec: t.Type<T>): Promise<T> => {
        let box: CommandBox = {
            command,
            repeatKey,
            time: Date.now()
        };
        let res = await this.#client.request('mediakitchen/worker/' + this.#id, 5000, box);
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