import { RouterCreateCommand } from 'mediakitchen-common';
import { KitchenWorker } from './model/KitchenWorker';

export class Worker {
    #worker: KitchenWorker

    constructor(worker: KitchenWorker) {
        this.#worker = worker;
        Object.freeze(this);
    }

    get id() {
        return this.#worker.id;
    }

    get appData() {
        return this.#worker.appData;
    }

    get status() {
        return this.#worker.status;
    }

    async createRouter(args: RouterCreateCommand['args'], retryKey: string) {
        return (await this.#worker.createRouter(args, retryKey)).facade;
    }

    kill() {
        return this.#worker.kill();
    }
}