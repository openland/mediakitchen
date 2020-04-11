import { ProduceCommand, ConsumeCommand } from 'mediakitchen-common';
import { DtlsParameters } from 'mediakitchen-common';
import { KitchenWebRtcTransport } from './model/KitchentWebRtcTransport';

export class WebRtcTransport {
    #transport: KitchenWebRtcTransport

    constructor(transport: KitchenWebRtcTransport) {
        this.#transport = transport;
        Object.freeze(this);
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

    async connect(args: { dtlsParameters: DtlsParameters }) {
        await this.#transport.connect(args);
    }

    async produce(args: ProduceCommand['args'], retryKey: string) {
        return (await this.#transport.produce(args, retryKey)).facade;
    }

    async consume(producerId: string, args: ConsumeCommand['args'], retryKey: string) {
        return (await this.#transport.consume(producerId, args, retryKey)).facade;
    }

    close() {
        this.#transport.close();
    }
}