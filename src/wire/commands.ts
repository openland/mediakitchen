import * as t from 'io-ts';
import { simpleMapCodec, dtlsParametersCodec, iceParametersCodec, rtpParametersCodec, rtpCodecCapabilityCodec, rtpCapabilitiesCodec } from './common';

//
// Common Response
//

const idResponseCodec = t.type({
    id: t.string
});
export type IdResponse = t.TypeOf<typeof idResponseCodec>;

//
// Kill Worker
//

const killCommandCodec = t.type({
    type: t.literal('worker-kill')
});

//
// Create Router Command
//

const routerCreateCommandCodec = t.type({
    type: t.literal('router-create'),
    args: t.intersection([t.type({
        mediaCodecs: t.array(rtpCodecCapabilityCodec),
    }), t.partial({
        appData: simpleMapCodec
    })])
});
export type RouterCreateCommand = t.TypeOf<typeof routerCreateCommandCodec>;

export const routerCreateResponseCodec = idResponseCodec;
export type RouterCreateResponse = IdResponse;

//
// Close Router Command
//

const routerCloseCommandCodec = t.type({
    type: t.literal('router-close'),
    args: t.type({
        id: t.string
    })
});
export type RouterCloseCommand = t.TypeOf<typeof routerCloseCommandCodec>;

export const routerCloseResponseCodec = idResponseCodec;
export type RouterCloseResponse = IdResponse;

//
// Create WebRTC Transport Command
//

const webRtcTransportCreateCommandCodec = t.type({
    type: t.literal('transport-webrtc-create'),
    routerId: t.string,
    args: t.partial({
        enableUdp: t.boolean,
        enableTcp: t.boolean,
        preferUdp: t.boolean,
        preferTcp: t.boolean,
        initialAvailableOutgoingBitrate: t.number,
        enableSctp: t.boolean,
        numSctpStreams: t.type({ OS: t.number, MIS: t.number }),
        maxSctpMessageSize: t.number,
        appData: simpleMapCodec
    })
});
export type WebRTCTransportCreateCommand = t.TypeOf<typeof webRtcTransportCreateCommandCodec>;

export const webRTCTransportCreateResponseCodec = t.type({
    routerId: t.string,
    transportId: t.string,
    appData: simpleMapCodec,
    dtlsParameters: dtlsParametersCodec,
    iceParameters: iceParametersCodec
});
export type WebRTCTransportCreateResponse = t.TypeOf<typeof webRTCTransportCreateResponseCodec>;

//
// Close WebRTC Transport Command
//

const webRtcTransportCloseCommandCodec = t.type({
    type: t.literal('transport-webrtc-close'),
    args: t.type({
        id: t.string
    })
});
export type WebRTCTransportCloseCommand = t.TypeOf<typeof webRtcTransportCloseCommandCodec>;

export const webRtcTransportCloseResponseCodec = idResponseCodec;
export type WebRTCTransportCloseResponse = IdResponse;

//
// Connect WebRTC Transport Command
//

const webRtcTransportConnectCommandCodec = t.type({
    type: t.literal('transport-webrtc-connect'),
    args: t.type({
        id: t.string,
        dtlsParameters: dtlsParametersCodec,
    })
});
export type WebRTCTransportConnectCommand = t.TypeOf<typeof webRtcTransportConnectCommandCodec>;

export const webRtcTransportConnectResponseCodec = idResponseCodec;
export type WebRTCTransportConnectResponse = IdResponse;

//
// Produce Create Command
//

const produceCommandCodec = t.type({
    type: t.literal('produce-create'),
    transportId: t.string,
    args: t.intersection([t.type({
        kind: t.union([t.literal('audio'), t.literal('video')]),
        rtpParameters: rtpParametersCodec,
    }), t.partial({
        id: t.string,
        paused: t.boolean,
        keyFrameRequestDelay: t.number,
        appData: simpleMapCodec
    })])
});
export type ProduceCommand = t.TypeOf<typeof produceCommandCodec>;

export const produceResponseCodec = t.type({
    id: t.string,
    paused: t.boolean,
    type: t.union([t.literal('simple'), t.literal('simulcast'), t.literal('svc')]),
    rtpParameters: rtpParametersCodec
});
export type ProduceResponse = t.TypeOf<typeof produceResponseCodec>;

//
// Produce Close Commnand
//

const produceCloseCommandCodec = t.type({
    type: t.literal('produce-close'),
    args: t.type({
        id: t.string
    })
});
export type ProduceCloseCommand = t.TypeOf<typeof produceCloseCommandCodec>;

export const produceCloseResponseCodec = idResponseCodec;
export type ProduceCloseResponse = IdResponse;

//
// Consume Command
//

const consumeCommandCodec = t.type({
    type: t.literal('consume-create'),
    transportId: t.string,
    producerId: t.string,
    args: t.partial({
        rtpCapabilities: rtpCapabilitiesCodec,
        paused: t.boolean,
        appData: simpleMapCodec,
        preferredLayers: t.intersection([
            t.type({ spatialLayer: t.number }),
            t.partial({ temporalLayer: t.number })
        ])
    })
});
export type ConsumeCommand = t.TypeOf<typeof consumeCommandCodec>;
export type ConsumeCommandInput = t.InputOf<typeof consumeCommandCodec>;

export const consumeResponseCodec = t.type({
    id: t.string,
    paused: t.boolean,
    type: t.union([t.literal('simple'), t.literal('simulcast'), t.literal('svc'), t.literal('pipe')]),
    rtpParameters: rtpParametersCodec
});
export type ConsumeResponse = t.TypeOf<typeof consumeResponseCodec>;

//
// All Commands
//

export const commandsCodec = t.union([
    killCommandCodec,

    routerCreateCommandCodec,
    routerCloseCommandCodec,

    webRtcTransportCreateCommandCodec,
    webRtcTransportConnectCommandCodec,
    webRtcTransportCloseCommandCodec,

    produceCommandCodec,
    produceCloseCommandCodec,

    consumeCommandCodec,
]);

export type Commands = t.TypeOf<typeof commandsCodec>;

//
// Command Box
//

export const commandBoxCodec = t.type({
    command: commandsCodec,
    repeatKey: t.string,
    time: t.number
});

export type CommandBox = t.TypeOf<typeof commandBoxCodec>;