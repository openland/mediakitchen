import { KitchenConsumer } from './model/KitchenConsumer';
export class Consumer {
    #consumer: KitchenConsumer

    constructor(consumer: KitchenConsumer) {
        this.#consumer = consumer;
        Object.freeze(this);
    }

    get id() {
        return this.#consumer.id;
    }

    get appData() {
        return this.#consumer.appData;
    }

    get kind() {
        return this.#consumer.kind;
    }

    get type() {
        return this.#consumer.type;
    }

    get paused() {
        return this.#consumer.paused;
    }

    get closed() {
        return this.#consumer.closed;
    }

    get rtpParameters() {
        return this.#consumer.rtpParameters;
    }

    async pause() {
        await this.#consumer.pause();
    }

    async resume() {
        await this.#consumer.resume();
    }

    async getStats() {
        return this.#consumer.getStats();
    }

    async close() {
        await this.#consumer.close();
    }
}