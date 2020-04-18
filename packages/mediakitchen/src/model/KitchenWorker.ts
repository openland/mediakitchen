import {
    RouterState, WebRtcTransportState, ProducerState, ConsumerState,
    RouterCreateCommand, SimpleMap,backoff
} from 'mediakitchen-common';
import { Worker } from '../Worker';
import { KitchenApi } from './KitchenApi';
import { KitchenRouter } from './KitchenRouter';
import { KitchenCluster } from './KitchenCluster';

export class KitchenWorker {

    #id: string;
    #appData: SimpleMap;

    #status: 'healthy' | 'unhealthy' | 'dead' = 'healthy';
    #closedExternally: boolean = false;

    #routers = new Map<string, KitchenRouter>();

    #api: KitchenApi;
    #cluster: KitchenCluster;
    #facade: Worker;

    constructor(id: string, appData: SimpleMap, cluster: KitchenCluster) {
        this.#id = id;
        this.#appData = Object.freeze(appData);
        this.#cluster = cluster;
        this.#api = new KitchenApi(id, cluster.connectionInfo);
        this.#api.onEvent = (e) => {
            if (e.type === 'state-router') {
                this.#onRouterState(e.state);
            } else if (e.type === 'state-webrtc-transport') {
                this.#onWebRtcTransportState(e.routerId, e.state);
            } else if (e.type === 'state-consumer') {
                this.#onConsumerState(e.routerId, e.transportId, e.state);
            } else if (e.type === 'state-producer') {
                this.#onProducerState(e.routerId, e.transportId, e.state);
            }
        }
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
            let r = this.#routers.get(id)!;
            r.applyState(res);
            return r;
        } else {
            let r = new KitchenRouter(res.id, res, this.#api);
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
            if (!r.closed) {
                r.onClosed();
            }
        }
        if (this.#cluster.onWorkerStatusChanged) {
            this.#cluster.onWorkerStatusChanged(this);
        }

        // Kill worker in background
        backoff(async () => {
            if (this.#closedExternally) {
                return;
            }
            await this.#api.killWorker();
        })
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
        this.#closedExternally = true;
        if (this.#status === 'dead') {
            return;
        }

        this.#status = 'dead';
        for (let r of this.#routers.values()) {
            if (!r.closed) {
                r.onClosed();
            }
        }
        if (this.#cluster.onWorkerStatusChanged) {
            this.#cluster.onWorkerStatusChanged(this);
        }
    }

    //
    // Events
    //

    #onRouterState = (state: RouterState) => {
        if (this.#status === 'dead') {
            return;
        }

        let r = this.#routers.get(state.id);
        if (r) {
            r.applyState(state);
        }
    }

    #onWebRtcTransportState = (routerId: string, state: WebRtcTransportState) => {
        if (this.#status === 'dead') {
            return;
        }

        let r = this.#routers.get(routerId);
        if (r) {
            let tr = r.transports.get(state.id);
            if (tr) {
                tr.applyState(state);
            }
        }
    }

    #onProducerState = (routerId: string, transportId: string, state: ProducerState) => {
        if (this.#status === 'dead') {
            return;
        }

        let r = this.#routers.get(routerId);
        if (r) {
            let tr = r.transports.get(transportId);
            if (tr) {
                let p = tr.producers.get(state.id);
                if (p) {
                    p.applyState(state);
                }
            }
        }
    }

    #onConsumerState = (routerId: string, transportId: string, state: ConsumerState) => {
        if (this.#status === 'dead') {
            return;
        }

        let r = this.#routers.get(routerId);
        if (r) {
            let tr = r.transports.get(transportId);
            if (tr) {
                let c = tr.consumers.get(state.id);
                if (c) {
                    c.applyState(state);
                }
            }
        }
    }
}