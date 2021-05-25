import { PipeTransport } from '../PipeTransport';
import { TransportTuple, SctpParameters, SrtpParameters, PipeTransportState, PlainTransportState, SctpState } from 'mediakitchen-common';
import { KitchenApi } from './KitchenApi';
import { KitchenTransport } from './KitchenTransport';

export class KitchenTransportPipe extends KitchenTransport<PipeTransportState> {

    tuple: TransportTuple;
    sctpParameters: SctpParameters | null;
    srtpParameters: SrtpParameters | null;
    sctpState: SctpState | null;

    facade: PipeTransport;

    constructor(
        id: string,
        state: PipeTransportState,
        api: KitchenApi
    ) {
        super(id, state, api);

        this.tuple = state.tuple;
        this.sctpParameters = state.sctpParameters;
        this.srtpParameters = state.srtpParameters;
        this.sctpState = state.sctpState;

        this.facade = new PipeTransport(this);
    }

    async connect(args: {
        ip: string,
        port: number,
        srtpParameters?: SrtpParameters
    }) {
        if (this.closed) {
            throw Error('Transport already closed');
        }
        let r = await this.api.connectPipeTransport({ id: this.id, ...args });
        if (this.closed) {
            throw Error('Transport already closed');
        }
        this.applyState(r);
    }

    async getStats() {
        if (!this.closed) {
            return await this.api.getPipeTransportStats(this.id);
        } else {
            return null;
        }
    }

    applyClosed() {
        if (this.sctpState) {
            this.sctpState = 'closed';
        }
    }

    applyStateInternal(state: PlainTransportState) {
        this.tuple = state.tuple;
        this.sctpParameters = state.sctpParameters;
        this.srtpParameters = state.srtpParameters;
        this.sctpState = state.sctpState;
    }

    async invokeClose() {
        await this.api.closePlainTransport(this.id);
    }
}