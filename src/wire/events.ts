import * as t from 'io-ts';
import { simpleMapCodec } from './common';

const workerStatusEvent = t.type({
    type: t.literal('report'),
    workerId: t.string,
    state: t.union([t.literal('alive'), t.literal('dead')]),
    appData: simpleMapCodec,
    time: t.number
});

const routerClosedEvent = t.type({
    type: t.literal('router-closed'),
    routerId: t.string,
    workerId: t.string,
    time: t.number
});

export const eventCodec = t.union([
    workerStatusEvent,
    routerClosedEvent
]);

export type Event = t.TypeOf<typeof eventCodec>