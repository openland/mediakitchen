import { ProduceCommand, ConsumeCommand, SrtpParameters } from 'mediakitchen-common';
import { KitchenTransportPipe } from './model/KitchenTransportPipe';

export class PipeTransport {
    #transport: KitchenTransportPipe

    constructor(transport: KitchenTransportPipe) {
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

    get sctpState() {
        return this.#transport.sctpState;
    }

    get sctpParameters() {
        return this.#transport.sctpParameters;
    }

    get srtpParameters() {
        return this.#transport.srtpParameters;
    }

    async connect(args: { ip: string, port: number, srtpParameters?: SrtpParameters }) {
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

    async getStats() {
        return this.#transport.getStats();
    }

    toString() {
        return `PipeTransport{` +
            `id:${this.id},` +
            `tuple:${JSON.stringify(this.tuple)},` +
            `sctpState:${this.sctpState},` +
            `sctpParameters:${JSON.stringify(this.sctpParameters)},` +
            `srtpParameters:${JSON.stringify(this.srtpParameters)},` +
            `closed:${this.closed},` +
            `appData:${JSON.stringify(this.appData)}` +
            `}`;
    }
}