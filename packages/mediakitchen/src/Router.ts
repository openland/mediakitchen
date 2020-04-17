import { WebRTCTransportCreateCommand } from 'mediakitchen-common';
import { KitchenRouter } from './model/KitchenRouter';
export class Router {
    #router: KitchenRouter

    constructor(router: KitchenRouter) {
        this.#router = router;
        Object.freeze(this);
    }

    get id() {
        return this.#router.id;
    }

    get appData() {
        return this.#router.appData;
    }

    get closed() {
        return this.#router.closed;
    }

    async createWebRtcTransport(args: WebRTCTransportCreateCommand['args'], retryKey: string) {
        return (await this.#router.createWebRTCTransport(args, retryKey)).facade;
    }

    async close() {
        await this.#router.close();
    }
}