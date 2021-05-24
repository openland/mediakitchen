import { ProduceCommand, ConsumeCommand, SrtpParameters } from 'mediakitchen-common';
import { KitchenTransportPlain } from './model/KitchenTransportPlain';

export class PlainTransport {
    #transport: KitchenTransportPlain

    constructor(transport: KitchenTransportPlain) {
        this.#transport = transport;
        Object.freeze(this);
    }

    get id() {
        return this.#transport.id;
    }

    get appData() {
        return this.#transport.appData;
    }

    get closed() {
        return this.#transport.closed;
    }

    get tuple() {
        return this.#transport.tuple;
    }

    get rtcpTuple() {
        return this.#transport.rtcpTuple;
    }

    get sctpState() {
        return this.#transport.sctpState;
    }

    get sctpParameters() {
        return this.#transport.sctpParameters;
    }

    get srtpParameters() {
        return this.#transport.srtpParameters;
    }

    async connect(args: { ip?: string, port?: number, rtcpPort?: number, srtpParameters?: SrtpParameters }) {
        await this.#transport.connect(args);
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
        return `PlainTransport{id:${this.id},closed:${this.closed},appData:${JSON.stringify(this.appData)}}`;
    }
}