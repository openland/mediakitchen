import { ConnectionInfo } from './client/ConnectionInfo';
import { KitchenApi } from './client/model/KitchenApi';
import { connect, Payload } from "ts-nats";
import { createWorker } from "./server/createWorker";
import { connectToCluster } from "./client/Cluster";
import { delay } from "./utils/delay";

(async () => {
    const nc = await connect({ payload: Payload.JSON });
    const connectionInfo: ConnectionInfo = { nc, rootTopic: 'localtest' };
    const serverWorker = await createWorker({ connectionInfo });


    const api = new KitchenApi(serverWorker.id, connectionInfo);
    api.onEvent = (event) => {
        console.log(event);
    };

    let routerState = await api.createRouter({ mediaCodecs: [] }, 'router1');
    console.log(routerState);
    routerState = await api.closeRouter(routerState.id);
    console.log(routerState);
    // console.log('Connecting to cluster...');
    // const cluster = await connectToCluster(nc);
    // console.log('Connected');
    // let workers = cluster.workers;
    // console.log(workers.map((v) => v.id + '-' + v.status));
    // cluster.onWorkerStatusChanged = (w) => {
    //     console.log(w.id + '-' + w.status);
    // }

    // let router = await workers[0].createRouter({ mediaCodecs: [] }, 'router-113');

    // await delay(1000);
    // workers[0].kill();
    // console.log(workers[0].status);

    // let router = await workers[0].createRouter({ mediaCodecs: [] }, 'router1');
    // console.log(router.id);
    // router = await workers[0].createRouter({ mediaCodecs: [] }, 'router1');
    // console.log(router.id);

    // let transport = await router.createWebRTCTransport({}, 'tr1');
    // console.log(transport.id);
    // console.log(transport.dtlsParameters);
    // console.log(transport.iceParameters);

    // let producer = await transport.produce({
    //     kind: 'video',
    //     rtpParameters: { codecs: [] },
    //     paused: true
    // }, 'producer-1');
    // let consumer = await transport.consume({ kind: 'video', producerId: producer.id });

    // await router.close();
})();