import { PlainTransportCreateCommand, WebRTCTransportCreateCommand, PipeTransportCreateCommand } from 'mediakitchen-common';
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

    async createPlainTransport(args: PlainTransportCreateCommand['args'], retryKey: string) {
        return (await this.#router.createPlainTransport(args, retryKey)).facade;
    }

    async createPipeTransport(args: PipeTransportCreateCommand['args'], retryKey: string) {
        return (await this.#router.createPipeTransport(args, retryKey)).facade;
    }

    async close() {
        await this.#router.close();
    }

    toString() {
        return `Router{id:${this.id},closed:${this.closed},appData:${JSON.stringify(this.appData)}}`;
    }
}