import * as nats from 'ts-nats';

export interface ConnectionInfo {
    rootTopic?: string;
    nc: nats.Client;
}