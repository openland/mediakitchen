import { PlainTransport } from '../PlainTransport';
import { TransportTuple, SctpParameters, SrtpParameters, PlainTransportState, SctpState } from 'mediakitchen-common';
import { KitchenApi } from './KitchenApi';
import { KitchenTransport } from './KitchenTransport';

export class KitchenTransportPlain extends KitchenTransport<PlainTransportState> {

    tuple: TransportTuple;
    rtcpTuple: TransportTuple | null;
    sctpParameters: SctpParameters | null;
    srtpParameters: SrtpParameters | null;
    sctpState: SctpState | null;

    facade: PlainTransport;

    constructor(
        id: string,
        state: PlainTransportState,
        api: KitchenApi
    ) {
        super(id, state, api);

        this.tuple = state.tuple;
        this.rtcpTuple = state.rtcpTuple;
        this.sctpParameters = state.sctpParameters;
        this.srtpParameters = state.srtpParameters;
        this.sctpState = state.sctpState;

        this.facade = new PlainTransport(this);
    }

    async connect(args: {
        ip?: string,
        port?: number,
        rtcpPort?: number,
        srtpParameters?: SrtpParameters
    }) {
        if (this.closed) {
            throw Error('Transport already closed');
        }
        let r = await this.api.connectPlainTransport({ id: this.id, ...args });
        if (this.closed) {
            throw Error('Transport already closed');
        }
        this.applyState(r);
    }

    applyClosed() {
        if (this.sctpState) {
            this.sctpState = 'closed';
        }
    }

    applyStateInternal(state: PlainTransportState) {
        this.tuple = state.tuple;
        this.rtcpTuple = state.rtcpTuple;
        this.sctpParameters = state.sctpParameters;
        this.srtpParameters = state.srtpParameters;
        this.sctpState = state.sctpState;
    }

    async invokeClose() {
        await this.api.closePlainTransport(this.id);
    }
}