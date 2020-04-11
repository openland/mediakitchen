import * as t from 'io-ts';
import { simpleMapCodec, dtlsParametersCodec, iceParametersCodec, iceCandidate, iceStateCodec, dtlsStateCodec, rtpParametersCodec } from './common';

export const routerStateCodec = t.type({
    id: t.string,
    closed: t.boolean,
    appData: simpleMapCodec,
    time: t.number
});

export type RouterState = t.TypeOf<typeof routerStateCodec>;

export const webRtcTransportStateCodec = t.type({
    id: t.string,
    closed: t.boolean,
    appData: simpleMapCodec,
    dtlsParameters: dtlsParametersCodec,
    dtlsState: dtlsStateCodec,
    iceParameters: iceParametersCodec,
    iceCandidates: t.array(iceCandidate),
    iceState: iceStateCodec,
    time: t.number
});
export type WebRtcTransportState = t.TypeOf<typeof webRtcTransportStateCodec>;

export const producerStateCodec = t.type({
    id: t.string,
    closed: t.boolean,
    appData: simpleMapCodec,
    paused: t.boolean,
    rtpParameters: rtpParametersCodec,
    type: t.union([t.literal('simple'), t.literal('simulcast'), t.literal('svc')]),
    kind: t.union([t.literal('audio'), t.literal('video')]),
    time: t.number
});
export type ProducerState = t.TypeOf<typeof producerStateCodec>;

export const consumerStateCodec = t.type({
    id: t.string,
    closed: t.boolean,
    appData: simpleMapCodec,
    paused: t.boolean,
    rtpParameters: rtpParametersCodec,
    type: t.union([t.literal('simple'), t.literal('simulcast'), t.literal('svc'), t.literal('pipe')]),
    kind: t.union([t.literal('audio'), t.literal('video')]),
    time: t.number
});
export type ConsumerState = t.TypeOf<typeof consumerStateCodec>;