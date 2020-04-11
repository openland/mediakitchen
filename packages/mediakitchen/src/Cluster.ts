import { delay } from 'mediakitchen-common';
import { ConnectionInfo } from './ConnectionInfo';
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

    get closed() {
        return !this.#cluster.alive;
    }

    get workers() {
        return this.#cluster.getWorkers().map((v) => v.facade);
    }

    close() {
        this.#cluster.close();
    }
}

export async function connectToCluster(connectionInfo: ConnectionInfo) {

    // Create cluter connection
    let res = new KitchenCluster(connectionInfo);

    // Connect to cluster
    await res.connect();

    // Wait for cluster map population
    await delay(5000);

    // Wrap cluter
    return new Cluster(res);
}