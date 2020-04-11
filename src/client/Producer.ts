import { KitchenProducer } from './model/KitchenProducer';
export class Producer {
    #producer: KitchenProducer

    constructor(producer: KitchenProducer) {
        this.#producer = producer;
        Object.freeze(this);
    }

    get id() {
        return this.#producer.id;
    }

    get appData() {
        return this.#producer.appData;
    }

    get kind() {
        return this.#producer.kind;
    }

    get type() {
        return this.#producer.type;
    }

    get closed() {
        return this.#producer.closed;
    }

    get paused() {
        return this.#producer.paused;
    }

    get rtpParameters() {
        return this.#producer.rtpParameters;
    }

    async pause() {
        return this.#producer.pause();
    }

    async resume() {
        return this.#producer.resume();
    }

    close() {
        this.#producer.close();
    }
}