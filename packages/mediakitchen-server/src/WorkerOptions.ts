import * as mediasoup from 'mediasoup';
import { ConnectionInfo } from './ConnectionInfo';

export interface WorkerOptions {
    connectionInfo: ConnectionInfo;
    listenIp?: mediasoup.types.TransportListenIp;
    settings?: Partial<mediasoup.types.WorkerSettings>;
}