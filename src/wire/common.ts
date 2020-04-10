import * as t from 'io-ts';

// App Data

export const simpleMapCodec = t.dictionary(t.string, t.union([t.string, t.number, t.boolean]));
export type SimpleMap = t.TypeOf<typeof simpleMapCodec>;

// DTLS

export const dtlsRoleCodec = t.union([t.literal('auto'), t.literal('client'), t.literal('server')]);
export type DtlsRole = t.TypeOf<typeof dtlsRoleCodec>;

export const dtlsParametersCodec = t.intersection([t.type({
    fingerprints: t.array(t.type({ algorithm: t.string, value: t.string }))
}), t.partial({
    dtlsRole: dtlsRoleCodec
})]);
export type DtlsParameters = t.TypeOf<typeof dtlsParametersCodec>;

// ICE

export const iceParametersCodec = t.intersection([t.type({
    usernameFragment: t.string,
    password: t.string
}), t.partial({
    iceLite: t.boolean
})]);

export type IceParameters = t.TypeOf<typeof iceParametersCodec>;

// RTP Feedback

export const rtcpFeedbackCodec = t.intersection([t.type({
    type: t.string,
}), t.partial({
    parameter: t.string
})]);

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

// RTP Header Extension Parameters

export const rtpHeaderExtensionParametersCodec = t.intersection([t.type({
    uri: t.string,
    id: t.number,
}), t.partial({
    encrypt: t.boolean,
    parameters: simpleMapCodec
})]);

export const rtpHeaderExtensionCodec = t.intersection([t.type({
    uri: t.string,
    preferredId: t.number,
}), t.partial({
    kind: t.union([t.literal(''), t.literal('audio'), t.literal('video')]),
    preferredEncrypt: t.boolean,
    direction: t.union([t.literal('sendrecv'), t.literal('sendonly'), t.literal('recvonly'), t.literal('inactive')])
})]);

// RTP Encoding

export const rtpEncodingCodec = t.partial({
    ssrc: t.number,
    rid: t.string,
    codecPayloadType: t.number,
    rtx: t.type({ ssrc: t.number }),
    dtx: t.boolean,
    scalabilityMode: t.string
});

// RTCP Parameters

export const rtcpParameters = t.partial({
    cname: t.string,
    reducedSize: t.boolean,
    mux: t.boolean
});

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