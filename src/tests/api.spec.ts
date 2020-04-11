import { ConnectionInfo } from './../client/ConnectionInfo';
import { KitchenApi } from './../client/model/KitchenApi';
import { connect, Payload } from "ts-nats";
import { createWorker } from "../server/createWorker";
import { randomKey } from '../utils/randomKey';
import { delay } from '../utils/delay';
import { Event } from '../wire/events';

describe('api', () => {

    it('should return state and events', async () => {
        const nc = await connect({ payload: Payload.JSON });
        const connectionInfo: ConnectionInfo = { nc, rootTopic: randomKey() };
        const worker = await createWorker({ connectionInfo });
        const api = new KitchenApi(worker.id, connectionInfo);
        let state = await api.getState();
        expect(state.seq).toBe(0);
        let events = await api.getEvents(0);
        expect(events.seq).toBe(0);
        expect(events.hasMore).toBe(false);
        expect(events.events.length).toBe(0);
        worker.close();
        nc.close();
        api.close();
    });

    it('should create router', async () => {
        const nc = await connect({ payload: Payload.JSON });
        const connectionInfo: ConnectionInfo = { nc, rootTopic: randomKey() };
        const worker = await createWorker({ connectionInfo });
        const api = new KitchenApi(worker.id, connectionInfo);
        let fn = jest.fn<void, [Event]>()
        api.onEvent = fn;

        // Create Router
        let routerState1 = await api.createRouter({ mediaCodecs: [] }, 'router1');
        let routerState2 = await api.createRouter({ mediaCodecs: [], appData: { data: 'string' } }, 'router1');
        expect(routerState1.id).toBe(routerState2.id);
        expect(routerState1.closed).toBe(false);
        expect(Object.keys(routerState1.appData).length).toBe(0);

        // Close Router
        let routerState3 = await api.closeRouter(routerState1.id);
        let routerState4 = await api.createRouter({ mediaCodecs: [] }, 'router1');
        let routerState5 = await api.closeRouter(routerState1.id);
        expect(routerState4.id).toBe(routerState3.id);
        expect(routerState4.id).toBe(routerState5.id);
        expect(routerState3.closed).toBe(true);
        expect(routerState4.closed).toBe(true);
        expect(routerState5.closed).toBe(true);

        // Check Events
        await delay(50);
        expect(fn.mock.calls.length).toBe(2);
        expect(fn.mock.calls[0][0].type).toBe('state-router');
        expect(fn.mock.calls[0][0].state.closed).toBe(false);
        expect(fn.mock.calls[0][0].state.id).toBe(routerState1.id);
        expect(Object.keys(fn.mock.calls[0][0].state.appData).length).toBe(0);
        expect(fn.mock.calls[1][0].type).toBe('state-router');
        expect(fn.mock.calls[1][0].state.closed).toBe(true);
        expect(fn.mock.calls[1][0].state.id).toBe(routerState1.id);
        expect(Object.keys(fn.mock.calls[1][0].state.appData).length).toBe(0);

        worker.close();
        nc.close();
        api.close();
    });

    it('should create transport', async () => {
        const nc = await connect({ payload: Payload.JSON });
        const connectionInfo: ConnectionInfo = { nc, rootTopic: randomKey() };
        const worker1 = await createWorker({ connectionInfo });
        const worker2 = await createWorker({ connectionInfo });

        const api1 = new KitchenApi(worker1.id, connectionInfo);
        const api2 = new KitchenApi(worker2.id, connectionInfo);

        let router1 = (await api1.createRouter({ mediaCodecs: [] }, 'router1')).id;
        let router2 = (await api2.createRouter({ mediaCodecs: [] }, 'router2')).id;

        let transport1 = (await api1.createWebRtcTransport(router1, {}, 'transport1'));
        let transport2 = (await api2.createWebRtcTransport(router2, {}, 'transport2'));
        await api1.connectWebRtcTransport({ id: transport1.id, dtlsParameters: { role: 'client', fingerprints: transport2.dtlsParameters.fingerprints } });
        await api2.connectWebRtcTransport({ id: transport2.id, dtlsParameters: { role: 'server', fingerprints: transport2.dtlsParameters.fingerprints } });

        // Double invoke
        let transport3 = await api1.connectWebRtcTransport({ id: transport1.id, dtlsParameters: { role: 'client', fingerprints: transport2.dtlsParameters.fingerprints } });
        let transport4 = await api2.connectWebRtcTransport({ id: transport2.id, dtlsParameters: { role: 'server', fingerprints: transport2.dtlsParameters.fingerprints } });
        expect(transport3.id).toBe(transport4.id);

        // Close
        await api1.closeWebRtcTransport(transport1.id);
        await api2.closeWebRtcTransport(transport2.id);

        // Double invoke
        await api1.closeWebRtcTransport(transport1.id);
        await api2.closeWebRtcTransport(transport2.id);

        worker1.close();
        worker2.close();
        api1.close();
        api2.close();
        nc.close();
    });
});