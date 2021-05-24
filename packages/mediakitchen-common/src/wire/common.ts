import * as t from 'io-ts';

// App Data

export const simpleMapCodec = t.record(t.string, t.union([t.string, t.number, t.boolean]));
export type SimpleMap = t.TypeOf<typeof simpleMapCodec>;

// DTLS

export const dtlsRoleCodec = t.union([t.literal('auto'), t.literal('client'), t.literal('server')]);
export type DtlsRole = t.TypeOf<typeof dtlsRoleCodec>;

export const dtlsParametersCodec = t.intersection([t.type({
    fingerprints: t.array(t.type({ algorithm: t.string, value: t.string }))
}), t.partial({
    role: dtlsRoleCodec
})]);
export type DtlsParameters = t.TypeOf<typeof dtlsParametersCodec>;

export const dtlsStateCodec = t.union([t.literal('new'), t.literal('connecting'), t.literal('connected'), t.literal('failed'), t.literal('closed')]);
export type DtlsState = t.TypeOf<typeof dtlsStateCodec>;

// ICE

export const iceParametersCodec = t.intersection([t.type({
    usernameFragment: t.string,
    password: t.string
}), t.partial({
    iceLite: t.boolean
})]);

export type IceParameters = t.TypeOf<typeof iceParametersCodec>;

export const iceCandidateCodec = t.intersection([t.type({
    foundation: t.string,
    priority: t.number,
    ip: t.string,
    protocol: t.union([t.literal('udp'), t.literal('tcp')]),
    port: t.number,
    type: t.literal('host')
}), t.partial({
    tcpType: t.literal('passive')
})]);

export type IceCandidate = t.TypeOf<typeof iceCandidateCodec>;

export const iceStateCodec = t.union([t.literal('new'), t.literal('connected'), t.literal('completed'), t.literal('disconnected'), t.literal('closed')])
export type IceState = t.TypeOf<typeof iceStateCodec>;

// RTP Feedback

export const rtcpFeedbackCodec = t.intersection([t.type({
    type: t.string,
}), t.partial({
    parameter: t.string
})]);
export type RtcpFeedback = t.TypeOf<typeof rtcpFeedbackCodec>;

// RTP Codec Capability

export const rtpCodecCapabilityCodec = t.intersection([t.type({
    kind: t.union([t.literal('audio'), t.literal('video')]),
    mimeType: t.string,
    clockRate: t.number,
}), t.partial({
    channels: t.number,
    parameters: simpleMapCodec,
    rtcpFeedback: t.array(rtcpFeedbackCodec),
    preferredPayloadType: t.number
})]);
export type RtpCodecCapability = t.TypeOf<typeof rtpCodecCapabilityCodec>;

// RTP Codec Parameters

export const rtpCodecParametersCodec = t.intersection([t.type({
    mimeType: t.string,
    payloadType: t.number,
    clockRate: t.number,
}), t.partial({
    channels: t.number,
    parameters: simpleMapCodec,
    rtcpFeedback: t.array(rtcpFeedbackCodec)
})]);

export type RtpCodecParameters = t.TypeOf<typeof rtpCodecParametersCodec>;

// RTP Header Extension Parameters

export const rtpHeaderExtensionParametersCodec = t.intersection([t.type({
    uri: t.string,
    id: t.number,
}), t.partial({
    encrypt: t.boolean,
    parameters: simpleMapCodec
})]);
export type RtpHeaderExtensionParameters = t.TypeOf<typeof rtpHeaderExtensionParametersCodec>;

export const rtpHeaderExtensionCodec = t.intersection([t.type({
    uri: t.string,
    preferredId: t.number,
}), t.partial({
    kind: t.union([t.literal(''), t.literal('audio'), t.literal('video')]),
    preferredEncrypt: t.boolean,
    direction: t.union([t.literal('sendrecv'), t.literal('sendonly'), t.literal('recvonly'), t.literal('inactive')])
})]);
export type RtpHeaderExtensionCodec = t.TypeOf<typeof rtpHeaderExtensionCodec>;

// RTP Encoding

export const rtpEncodingCodec = t.partial({
    ssrc: t.number,
    rid: t.string,
    codecPayloadType: t.number,
    rtx: t.type({ ssrc: t.number }),
    dtx: t.boolean,
    scalabilityMode: t.string
});
export type RtpEncoding = t.TypeOf<typeof rtpEncodingCodec>;

// RTCP Parameters

export const rtcpParameters = t.partial({
    cname: t.string,
    reducedSize: t.boolean,
    mux: t.boolean
});
export type RtcpParameters = t.TypeOf<typeof rtcpParameters>;

// RTP Parameters

export const rtpParametersCodec = t.intersection([t.type({
    codecs: t.array(rtpCodecParametersCodec),
}), t.partial({
    mid: t.string,
    headerExtensions: t.array(rtpHeaderExtensionParametersCodec),
    encodings: t.array(rtpEncodingCodec),
    rtcp: rtcpParameters
})]);

export type RtpParameters = t.TypeOf<typeof rtpParametersCodec>;

// RTP Capabilities

export const rtpCapabilitiesCodec = t.partial({
    codecs: t.array(rtpCodecCapabilityCodec),
    headerExtensions: t.array(rtpHeaderExtensionCodec),
    fecMechanisms: t.array(t.string)
})
export type RtpCapabilities = t.TypeOf<typeof rtpCapabilitiesCodec>;

// Plain Transport

export const transportTupleCodec = t.intersection([t.type({
    localIp: t.string,
    localPort: t.number,
    protocol: t.union([t.literal('tcp'), t.literal('udp')])
}), t.partial({
    remoteIp: t.string,
    remotePort: t.number
})]);
export type TransportTuple = t.TypeOf<typeof transportTupleCodec>;

// SCTP Parameters

export const sctpParametersCodec = t.type({
    port: t.number,
    OS: t.number,
    MIS: t.number,
    maxMessageSize: t.number
});
export type SctpParameters = t.TypeOf<typeof sctpParametersCodec>;

// SRTP Parameters

export const srtpParametersCodec = t.type({
    cryptoSuite: t.union([t.literal('AES_CM_128_HMAC_SHA1_80'), t.literal('AES_CM_128_HMAC_SHA1_32')]),
    keyBase64: t.string
});
export type SrtpParameters = t.TypeOf<typeof srtpParametersCodec>;

// SRTP State

export const srtpStateCodec = t.union([t.literal('new'), t.literal('connecting'), t.literal('connected'), t.literal('failed'), t.literal('failed'), t.literal('closed')]);
export type SrtpState = t.TypeOf<typeof srtpStateCodec>;

// NumSctpStreams
export const numSctpStreamsCodec = t.type({
    OS: t.number,
    MIS: t.number
});
export type NumSctpStreams = t.TypeOf<typeof numSctpStreamsCodec>;