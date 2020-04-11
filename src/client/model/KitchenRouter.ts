import { RouterState } from './../../wire/states';
import { Router } from './../Router';
import { KitchenWebRtcTransport } from './KitchentWebRtcTransport';
import { SimpleMap } from '../../wire/common';
import { WebRTCTransportCreateCommand } from '../../wire/commands';
import { KitchenApi } from './KitchenApi';
import { backoff } from '../../utils/backoff';

export class KitchenRouter {
    id: string;
    appData: SimpleMap;
    closed: boolean;
    closedExternally: boolean = false;
    lastSeen: number;

    api: KitchenApi
    facade: Router;

    transports = new Map<string, KitchenWebRtcTransport>();

    constructor(id: string, state: RouterState, api: KitchenApi) {
        this.id = id;
        this.appData = Object.freeze({ ...state.appData });
        this.lastSeen = state.time;
        this.closed = state.closed;

        this.api = api;
        this.facade = new Router(this);
    }

    async createWebRTCTransport(args: WebRTCTransportCreateCommand['args'], retryKey: string) {
        if (this.closed) {
            throw Error('Router is cloed');
        }
        let res = await this.api.createWebRtcTransport(this.id, args, retryKey);
        if (this.closed) {
            throw Error('Router is cloed');
        }
        if (this.transports.has(res.id)) {
            let r = this.transports.get(res.id)!;
            r.applyState(res);
            return r;
        } else {
            let ts = new KitchenWebRtcTransport(
                res.id,
                res,
                this.api
            );
            this.transports.set(res.id, ts);
            return ts;
        }
    }

    close() {
        if (!this.closed) {
            this.closed = true;
            for (let t of this.transports.values()) {
                t.onClosed();
            }
            backoff(async () => {
                if (this.closedExternally) {
                    return;
                }
                await this.api.closeRouter(this.id);
            });
        }
    }

    applyState = (state: RouterState) => {
        if (this.closed) {
            return;
        }
        if (this.lastSeen > state.time) {
            return;
        }
        this.lastSeen = state.time;
        this.closed = state.closed;
        if (this.closed) {
            this.onClosed();
        }
    }

    onClosed() {
        this.closedExternally = true;
        if (!this.closed) {
            this.closed = true;
            for (let t of this.transports.values()) {
                t.onClosed();
            }
        }
    }
}