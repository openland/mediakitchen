import {
    IceCandidate,
    DtlsState,
    IceState,
    WebRtcTransportState,
    DtlsParameters,
    IceParameters,
} from 'mediakitchen-common';
import { WebRtcTransport } from '../WebRtcTransport';
import { KitchenApi } from './KitchenApi';
import { KitchenTransport } from './KitchenTransport';

export class KitchenTransportWebRTC extends KitchenTransport<WebRtcTransportState> {

    dtlsParameters: DtlsParameters;
    dtlsState: DtlsState;

    iceParameters: IceParameters;
    iceCandidates: IceCandidate[];
    iceState: IceState;

    facade: WebRtcTransport;

    constructor(
        id: string,
        state: WebRtcTransportState,
        api: KitchenApi
    ) {
        super(id, state, api);

        this.dtlsParameters = state.dtlsParameters;
        this.dtlsState = state.dtlsState;

        this.iceParameters = state.iceParameters;
        this.iceCandidates = state.iceCandidates;
        this.iceState = state.iceState;

        this.facade = new WebRtcTransport(this);
    }

    async connect(args: { dtlsParameters: DtlsParameters }) {
        if (this.closed) {
            throw Error('Transport already closed');
        }
        let r = await this.api.connectWebRtcTransport({ id: this.id, dtlsParameters: args.dtlsParameters });
        if (this.closed) {
            throw Error('Transport already closed');
        }
        this.applyState(r);
    }

    async restartIce() {
        if (this.closed) {
            throw Error('Transport already closed');
        }
        let r = await this.api.restartWebRtcTransport(this.id);
        if (this.closed) {
            throw Error('Transport already closed');
        }
        this.applyState(r);
    }

    applyStateInternal(state: WebRtcTransportState) {
        this.dtlsState = state.dtlsState;
        this.iceState = state.iceState;
        this.iceParameters = state.iceParameters;
        this.iceCandidates = state.iceCandidates;
    }

    applyClosed() {
        this.dtlsState = 'closed';
        this.iceState = 'closed';
    }

    async invokeClose() {
        await this.api.closeWebRtcTransport(this.id);
    }
}