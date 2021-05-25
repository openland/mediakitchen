import { KitchenApi } from './model/KitchenApi';
import {
    RouterCreateCommand,
    WebRTCTransportCreateCommand,
    WebRTCTransportConnectCommand,
    ProduceCommand,
    ConsumeCommand,
    PlainTransportCreateCommand,
    PipeTransportCreateCommand,
    PlainTransportConnectCommand,
    PipeTransportConnectCommand,
} from 'mediakitchen-common';

export class WorkerApi {
    readonly #api: KitchenApi;
    constructor(api: KitchenApi) {
        this.#api = api;
    }

    createRouter = (command: RouterCreateCommand['args'], retryKey: string) => {
        return this.#api.createRouter(command, retryKey);
    }

    closeRouter = (id: string) => {
        return this.#api.closeRouter(id);
    }

    createWebRtcTransport = (routerId: string, command: WebRTCTransportCreateCommand['args'], retryKey: string) => {
        return this.#api.createWebRtcTransport(routerId, command, retryKey);
    }

    connectWebRtcTransport = (command: WebRTCTransportConnectCommand['args']) => {
        return this.#api.connectWebRtcTransport(command);
    }

    restartWebRtcTransport = (id: string) => {
        return this.#api.restartWebRtcTransport(id);
    }

    closeWebRtcTransport = (id: string) => {
        return this.#api.closeWebRtcTransport(id);
    }

    getWebRtcTransportStats = (id: string) => {
        return this.#api.getWebRtcTransportStats(id);
    }

    createPlainTransport = (routerId: string, command: PlainTransportCreateCommand['args'], retryKey: string) => {
        return this.#api.createPlainTransport(routerId, command, retryKey);
    }

    connectPlainTransport = (command: PlainTransportConnectCommand['args']) => {
        return this.#api.connectPlainTransport(command);
    }

    closePlainTransport = (id: string) => {
        return this.#api.closePlainTransport(id);
    }

    getPlainTransportStats = (id: string) => {
        return this.#api.getPlainTransportStats(id);
    }

    createPipeTransport = (routerId: string, command: PipeTransportCreateCommand['args'], retryKey: string) => {
        return this.#api.createPipeTransport(routerId, command, retryKey);
    }

    connectPipeTransport = (command: PipeTransportConnectCommand['args']) => {
        return this.#api.connectPipeTransport(command);
    }

    closePipeTransport = (id: string) => {
        return this.#api.closePipeTransport(id);
    }

    getPipeTransportStats = (id: string) => {
        return this.#api.getPipeTransportStats(id);
    }

    createProducer = (transportId: string, command: ProduceCommand['args'], retryKey: string) => {
        return this.#api.createProducer(transportId, command, retryKey);
    }

    pauseProducer = (producerId: string) => {
        return this.#api.pauseProducer(producerId);
    }

    resumeProducer = (producerId: string) => {
        return this.#api.resumeProducer(producerId);
    }

    closeProducer = (producerId: string) => {
        return this.#api.closeProducer(producerId);
    }

    getProducerStats = (id: string) => {
        return this.#api.getProducerStats(id);
    }

    createConsumer = (transportId: string, producerId: string, command: ConsumeCommand['args'], retryKey: string) => {
        return this.#api.createConsumer(transportId, producerId, command, retryKey);
    }

    pauseConsumer = (consumerId: string) => {
        return this.#api.pauseConsumer(consumerId);
    }

    resumeConsumer = (consumerId: string) => {
        return this.#api.resumeConsumer(consumerId);
    }

    closeConsumer = (consumerId: string) => {
        return this.#api.closeConsumer(consumerId);
    }

    getConsumerStats = (id: string) => {
        return this.#api.getConsumerStats(id);
    }
}