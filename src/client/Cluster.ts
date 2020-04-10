import * as nats from 'ts-nats';
import { Worker } from './Worker';
import { KitchenCluster } from "./model/KitchenCluster";

export class Cluster {
    #cluster: KitchenCluster;

    onWorkerStatusChanged?: (worker: Worker) => void;

    constructor(cluster: KitchenCluster) {
        this.#cluster = cluster;
        this.#cluster.onWorkerStatusChanged = (worker) => {
            if (this.onWorkerStatusChanged) {
                this.onWorkerStatusChanged(worker.facade);
            }
        }
    }

    get alive() {
        return this.#cluster
    }

    get workers() {
        return this.#cluster.getWorkers().map((v) => v.facade);
    }

    close() {
        this.#cluster.close();
    }
}

export async function connectToCluster(client: nats.Client) {
    let res = new KitchenCluster(client);
    await res.init();
    try {
        await res.awaitWorkersReporting();
        return new Cluster(res);
    } catch (e) {
        res.close();
        throw e;
    }
}