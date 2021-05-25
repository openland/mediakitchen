import * as t from 'io-ts';
import { eventsCodec } from './events';
import { simpleMapCodec, dtlsParametersCodec, rtpParametersCodec, rtpCodecCapabilityCodec, rtpCapabilitiesCodec, numSctpStreamsCodec, srtpParametersCodec } from './common';
import { routerStateCodec, RouterState, webRtcTransportStateCodec, producerStateCodec, consumerStateCodec, plainTransportStateCodec, pipeTransportStateCodec } from './states';

//
// Kill Worker
//

const killCommandCodec = t.type({
    type: t.literal('worker-kill')
});

//
// Get Events
//

const getEventsCommandCodec = t.type({
    type: t.literal('worker-events'),
    batchSize: t.number,
    seq: t.number
});
export type GetEventsCommand = t.TypeOf<typeof getEventsCommandCodec>;

export const getEventsResponseCodec = t.type({
    hasMore: t.boolean,
    seq: t.number,
    events: t.array(eventsCodec)
});
export type GetEventsResponse = t.TypeOf<typeof getEventsResponseCodec>;

//
// Get State
//

const getStateCommandCodec = t.type({
    type: t.literal('worker-state')
});
export type GetStateCommand = t.TypeOf<typeof getStateCommandCodec>;

export const getStateResponseCodec = t.type({
    seq: t.number
});
export type GetStateResponse = t.TypeOf<typeof getStateResponseCodec>;

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

export const routerCreateResponseCodec = routerStateCodec;
export type RouterCreateResponse = RouterState;

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

export const routerCloseResponseCodec = routerStateCodec;
export type RouterCloseResponse = RouterState;

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
        numSctpStreams: numSctpStreamsCodec,
        maxSctpMessageSize: t.number,
        sctpSendBufferSize: t.number,
        appData: simpleMapCodec
    })
});
export type WebRTCTransportCreateCommand = t.TypeOf<typeof webRtcTransportCreateCommandCodec>;

export const webRTCTransportCreateResponseCodec = webRtcTransportStateCodec;
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

export const webRtcTransportCloseResponseCodec = webRtcTransportStateCodec;
export type WebRTCTransportCloseResponse = t.TypeOf<typeof webRtcTransportStateCodec>;

//
// Restart WebRTC Transport Command
//

const webRtcTransportRestartCommandCodec = t.type({
    type: t.literal('transport-webrtc-restart'),
    args: t.type({
        id: t.string
    })
});
export type WebRTCTransportRestartCommand = t.TypeOf<typeof webRtcTransportRestartCommandCodec>;

export const webRtcTransportRestartResponseCodec = webRtcTransportStateCodec;
export type WebRTCTransportRestartResponse = t.TypeOf<typeof webRtcTransportRestartResponseCodec>;

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

export const webRtcTransportConnectResponseCodec = webRtcTransportStateCodec;
export type WebRTCTransportConnectResponse = t.TypeOf<typeof webRtcTransportConnectResponseCodec>;

//
// Create Plain Transport Command
//

const plainTransportCreateCommandCodec = t.type({
    type: t.literal('transport-plain-create'),
    routerId: t.string,
    args: t.partial({
        rtcpMux: t.boolean,
        comedia: t.boolean,
        enableSctp: t.boolean,
        numSctpStreams: numSctpStreamsCodec,
        maxSctpMessageSize: t.number,
        sctpSendBufferSize: t.number,
        enableSrtp: t.boolean,
        srtpCryptoSuite: t.union([t.literal('AES_CM_128_HMAC_SHA1_80'), t.literal('AES_CM_128_HMAC_SHA1_32')]),
        appData: simpleMapCodec
    })
});
export type PlainTransportCreateCommand = t.TypeOf<typeof plainTransportCreateCommandCodec>;

export const plainTransportCreateResponseCodec = plainTransportStateCodec;
export type PlainTransportCreateResponse = t.TypeOf<typeof plainTransportCreateResponseCodec>;

//
// Connect Plain Transport Command
//

const plainTransportConnectCommandCodec = t.type({
    type: t.literal('transport-plain-connect'),
    args: t.intersection([t.type({
        id: t.string,
    }), t.partial({
        ip: t.string,
        port: t.number,
        rtcpPort: t.number,
        srtpParameters: srtpParametersCodec
    })])
});
export type PlainTransportConnectCommand = t.TypeOf<typeof plainTransportConnectCommandCodec>;

export const plainTransportConnectResponseCodec = plainTransportStateCodec;
export type PlainTransportConnectResponse = t.TypeOf<typeof plainTransportConnectResponseCodec>;

//
// Close Plain Transport Command
//

const plainTransportCloseCommandCodec = t.type({
    type: t.literal('transport-plain-close'),
    args: t.type({
        id: t.string,
    })
});
export type PlainTransportCloseCommand = t.TypeOf<typeof plainTransportCloseCommandCodec>;

export const plainTransportCloseResponseCodec = plainTransportStateCodec;
export type PlainTransportCloseResponse = t.TypeOf<typeof plainTransportStateCodec>;

//
// Create Pipe Transport Command
//

const pipeTransportCreateCommandCodec = t.type({
    type: t.literal('transport-pipe-create'),
    routerId: t.string,
    args: t.partial({
        enableSctp: t.boolean,
        numSctpStreams: numSctpStreamsCodec,
        maxSctpMessageSize: t.number,
        sctpSendBufferSize: t.number,
        enableRtx: t.boolean,
        enableSrtp: t.boolean,
        appData: simpleMapCodec
    })
});
export type PipeTransportCreateCommand = t.TypeOf<typeof pipeTransportCreateCommandCodec>;

export const pipeTransportCreateResponseCodec = pipeTransportStateCodec;
export type PipeTransportCreateResponse = t.TypeOf<typeof pipeTransportCreateResponseCodec>;

//
// Close Pipe Transport Command
//

const pipeTransportCloseCommandCodec = t.type({
    type: t.literal('transport-pipe-close'),
    args: t.type({
        id: t.string,
    })
});
export type PipeTransportCloseCommand = t.TypeOf<typeof pipeTransportCloseCommandCodec>;

export const pipeTransportCloseResponseCodec = pipeTransportStateCodec;
export type PipeTransportCloseResponse = t.TypeOf<typeof pipeTransportCloseResponseCodec>;

//
// Connect Pipe Transport Command
//

const pipeTransportConnectCommandCodec = t.type({
    type: t.literal('transport-pipe-connect'),
    args: t.intersection([t.type({
        id: t.string,
        ip: t.string,
        port: t.number,
    }), t.partial({
        srtpParameters: srtpParametersCodec
    })])
});
export type PipeTransportConnectCommand = t.TypeOf<typeof pipeTransportConnectCommandCodec>;

export const pipeTransportConnectResponseCodec = pipeTransportStateCodec;
export type PipeTransportConnectResponse = t.TypeOf<typeof pipeTransportConnectResponseCodec>;

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

export const produceResponseCodec = producerStateCodec;
export type ProduceResponse = t.TypeOf<typeof produceResponseCodec>;

//
// Produce Pause Command
//

const producePauseCommandCodec = t.type({
    type: t.literal('produce-pause'),
    args: t.type({
        id: t.string
    })
});
export type ProducePauseCommand = t.TypeOf<typeof producePauseCommandCodec>;
export const producePauseResponseCodec = producerStateCodec;
export type ProducePauseResponse = t.TypeOf<typeof producePauseResponseCodec>;

//
// Produce Resume Command
//

const produceResumeCommandCodec = t.type({
    type: t.literal('produce-resume'),
    args: t.type({
        id: t.string
    })
});
export type ProduceResumeCommand = t.TypeOf<typeof produceResumeCommandCodec>;
export const produceResumeResponseCodec = producerStateCodec;
export type ProduceResumeResponse = t.TypeOf<typeof produceResumeResponseCodec>;

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

export const produceCloseResponseCodec = producerStateCodec;
export type ProduceCloseResponse = t.TypeOf<typeof producerStateCodec>;

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

export const consumeResponseCodec = consumerStateCodec;
export type ConsumeResponse = t.TypeOf<typeof consumeResponseCodec>;

//
// Consume Pause
//

const consumePauseCommandCodec = t.type({
    type: t.literal('consume-pause'),
    args: t.type({
        id: t.string
    })
});
export type ConsumePauseCommand = t.TypeOf<typeof consumePauseCommandCodec>;

export const consumePauseResponseCodec = consumerStateCodec;
export type ConsumePauseResponse = t.TypeOf<typeof consumePauseResponseCodec>;

//
// Consume Resume
//

const consumeResumeCommandCodec = t.type({
    type: t.literal('consume-resume'),
    args: t.type({
        id: t.string
    })
});
export type ConsumeResumeCommand = t.TypeOf<typeof consumeResumeCommandCodec>;

export const consumeResumeResponseCodec = consumerStateCodec;
export type ConsumeResumeResponse = t.TypeOf<typeof consumeResumeResponseCodec>;

//
// Consume Close
//

const consumeCloseCommandCodec = t.type({
    type: t.literal('consume-close'),
    args: t.type({
        id: t.string
    })
});
export type ConsumeCloseCommand = t.TypeOf<typeof consumeCloseCommandCodec>;

export const consumeCloseResponseCodec = consumerStateCodec;
export type ConsumeCloseResponse = t.TypeOf<typeof consumeCloseResponseCodec>;

//
// Stats
//

//
// Produce Create Command
//

const statsCommandCodec = t.type({
    type: t.literal('get-stats'),
    args: t.type({
        id: t.string,
    })
});
export type StatsCommand = t.TypeOf<typeof statsCommandCodec>;

export const statsResponseCodec = t.type({
    data: t.union([t.string, t.null])
});;
export type StatsResponse = t.TypeOf<typeof statsResponseCodec>;

//
// All Commands
//

export const commandsCodec = t.union([
    killCommandCodec,
    getEventsCommandCodec,
    getStateCommandCodec,

    routerCreateCommandCodec,
    routerCloseCommandCodec,

    webRtcTransportCreateCommandCodec,
    webRtcTransportConnectCommandCodec,
    webRtcTransportCloseCommandCodec,
    webRtcTransportRestartCommandCodec,

    plainTransportCreateCommandCodec,
    plainTransportCloseCommandCodec,
    plainTransportConnectCommandCodec,

    pipeTransportCreateCommandCodec,
    pipeTransportCloseCommandCodec,
    pipeTransportConnectCommandCodec,

    produceCommandCodec,
    producePauseCommandCodec,
    produceResumeCommandCodec,
    produceCloseCommandCodec,

    consumeCommandCodec,
    consumePauseCommandCodec,
    consumeResumeCommandCodec,
    consumeCloseCommandCodec,

    statsCommandCodec
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