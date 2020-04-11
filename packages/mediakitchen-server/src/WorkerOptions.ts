import * as mediasoup from 'mediasoup';
import { ConnectionInfo } from './ConnectionInfo';

export interface WorkerOptions {
    connectionInfo: ConnectionInfo;
    listenIps?: mediasoup.types.TransportListenIp[] | string[];
    settings?: Partial<mediasoup.types.WorkerSettings>;
}