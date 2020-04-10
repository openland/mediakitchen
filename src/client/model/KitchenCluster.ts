import * as nats from 'ts-nats';
import { SimpleMap } from '../../wire/common';
import { eventCodec, Event } from '../../wire/events';
import { KitchenWorker } from './KitchenWorker';

export class KitchenCluster {
    client: nats.Client
    #subscription!: nats.Subscription;
    #alive: boolean = true;
    #workers = new Map<string, { worker: KitchenWorker, lastSeen: number, timer: any }>();
    onWorkerStatusChanged?: (worker: KitchenWorker) => void;

    constructor(client: nats.Client) {
        this.client = client;
    }

    get alive() {
        return this.#alive;
    }

    async awaitWorkersReporting() {
        await new Promise((r) => setTimeout(r, 5000));
    }

    getWorkers() {
        let res: KitchenWorker[] = [];
        for (let e of this.#workers.values()) {
            res.push(e.worker);
        }
        return res;
    }

    close() {
        if (this.#alive) {
            this.#alive = false;
            if (this.#subscription) {
                this.#subscription.unsubscribe();
            }
            return;
        }
    }

    #onEvent = (event: Event) => {
        if (event.type === 'report') {
            if (event.state === 'alive') {
                this.#onWorkerAlive(event.workerId, event.time, event.appData);
            } else if (event.state === 'dead') {
                this.#onWorkerDead(event.workerId);
            }
        } else if (event.type === 'router-closed') {
            this.#onRouterClosed(event.workerId, event.routerId);
        }
    }

    //
    // Worker Lifecycle
    //

    #onWorkerAlive = (id: string, time: number, appData: SimpleMap) => {
        if (!this.#workers.has(id)) {
            let timer = setTimeout(() => {
                this.#onWorkerTimeout(id);
            }, 10000);
            this.#workers.set(id, { worker: new KitchenWorker(id, appData, this), lastSeen: time, timer });
        } else {
            let ex = this.#workers.get(id)!;
            if (ex.lastSeen > time) {
                return;
            }
            ex.worker.onReport();

            if (ex.worker.status === 'dead') {
                return;
            }
            ex.lastSeen = time;
            clearTimeout(ex.timer);
            ex.timer = setTimeout(() => {
                this.#onWorkerTimeout(id);
            }, 10000);
        }
    }

    #onWorkerDead = (id: string) => {
        let ex = this.#workers.get(id)!;
        if (!ex) {
            return;
        }
        ex.worker.onDead();
        clearTimeout(ex.timer);
    }

    #onWorkerTimeout = (id: string) => {
        let ex = this.#workers.get(id)!;
        if (!ex) {
            return;
        }
        ex.worker.onReportTimeout();
    }

    //
    // Events
    //

    #onRouterClosed = (workerId: string, routerId: string) => {
        if (this.#workers.has(workerId)) {
            this.#workers.get(workerId)!.worker.onRouterClosed(routerId);
        }
    }

    //
    // Private
    //

    init = async () => {
        this.#subscription = await this.client.subscribe('mediakitchen/report', (err, msg) => {
            let event = msg.data;
            if (eventCodec.is(event)) {
                this.#onEvent(event);
            }
        });
    }
}