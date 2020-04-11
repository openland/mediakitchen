import { ConnectionInfo } from './../client/ConnectionInfo';
import { connect, Payload } from "ts-nats";
import { createWorker } from "../server/createWorker";
import { connectToCluster } from "../client/Cluster";
import { delay } from "../utils/delay";

describe('Cluster', () => {

    it('should detect workers', async () => {
        jest.setTimeout(10000);
        const nc = await connect({ payload: Payload.JSON });
        const connectionInfo: ConnectionInfo = { nc, rootTopic: 'cluster1' };
        const worker = await createWorker({ connectionInfo });
        const cluster = await connectToCluster(connectionInfo);
        expect(cluster.closed).toBe(false);
        expect(cluster.workers.length).toBe(1);
        expect(cluster.workers[0].status).toBe('healthy');
        expect(cluster.workers[0].id).toBe(worker.id);
        cluster.close();
        worker.close();
        nc.close();
    });

    it('should sync workers between cluster connections', async () => {
        jest.setTimeout(15000);
        const nc = await connect({ payload: Payload.JSON });
        const connectionInfo: ConnectionInfo = { nc, rootTopic: 'cluster2' };
        const worker = await createWorker({ connectionInfo });
        const cluster1 = await connectToCluster(connectionInfo);
        const cluster2 = await connectToCluster(connectionInfo);
        expect(cluster1.closed).toBe(false);
        expect(cluster2.closed).toBe(false);
        expect(cluster1.workers[0].id).toBe(cluster2.workers[0].id);
        cluster1.workers[0].kill();
        expect(cluster1.workers[0].status).toBe('dead');
        await delay(100);
        expect(cluster2.workers[0].status).toBe('dead');
        cluster1.close();
        cluster2.close();
        worker.close();
        nc.close();
    });
});