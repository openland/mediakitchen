import * as t from 'io-ts';
import { simpleMapCodec } from './common';
import { routerStateCodec, webRtcTransportStateCodec, producerStateCodec, consumerStateCodec } from './states';

//
// State Updates
//

const routerStateEvent = t.type({
    type: t.literal('state-router'),
    state: routerStateCodec,
    routerId: t.string,
    workerId: t.string,
    time: t.number
});

const webRtcTransportStateEvent = t.type({
    type: t.literal('state-webrtc-transport'),
    state: webRtcTransportStateCodec,
    transportId: t.string,
    routerId: t.string,
    workerId: t.string,
    time: t.number
});

const producerStateEvent = t.type({
    type: t.literal('state-producer'),
    state: producerStateCodec,
    producerId: t.string,
    transportId: t.string,
    routerId: t.string,
    workerId: t.string,
    time: t.number
});

const consumerStateEvent = t.type({
    type: t.literal('state-consumer'),
    state: consumerStateCodec,
    consumerId: t.string,
    producerId: t.string,
    transportId: t.string,
    routerId: t.string,
    workerId: t.string,
    time: t.number
});

export const eventsCodec = t.union([
    routerStateEvent,
    webRtcTransportStateEvent,
    producerStateEvent,
    consumerStateEvent
]);
export type Event = t.TypeOf<typeof eventsCodec>

export const eventBoxCodec = t.type({
    event: eventsCodec,
    seq: t.number
});
export type EventBox = t.TypeOf<typeof eventBoxCodec>;

//
// Global Report
//

export const reportCodec = t.type({
    type: t.literal('report'),
    workerId: t.string,
    state: t.union([t.literal('alive'), t.literal('dead')]),
    appData: simpleMapCodec,
    time: t.number
});
export type Report = t.TypeOf<typeof reportCodec>;