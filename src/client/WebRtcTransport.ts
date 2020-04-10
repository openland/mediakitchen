import { DtlsParameters } from './../wire/common';
import { KitchenWebRtcTransport } from './model/KitchentWebRtcTransport';

export class WebRtcTransport {
    #transport: KitchenWebRtcTransport

    constructor(transport: KitchenWebRtcTransport) {
        this.#transport = transport;
    }

    get dtlsParameters() {
        return this.#transport.dtlsParameters;
    }

    get iceParameters() {
        return this.#transport.iceParameters;
    }

    async connect(args: { dtlsParameters: DtlsParameters }) {
        await this.#transport.connect(args);
    }

    async close() {
        await this.#transport.close();
    }
}