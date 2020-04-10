import { WebRtcTransport } from './../WebRtcTransport';
import { KitchenConsumer } from './KitchenConsumer';
import { KitchenProducer } from './KitchenProducer';
import { ProduceCommand, ConsumeCommand } from '../../wire/commands';
import { SimpleMap, DtlsParameters, IceParameters } from '../../wire/common';
import { KitchenApi } from './KitchenApi';

export class KitchenWebRtcTransport {
    id: string;
    api: KitchenApi;
    appData: SimpleMap;
    dtlsParameters: DtlsParameters;
    iceParameters: IceParameters;
    facade: WebRtcTransport;

    constructor(
        id: string,
        appData: SimpleMap,
        dtlsParameters: DtlsParameters,
        iceParameters: IceParameters,
        api: KitchenApi
    ) {
        this.id = id;
        this.appData = appData;
        this.api = api;
        this.dtlsParameters = dtlsParameters;
        this.iceParameters = iceParameters;
        this.facade = new WebRtcTransport(this);
    }

    async connect(args: { dtlsParameters: DtlsParameters }) {
        await this.api.connectWebRtcTransport({ id: this.id, dtlsParameters: args.dtlsParameters });
    }

    async produce(args: ProduceCommand['args'], retryKey: string) {
        let res = await this.api.createProducer(this.id, args as ProduceCommand['args'], retryKey);
        return new KitchenProducer(res.id, args.appData || {}, res.paused, this.api);
    }

    async consume(producerId: string, args: ConsumeCommand['args'], retryKey: string) {
        let res = await this.api.createConsumer(this.id, producerId, args, retryKey);
        return new KitchenConsumer(res.id, args.appData || {}, this.api);
    }

    async close() {
        await this.api.closeWebRtcTransport(this.id);
    }
}