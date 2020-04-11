import * as nats from 'ts-nats';
import { reportCodec, SimpleMap } from 'mediakitchen-common';
import { ConnectionInfo } from './../ConnectionInfo';
import { KitchenWorker } from './KitchenWorker';

export class KitchenCluster {
    readonly connectionInfo: ConnectionInfo;

    #client: nats.Client
    #rootTopic: string;
    #subscription!: nats.Subscription;
    #alive: boolean = true;
    #workers = new Map<string, { worker: KitchenWorker, lastSeen: number, timer: any }>();

    onWorkerStatusChanged?: (worker: KitchenWorker) => void;

    constructor(connectionInfo: ConnectionInfo) {
        this.#client = connectionInfo.nc;
        this.#rootTopic = connectionInfo.rootTopic || 'mediakitchen';
        this.connectionInfo = connectionInfo;
    }

    get alive() {
        return this.#alive;
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

    //
    // Worker Lifecycle
    //

    connect = async () => {
        this.#subscription = await this.#client.subscribe(this.#rootTopic + '.report', (err, msg) => {
            let event = msg.data;
            if (reportCodec.is(event)) {
                if (event.state === 'alive') {
                    this.#onWorkerAlive(event.workerId, event.time, event.appData);
                } else if (event.state === 'dead') {
                    this.#onWorkerDead(event.workerId);
                }
            }
        });
    }

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
}