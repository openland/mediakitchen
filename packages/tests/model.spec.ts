import { RtpCodecCapability } from 'mediakitchen-common';
import { randomKey } from 'mediakitchen-common';
import { connect, Payload } from "ts-nats";
import { createWorker } from 'mediakitchen-server';
import { ConnectionInfo, connectToCluster } from 'mediakitchen';

export const ROUTER_CODECS: RtpCodecCapability[] = [{
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
    rtcpFeedback: [
        { type: 'transport-cc' }
    ]
}, {
    kind: 'video',
    mimeType: 'video/H264',
    clockRate: 90000,
    parameters: {
        'packetization-mode': 1,
        'profile-level-id': '42e01f',
        'level-asymmetry-allowed': 1,
    },
    rtcpFeedback: [{
        type: 'goog-remb'
    }, {
        type: 'transport-cc'
    }, {
        type: 'ccm',
        parameter: 'fir'
    }, {
        type: 'nack'
    }, {
        type: 'nack',
        parameter: 'pli'
    }]
}, {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {},
    rtcpFeedback: [{
        type: 'goog-remb'
    }, {
        type: 'transport-cc'
    }, {
        type: 'ccm',
        parameter: 'fir'
    }, {
        type: 'nack'
    }, {
        type: 'nack',
        parameter: 'pli'
    }]
}];

describe('Model', () => {

    it('should create and delete routers', async () => {
        jest.setTimeout(10000);
        const nc = await connect({ payload: Payload.JSON });
        const connectionInfo: ConnectionInfo = { nc, rootTopic: randomKey() };
        const workerInstance = await createWorker({ connectionInfo });
        const cluster = await connectToCluster(connectionInfo);
        const worker = cluster.workers[0];

        const router1 = await worker.createRouter({ mediaCodecs: ROUTER_CODECS }, 'router1');
        const router2 = await worker.createRouter({ mediaCodecs: ROUTER_CODECS }, 'router2');
        const router3 = await worker.createRouter({ mediaCodecs: ROUTER_CODECS }, 'router1');
        const router4 = await worker.createRouter({ mediaCodecs: ROUTER_CODECS }, 'router2');
        expect(router1).toBe(router3);
        expect(router2).toBe(router4);

        // Pipe transport
        let pipe1 = await router1.createPipeTransport({ enableSrtp: true, enableSctp: true }, 'transport1');
        let pipe2 = await router1.createPipeTransport({ enableSrtp: true, enableSctp: true }, 'transport2');
        expect(pipe1.sctpParameters).not.toBeNull();
        expect(pipe1.sctpState).not.toBeNull();
        expect(pipe1.srtpParameters).not.toBeNull();
        expect(pipe2.sctpParameters).not.toBeNull();
        expect(pipe2.sctpState).not.toBeNull();
        expect(pipe2.srtpParameters).not.toBeNull();
        await pipe1.connect({ ip: pipe2.tuple.localIp, port: pipe2.tuple.localPort, srtpParameters: pipe2.srtpParameters! });
        await pipe2.connect({ ip: pipe1.tuple.localIp, port: pipe1.tuple.localPort, srtpParameters: pipe1.srtpParameters! });
        expect(pipe1.tuple.remoteIp).toBe(pipe2.tuple.localIp);
        expect(pipe1.tuple.remotePort).toBe(pipe2.tuple.localPort);
        expect(pipe2.tuple.remoteIp).toBe(pipe1.tuple.localIp);
        expect(pipe2.tuple.remotePort).toBe(pipe1.tuple.localPort);

        // Produce
        await pipe1.produce({
            kind: 'audio',
            rtpParameters: {
                codecs: [{
                    ssrc: 1000,
                    mimeType: 'audio/opus',
                    payloadType: 10,
                    clockRate: 48000,
                    channels: 2
                }],
                encodings: [{ ssrc: 1000 }]
            }
        }, 'produce-1');

        await router1.close();
        await router2.close();
        expect(router1.closed).toBe(true);
        expect(router2.closed).toBe(true);
        expect(pipe1.closed).toBe(true);
        expect(pipe2.closed).toBe(true);

        cluster.close();
        workerInstance.close();
        nc.close();
    });
});