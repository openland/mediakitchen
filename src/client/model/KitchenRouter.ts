import { Router } from './../Router';
import { KitchenWebRtcTransport } from './KitchentWebRtcTransport';
import { SimpleMap } from '../../wire/common';
import { WebRTCTransportCreateCommand } from '../../wire/commands';
import { KitchenApi } from './KitchenApi';

export class KitchenRouter {
    id: string;
    api: KitchenApi
    appData: SimpleMap;
    alive: boolean = true;
    facade: Router;

    constructor(id: string, appData: SimpleMap, api: KitchenApi) {
        this.id = id;
        this.api = api;
        this.appData = Object.freeze(appData);
        this.facade = new Router(this);
    }

    async createWebRTCTransport(args: WebRTCTransportCreateCommand['args'], retryKey: string) {
        let res = await this.api.createWebRtcTransport(this.id, args, retryKey);
        return new KitchenWebRtcTransport(
            res.transportId,
            args.appData || {},
            res.dtlsParameters,
            res.iceParameters,
            this.api
        );
    }

    async close() {
        await this.api.closeRouter(this.id);
        this.onClosed();
    }

    onClosed() {
        if (this.alive) {
            this.alive = false;
            // TODO: Implement
        }
    }

    onRouterDead() {
        if (this.alive) {
            this.alive = false;
            // TODO: Implement
        }
    }
}