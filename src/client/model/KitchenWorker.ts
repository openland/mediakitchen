import { Worker } from './../Worker';
import { RouterCreateCommand } from '../../wire/commands';
import { SimpleMap } from '../../wire/common';
import { KitchenApi } from './KitchenApi';
import { KitchenRouter } from './KitchenRouter';
import { KitchenCluster } from './KitchenCluster';
import { delay } from '../../utils/delay';

export class KitchenWorker {

    #id: string;
    #appData: SimpleMap;

    #status: 'healthy' | 'unhealthy' | 'dead' = 'healthy';
    #reportedDead = false;
    #routers = new Map<string, KitchenRouter>();

    #api: KitchenApi;
    #cluster: KitchenCluster;
    #facade: Worker;


    constructor(id: string, appData: SimpleMap, cluster: KitchenCluster) {
        this.#id = id;
        this.#appData = Object.freeze(appData);
        this.#cluster = cluster;
        this.#api = new KitchenApi(id, cluster.client);
        this.#facade = new Worker(this);
    }

    get id() {
        return this.#id;
    }

    get appData() {
        return this.#appData;
    }

    get status() {
        return this.#status;
    }

    get facade() {
        return this.#facade;
    }

    //
    // Actions
    //

    async createRouter(args: RouterCreateCommand['args'], retryKey: string) {
        let res = await this.#api.createRouter(args, retryKey);
        let id = res.id;
        if (this.#routers.has(id)) {
            return this.#routers.get(id)!;
        } else {
            let r = new KitchenRouter(res.id, args.appData || {}, this.#api);
            this.#routers.set(id, r);
            return r;
        }
    }

    //
    // Kill
    //

    kill() {
        if (this.#status === 'dead') {
            return;
        }
        this.#status = 'dead';
        for (let r of this.#routers.values()) {
            if (r.alive) {
                r.onRouterDead();
            }
        }
        if (this.#cluster.onWorkerStatusChanged) {
            this.#cluster.onWorkerStatusChanged(this);
        }

        // Kill worker in background
        (async () => {
            while (true) {
                try {
                    if (this.#reportedDead) {
                        return;
                    }
                    await this.#api.killWorker();
                    return;
                } catch (e) {
                    // TODO: Backoff
                    await delay(5000);
                }
            }
        })();
    }

    //
    // Livecycle
    //

    onReport() {
        if (this.#status === 'healthy' || this.#status === 'dead') {
            return;
        }
        this.#status = 'healthy';
        if (this.#cluster.onWorkerStatusChanged) {
            this.#cluster.onWorkerStatusChanged(this);
        }
    }

    onReportTimeout() {
        if (this.#status === 'unhealthy' || this.#status === 'dead') {
            return;
        }
        this.#status = 'unhealthy';
        if (this.#cluster.onWorkerStatusChanged) {
            this.#cluster.onWorkerStatusChanged(this);
        }
    }

    onDead() {
        this.#reportedDead = true;
        if (this.#status === 'dead') {
            return;
        }

        this.#status = 'dead';
        for (let r of this.#routers.values()) {
            if (r.alive) {
                r.onRouterDead();
            }
        }
        if (this.#cluster.onWorkerStatusChanged) {
            this.#cluster.onWorkerStatusChanged(this);
        }
    }

    //
    // Events
    //

    onRouterClosed(id: string) {
        if (this.#status === 'dead') {
            return;
        }

        let r = this.#routers.get(id);
        if (r && r.alive) {
            r.onClosed();
        }
    }
}