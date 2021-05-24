import { ProduceCommand, ConsumeCommand } from 'mediakitchen-common';
import { DtlsParameters } from 'mediakitchen-common';
import { KitchenTransportWebRTC } from './model/KitchenTransportWebRTC';

export class WebRtcTransport {
    #transport: KitchenTransportWebRTC

    constructor(transport: KitchenTransportWebRTC) {
        this.#transport = transport;
        Object.freeze(this);
    }

    get id() {
        return this.#transport.id;
    }

    get closed() {
        return this.#transport.closed;
    }

    get dtlsParameters() {
        return this.#transport.dtlsParameters;
    }

    get dtlsState() {
        return this.#transport.dtlsState;
    }

    get iceParameters() {
        return this.#transport.iceParameters;
    }

    get iceCandidates() {
        return this.#transport.iceCandidates;
    }

    get iceState() {
        return this.#transport.iceState;
    }

    get appData() {
        return this.#transport.appData;
    }

    async connect(args: { dtlsParameters: DtlsParameters }) {
        await this.#transport.connect(args);
    }

    async restartIce() {
        await this.#transport.restartIce();
    }

    async produce(args: ProduceCommand['args'], retryKey: string) {
        return (await this.#transport.produce(args, retryKey)).facade;
    }

    async consume(producerId: string, args: ConsumeCommand['args'], retryKey: string) {
        return (await this.#transport.consume(producerId, args, retryKey)).facade;
    }

    async close() {
        await this.#transport.close();
    }

    toString() {
        return `WebRTCTransport{id:${this.id},closed:${this.closed},appData:${JSON.stringify(this.appData)}}`;
    }
}