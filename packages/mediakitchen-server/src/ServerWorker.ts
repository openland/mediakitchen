import { StatsCommand, StatsResponse } from './../../mediakitchen-common/src/wire/commands';
import * as nats from 'ts-nats';
import * as mediasoup from 'mediasoup';
import debug from 'debug';
import { isLeft } from 'fp-ts/lib/Either';
import { WorkerOptions } from './WorkerOptions';
import {
    SctpParameters,
    SrtpParameters,
    PlainTransportState,
    PipeTransportState,
    PlainTransportCreateCommand,
    PlainTransportCloseCommand,
    PlainTransportCloseResponse,
    PlainTransportConnectCommand,
    PlainTransportConnectResponse,
    PipeTransportCreateCommand,
    PipeTransportCloseCommand,
    PipeTransportCloseResponse,
    PipeTransportConnectResponse,
    PipeTransportConnectCommand,
    WebRTCTransportRestartCommand,
    WebRTCTransportRestartResponse,
    RouterState,
    WebRtcTransportState,
    ProducerState,
    ConsumerState,
    commandBoxCodec,
    Commands,
    RouterCreateResponse,
    RouterCreateCommand,
    RouterCloseCommand,
    RouterCloseResponse,
    WebRTCTransportCreateCommand,
    WebRTCTransportCreateResponse,
    WebRTCTransportCloseCommand,
    WebRTCTransportCloseResponse,
    WebRTCTransportConnectCommand,
    WebRTCTransportConnectResponse,
    ProduceCommand,
    ProduceResponse,
    ProduceCloseCommand,
    ProduceCloseResponse,
    ConsumeCommand,
    ConsumeResponse,
    ConsumeCloseCommand,
    ConsumeCloseResponse,
    ProducePauseResponse,
    ProducePauseCommand,
    ProduceResumeCommand,
    ProduceResumeResponse,
    ConsumePauseCommand,
    ConsumePauseResponse,
    ConsumeResumeCommand,
    ConsumeResumeResponse,
    GetEventsResponse,
    Event,
    Report,
    eventsCodec,
    EventBox,
    RtpParameters,
    SimpleMap,
    randomKey,
    TransportTuple,
    now,
    AsyncLockMap
} from 'mediakitchen-common';

interface RouterHolder {
    appData: SimpleMap;
    router: mediasoup.types.Router | null
}

interface WebRtcTransportHolder {
    routerId: string;
    appData: SimpleMap;
    iceCandidates: mediasoup.types.IceCandidate[];
    iceParameters: mediasoup.types.IceParameters;
    dtlsParameters: mediasoup.types.DtlsParameters;
    connectCalled: boolean;
    transport: mediasoup.types.WebRtcTransport | null;
}

interface PlainTransportHolder {
    routerId: string;
    appData: SimpleMap;
    tuple: TransportTuple;
    rtcpTuple: TransportTuple | null;
    sctpParameters: SctpParameters | null;
    srtpParameters: SrtpParameters | null;
    connectCalled: boolean;
    transport: mediasoup.types.PlainTransport | null;
}

interface PipeTransportHolder {
    routerId: string;
    appData: SimpleMap;
    tuple: TransportTuple;
    sctpParameters: SctpParameters | null;
    srtpParameters: SrtpParameters | null;
    connectCalled: boolean;
    transport: mediasoup.types.PipeTransport | null;
}

interface ProducerHolder {
    routerId: string;
    transportId: string;
    producer: mediasoup.types.Producer | null;
    rtpParameters: RtpParameters;
    appData: SimpleMap;
    type: 'simple' | 'simulcast' | 'svc';
    kind: 'audio' | 'video';
}

interface ConsumerHolder {
    routerId: string;
    transportId: string
    producerId: string;
    consumer: mediasoup.types.Consumer | null;
    rtpParameters: RtpParameters;
    appData: SimpleMap;
    type: 'simple' | 'simulcast' | 'svc' | 'pipe';
    kind: 'audio' | 'video';
}

export class ServerWorker {

    // Callbacks
    onClosed?: () => void;

    // Config
    #id: string
    #worker: mediasoup.types.Worker;
    #nc: nats.Client;
    #loggerInfo: debug.Debugger;
    #loggerError: debug.Debugger;
    #listenIp: { ip: string, announceIp?: string };
    #rootTopic: string;

    // State
    #alive: boolean = true;
    #reportedAlive = false;
    #reportInterval!: NodeJS.Timeout;
    #subscription!: nats.Subscription;
    #currentSeq = 0;
    #events: Event[] = [];

    // Media
    #routersRepeatKey = new Map<string, string>();
    #routers = new Map<string, RouterHolder>();

    #webRtcTransports = new Map<string, WebRtcTransportHolder>();
    #webRtcTransportsRepeatKey = new Map<string, string>();
    #plainTransports = new Map<string, PlainTransportHolder>();
    #plainTransportsRepeatKey = new Map<string, string>();
    #pipeTransports = new Map<string, PipeTransportHolder>();
    #pipeTransportsRepeatKey = new Map<string, string>();

    #producers = new Map<string, ProducerHolder>();
    #producersRepeatKey = new Map<string, string>();

    #consumers = new Map<string, ConsumerHolder>();
    #consumersRepeatKey = new Map<string, string>();

    #lock = new AsyncLockMap();

    constructor(id: string, worker: mediasoup.types.Worker, options: WorkerOptions, logger: debug.Debugger, loggerError: debug.Debugger) {
        this.#id = id;
        this.#worker = worker;
        this.#nc = options.connectionInfo.nc;
        this.#loggerInfo = logger;
        this.#loggerError = loggerError;
        this.#listenIp = options.listenIp || { ip: '127.0.0.1' };
        this.#rootTopic = options.connectionInfo.rootTopic || 'mediakitchen';
        this.#init();
    }

    get id() {
        return this.#id;
    }

    get closed() {
        return !this.#alive;
    }

    #handleCommand = async (command: Commands, repeatKey: string) => {
        if (command.type === 'router-create') {
            return this.#commandRouterCreate(command, repeatKey);
        } else if (command.type === 'router-close') {
            return this.#commandRouterClose(command);
        } else if (command.type === 'transport-webrtc-create') {
            return this.#commandWebRTCTransportCreate(command, repeatKey);
        } else if (command.type === 'transport-webrtc-close') {
            return this.#commandWebRTCTransportClose(command);
        } else if (command.type === 'transport-webrtc-connect') {
            return this.#commandWebRTCTransportConnect(command);
        } else if (command.type === 'transport-webrtc-restart') {
            return this.#commandWebRTCTransportRestart(command);
        } else if (command.type === 'transport-plain-create') {
            return this.#commandPlainTransportCreate(command, repeatKey);
        } else if (command.type === 'transport-plain-close') {
            return this.#commandPlainTransportClose(command);
        } else if (command.type === 'transport-plain-connect') {
            return this.#commandPlainTransportConnect(command);
        } else if (command.type === 'transport-pipe-create') {
            return this.#commandPipeTransportCreate(command, repeatKey);
        } else if (command.type === 'transport-pipe-close') {
            return this.#commandPipeTransportClose(command);
        } else if (command.type === 'transport-pipe-connect') {
            return this.#commandPipeTransportConnect(command);
        } else if (command.type === 'produce-create') {
            return this.#commandProduceCreate(command, repeatKey);
        } else if (command.type === 'produce-pause') {
            return this.#commandProducePause(command);
        } else if (command.type === 'produce-resume') {
            return this.#commandProduceResume(command);
        } else if (command.type === 'produce-close') {
            return this.#commandProduceClose(command);
        } else if (command.type === 'consume-create') {
            return this.#commandConsumeCreate(command, repeatKey);
        } else if (command.type === 'consume-pause') {
            return this.#commandConsumePause(command);
        } else if (command.type === 'consume-resume') {
            return this.#commandConsumeResume(command);
        } else if (command.type === 'consume-close') {
            return this.#commandConsumeClose(command);
        } else if (command.type === 'get-stats') {
            return this.#commandGetStats(command);
        } else if (command.type === 'worker-kill') {
            this.close();
            return {};
        } else if (command.type === 'worker-events') {
            let res: GetEventsResponse;
            if (command.seq >= this.#currentSeq) {
                res = {
                    hasMore: false,
                    seq: this.#currentSeq,
                    events: []
                };
            }
            if (this.#currentSeq - command.seq > command.batchSize) {
                let events = this.#events.slice(command.seq - 1, command.seq + command.batchSize - 1);
                res = {
                    hasMore: true,
                    seq: command.seq + command.batchSize,
                    events
                };
            } else {
                res = {
                    hasMore: false,
                    seq: this.#currentSeq,
                    events: this.#events.slice(command.seq - 1)
                }
            }
            return res;
        } else if (command.type === 'worker-state') {
            return {
                seq: this.#currentSeq
            };
        }

        throw Error('Unknown command');
    }

    //
    // Router
    //

    #commandRouterCreate = (command: RouterCreateCommand, repeatKey: string): Promise<RouterCreateResponse> => {
        return this.#lock.inLock('router-create-' + repeatKey, async () => {
            if (this.#routersRepeatKey.has(repeatKey)) {
                let id = this.#routersRepeatKey.get(repeatKey)!;
                let router = this.#routers.get(id)!;
                if (!router.router) {
                    return {
                        id: id,
                        appData: router.appData,
                        closed: true,
                        time: now()
                    };
                } else {
                    return {
                        id: id,
                        appData: router.appData,
                        closed: false,
                        time: now()
                    };
                }
            }

            // Create Router
            let id = randomKey();
            let appData = command.args.appData || {};
            let router = await this.#worker.createRouter({ mediaCodecs: command.args.mediaCodecs, appData });
            router.observer.on('close', () => {
                let router = this.#routers.get(id)!;
                this.#onRouterClose(id, router);
            });

            // Register Router
            let holder = { router, appData };
            this.#routers.set(id, holder);
            this.#routersRepeatKey.set(repeatKey, id);
            this.#reportRouterState(id, holder);

            return { id: id, appData: router.appData, closed: false, time: now() };
        });
    }

    #commandRouterClose = async (command: RouterCloseCommand): Promise<RouterCloseResponse> => {

        // Resolve Router
        let id = command.args.id;
        let router = this.#routers.get(id);
        if (!router) {
            throw Error('Unable to find router');
        }
        if (!router.router) { // Already closed
            return { id: id, appData: router.appData, closed: true, time: now() };
        }

        // Close Router
        router.router.close();
        this.#onRouterClose(id, router);
        return { id: id, appData: router.appData, closed: true, time: now() };
    }

    #onRouterClose = (id: string, holder: RouterHolder) => {
        if (holder.router) {
            holder.router = null;
            this.#reportRouterState(id, holder);
        }
    }

    #reportRouterState = (id: string, router: RouterHolder) => {
        let state = this.#getRouterState(id, router);
        this.#loggerInfo('Router: ' + JSON.stringify(state));
        this.#doEvent({
            type: 'state-router',
            state,
            routerId: id,
            workerId: this.#id,
            time: now(),
        });
    }

    #getRouterState = (id: string, holder: RouterHolder): RouterState => {
        return {
            id,
            closed: !holder.router,
            appData: holder.appData,
            time: now()
        }
    }

    //
    // Transport
    //

    #commandWebRTCTransportCreate = (command: WebRTCTransportCreateCommand, repeatKey: string): Promise<WebRTCTransportCreateResponse> => {
        return this.#lock.inLock('webrtc-transport-create-' + repeatKey, async () => {
            if (this.#webRtcTransportsRepeatKey.has(repeatKey)) {
                let id = this.#webRtcTransportsRepeatKey.get(repeatKey)!;
                let holder = this.#webRtcTransports.get(id)!;
                return this.#getWebRTCTransportState(id, holder);
            }
            let routerHolder = this.#routers.get(command.routerId);
            if (!routerHolder) {
                throw Error('Unable to find router');
            }
            if (!routerHolder.router) {
                throw Error('Router closed');
            }
            let router = routerHolder.router;
            let id = randomKey();
            let appData = command.args.appData || {};
            let tr = await router.createWebRtcTransport({
                listenIps: [this.#listenIp],
                enableUdp: command.args.enableUdp,
                enableTcp: command.args.enableTcp,
                preferUdp: command.args.preferUdp,
                preferTcp: command.args.preferTcp,
                initialAvailableOutgoingBitrate: command.args.initialAvailableOutgoingBitrate,
                enableSctp: command.args.enableSctp,
                numSctpStreams: command.args.numSctpStreams,
                maxSctpMessageSize: command.args.maxSctpMessageSize,
                sctpSendBufferSize: command.args.sctpSendBufferSize,
                appData: appData
            });
            if (!routerHolder.router) {
                throw Error('Router closed');
            }
            tr.observer.on('close', () => {
                let holder = this.#webRtcTransports.get(id)!;
                this.#onWebRtcTransportClose(id, holder);
            });
            tr.on('icestatechange', () => {
                let holder = this.#webRtcTransports.get(id)!;
                this.#reportWebRtcTransportState(id, holder);
            });
            tr.on('iceselectedtuplechange', () => {
                let holder = this.#webRtcTransports.get(id)!;
                this.#reportWebRtcTransportState(id, holder);
            });
            tr.on('dtlsstatechange', () => {
                let holder = this.#webRtcTransports.get(id)!;
                this.#reportWebRtcTransportState(id, holder);
            });
            tr.on('sctpstatechange', () => {
                let holder = this.#webRtcTransports.get(id)!;
                this.#reportWebRtcTransportState(id, holder);
            });
            let holder: WebRtcTransportHolder = {
                transport: tr,
                routerId: command.routerId,
                iceCandidates: tr.iceCandidates,
                iceParameters: tr.iceParameters,
                dtlsParameters: tr.dtlsParameters,
                appData: appData,
                connectCalled: false
            };
            this.#webRtcTransportsRepeatKey.set(repeatKey, id);
            this.#webRtcTransports.set(id, holder);
            return this.#getWebRTCTransportState(id, holder);
        });
    }

    #commandWebRTCTransportConnect = async (command: WebRTCTransportConnectCommand): Promise<WebRTCTransportConnectResponse> => {
        let holder = this.#webRtcTransports.get(command.args.id);
        if (!holder) {
            throw Error('Unable to find transport ' + command.args.id);
        }
        if (!holder.transport) {
            return this.#getWebRTCTransportState(command.args.id, holder);
        }

        // Connect
        if (!holder.connectCalled) {
            holder.connectCalled = true;
            await holder.transport.connect({
                dtlsParameters: command.args.dtlsParameters
            });
        }

        // Refresh role
        holder.dtlsParameters.role = holder.transport.dtlsParameters.role;
        this.#reportWebRtcTransportState(command.args.id, holder);

        return this.#getWebRTCTransportState(command.args.id, holder);
    }

    #commandWebRTCTransportRestart = async (command: WebRTCTransportRestartCommand): Promise<WebRTCTransportRestartResponse> => {
        let holder = this.#webRtcTransports.get(command.args.id);
        if (!holder) {
            throw Error('Unable to find transport ' + command.args.id);
        }
        if (!holder.transport) {
            return this.#getWebRTCTransportState(command.args.id, holder);
        }

        // Restart
        await holder.transport.restartIce();
        holder.iceParameters = holder.transport.iceParameters;
        this.#reportWebRtcTransportState(command.args.id, holder);

        return this.#getWebRTCTransportState(command.args.id, holder);
    }

    #commandWebRTCTransportClose = async (command: WebRTCTransportCloseCommand): Promise<WebRTCTransportCloseResponse> => {
        let holder = this.#webRtcTransports.get(command.args.id);
        if (!holder) {
            throw Error('Unable to find transport');
        }
        if (!holder.transport) {
            return this.#getWebRTCTransportState(command.args.id, holder);
        }

        // Close Transport
        holder.transport.close();
        this.#onWebRtcTransportClose(command.args.id, holder);
        return this.#getWebRTCTransportState(command.args.id, holder);
    };

    #getWebRTCTransportState = (id: string, holder: WebRtcTransportHolder): WebRtcTransportState => {
        return {
            id,
            closed: !holder.transport,
            iceState: holder.transport ? holder.transport.iceState : 'closed',
            iceCandidates: holder.iceCandidates,
            dtlsState: holder.transport ? holder.transport.dtlsState : 'closed',
            appData: holder.appData,
            dtlsParameters: {
                role: holder.dtlsParameters.role,
                fingerprints: holder.dtlsParameters.fingerprints.map((v) => ({ algorithm: v.algorithm, value: v.value }))
            },
            iceParameters: {
                iceLite: holder.iceParameters.iceLite,
                usernameFragment: holder.iceParameters.usernameFragment,
                password: holder.iceParameters.password
            },
            time: now()
        }
    }

    #onWebRtcTransportClose = (id: string, holder: WebRtcTransportHolder) => {
        if (holder.transport) {
            holder.transport = null;
            this.#reportWebRtcTransportState(id, holder);
        }
    }

    #reportWebRtcTransportState = (id: string, holder: WebRtcTransportHolder) => {
        let state = this.#getWebRTCTransportState(id, holder);
        this.#loggerInfo('Transport: ' + JSON.stringify(state));
        this.#doEvent({
            type: 'state-webrtc-transport',
            state,
            transportId: id,
            routerId: holder.routerId,
            workerId: this.#id,
            time: now(),
        });
    }

    //
    // Plain Transport
    //

    #commandPlainTransportCreate = (command: PlainTransportCreateCommand, repeatKey: string) => {
        return this.#lock.inLock('plain-transport-create-' + repeatKey, async () => {
            if (this.#plainTransportsRepeatKey.has(repeatKey)) {
                let id = this.#plainTransportsRepeatKey.get(repeatKey)!;
                let holder = this.#plainTransports.get(id)!;
                return this.#getPlainTransportState(id, holder);
            }
            let routerHolder = this.#routers.get(command.routerId);
            if (!routerHolder) {
                throw Error('Unable to find router');
            }
            if (!routerHolder.router) {
                throw Error('Router closed');
            }
            let router = routerHolder.router;
            let id = randomKey();
            let appData = command.args.appData || {};
            let tr = await router.createPlainTransport({
                listenIp: this.#listenIp.ip,
                rtcpMux: command.args.rtcpMux,
                comedia: command.args.comedia,
                enableSctp: command.args.enableSctp,
                numSctpStreams: command.args.numSctpStreams,
                maxSctpMessageSize: command.args.maxSctpMessageSize,
                sctpSendBufferSize: command.args.sctpSendBufferSize,
                enableSrtp: command.args.enableSrtp,
                srtpCryptoSuite: command.args.srtpCryptoSuite,
                appData: appData
            });
            if (!routerHolder.router) {
                throw Error('Router closed');
            }

            if (!routerHolder.router) {
                throw Error('Router closed');
            }
            tr.observer.on('close', () => {
                let holder = this.#plainTransports.get(id)!;
                this.#onPlainTransportClose(id, holder);
            });
            tr.on('tuple', () => {
                let holder = this.#plainTransports.get(id)!;
                holder.tuple = holder.transport!.tuple;
                this.#reportPlainTransportState(id, holder);
            });
            tr.on('rtcptuple', () => {
                let holder = this.#plainTransports.get(id)!;
                holder.rtcpTuple = holder.transport!.rtcpTuple ? holder.transport!.rtcpTuple : null;
                this.#reportPlainTransportState(id, holder);
            });
            tr.on('sctpstatechange', () => {
                let holder = this.#plainTransports.get(id)!;
                this.#reportPlainTransportState(id, holder);
            });
            let holder: PlainTransportHolder = {
                transport: tr,
                routerId: command.routerId,
                appData: appData,
                tuple: tr.tuple,
                rtcpTuple: tr.rtcpTuple ? tr.rtcpTuple : null,
                sctpParameters: tr.sctpParameters ? tr.sctpParameters : null,
                srtpParameters: tr.srtpParameters ? tr.srtpParameters : null,
                connectCalled: false
            };
            this.#plainTransportsRepeatKey.set(repeatKey, id);
            this.#plainTransports.set(id, holder);
            return this.#getPlainTransportState(id, holder);
        });
    }

    #commandPlainTransportConnect = async (command: PlainTransportConnectCommand): Promise<PlainTransportConnectResponse> => {
        let holder = this.#plainTransports.get(command.args.id);
        if (!holder) {
            throw Error('Unable to find transport');
        }
        if (!holder.transport) {
            return this.#getPlainTransportState(command.args.id, holder);
        }

        // Connect
        if (!holder.connectCalled) {
            holder.connectCalled = true;
            await holder.transport.connect({
                ip: command.args.ip,
                port: command.args.port,
                rtcpPort: command.args.rtcpPort,
                srtpParameters: command.args.srtpParameters
            });
        }
        holder.tuple = holder.transport.tuple;
        holder.rtcpTuple = holder.transport.rtcpTuple ? holder.transport.rtcpTuple : null;
        holder.srtpParameters = holder.transport.srtpParameters ? holder.transport.srtpParameters : null;

        return this.#getPlainTransportState(command.args.id, holder);
    };

    #commandPlainTransportClose = async (command: PlainTransportCloseCommand): Promise<PlainTransportCloseResponse> => {
        let holder = this.#plainTransports.get(command.args.id);
        if (!holder) {
            throw Error('Unable to find transport');
        }
        if (!holder.transport) {
            return this.#getPlainTransportState(command.args.id, holder);
        }

        // Close Transport
        holder.transport.close();
        this.#onPlainTransportClose(command.args.id, holder);
        return this.#getPlainTransportState(command.args.id, holder);
    };

    #getPlainTransportState = (id: string, holder: PlainTransportHolder): PlainTransportState => {
        return {
            id,
            closed: !holder.transport,
            tuple: holder.tuple,
            rtcpTuple: holder.rtcpTuple,
            sctpParameters: holder.sctpParameters,
            srtpParameters: holder.srtpParameters,
            sctpState: holder.transport && holder.transport.sctpState ? holder.transport.sctpState : null,
            appData: holder.appData,
            time: now()
        }
    }

    #onPlainTransportClose = (id: string, holder: PlainTransportHolder) => {
        if (holder.transport) {
            holder.transport = null;
            this.#reportPlainTransportState(id, holder);
        }
    }

    #reportPlainTransportState = (id: string, holder: PlainTransportHolder) => {
        let state = this.#getPlainTransportState(id, holder);
        this.#loggerInfo('Transport: ' + JSON.stringify(state));
        this.#doEvent({
            type: 'state-plain-transport',
            state,
            transportId: id,
            routerId: holder.routerId,
            workerId: this.#id,
            time: now(),
        });
    }

    //
    // Pipe Transport
    //

    #commandPipeTransportCreate = (command: PipeTransportCreateCommand, repeatKey: string) => {
        return this.#lock.inLock('pipe-transport-create-' + repeatKey, async () => {
            if (this.#pipeTransportsRepeatKey.has(repeatKey)) {
                let id = this.#pipeTransportsRepeatKey.get(repeatKey)!;
                let holder = this.#pipeTransports.get(id)!;
                return this.#getPipeTransportState(id, holder);
            }
            let routerHolder = this.#routers.get(command.routerId);
            if (!routerHolder) {
                throw Error('Unable to find router');
            }
            if (!routerHolder.router) {
                throw Error('Router closed');
            }
            let router = routerHolder.router;
            let id = randomKey();
            let appData = command.args.appData || {};
            let tr = await router.createPipeTransport({
                listenIp: this.#listenIp.ip,
                enableSctp: command.args.enableSctp,
                numSctpStreams: command.args.numSctpStreams,
                maxSctpMessageSize: command.args.maxSctpMessageSize,
                sctpSendBufferSize: command.args.sctpSendBufferSize,
                enableRtx: command.args.enableRtx,
                enableSrtp: command.args.enableSrtp,
                appData: appData
            });
            if (!routerHolder.router) {
                throw Error('Router closed');
            }

            if (!routerHolder.router) {
                throw Error('Router closed');
            }
            tr.observer.on('close', () => {
                let holder = this.#pipeTransports.get(id)!;
                this.#onPipeTransportClose(id, holder);
            });
            tr.on('sctpstatechange', () => {
                let holder = this.#pipeTransports.get(id)!;
                this.#reportPipeTransportState(id, holder);
            });
            let holder: PipeTransportHolder = {
                transport: tr,
                routerId: command.routerId,
                appData: appData,
                tuple: tr.tuple,
                sctpParameters: tr.sctpParameters ? tr.sctpParameters : null,
                srtpParameters: tr.srtpParameters ? tr.srtpParameters : null,
                connectCalled: false
            };
            this.#pipeTransportsRepeatKey.set(repeatKey, id);
            this.#pipeTransports.set(id, holder);
            return this.#getPipeTransportState(id, holder);
        });
    }

    #commandPipeTransportConnect = async (command: PipeTransportConnectCommand): Promise<PipeTransportConnectResponse> => {
        let holder = this.#pipeTransports.get(command.args.id);
        if (!holder) {
            throw Error('Unable to find transport');
        }
        if (!holder.transport) {
            return this.#getPipeTransportState(command.args.id, holder);
        }

        // Connect
        if (!holder.connectCalled) {
            holder.connectCalled = true;
            await holder.transport.connect({
                ip: command.args.ip,
                port: command.args.port,
                srtpParameters: command.args.srtpParameters
            });
        }
        holder.tuple = holder.transport.tuple;

        return this.#getPipeTransportState(command.args.id, holder);
    };

    #commandPipeTransportClose = async (command: PipeTransportCloseCommand): Promise<PipeTransportCloseResponse> => {
        let holder = this.#pipeTransports.get(command.args.id);
        if (!holder) {
            throw Error('Unable to find transport');
        }
        if (!holder.transport) {
            return this.#getPipeTransportState(command.args.id, holder);
        }

        // Close Transport
        holder.transport.close();
        this.#onPipeTransportClose(command.args.id, holder);
        return this.#getPipeTransportState(command.args.id, holder);
    };

    #getPipeTransportState = (id: string, holder: PipeTransportHolder): PipeTransportState => {
        return {
            id,
            closed: !holder.transport,
            tuple: holder.tuple,
            srtpParameters: holder.srtpParameters,
            sctpParameters: holder.sctpParameters,
            sctpState: holder.transport && holder.transport.sctpState ? holder.transport.sctpState : null,
            appData: holder.appData,
            time: now()
        }
    }

    #onPipeTransportClose = (id: string, holder: PipeTransportHolder) => {
        if (holder.transport) {
            holder.transport = null;
            this.#reportPipeTransportState(id, holder);
        }
    }

    #reportPipeTransportState = (id: string, holder: PipeTransportHolder) => {
        let state = this.#getPipeTransportState(id, holder);
        this.#loggerInfo('Transport: ' + JSON.stringify(state));
        this.#doEvent({
            type: 'state-pipe-transport',
            state,
            transportId: id,
            routerId: holder.routerId,
            workerId: this.#id,
            time: now(),
        });
    }

    //
    // Producer
    //

    #commandProduceCreate = async (command: ProduceCommand, repeatKey: string): Promise<ProduceResponse> => {
        if (this.#producersRepeatKey.has(repeatKey)) {
            let id = this.#producersRepeatKey.get(repeatKey)!;
            let holder = this.#producers.get(id)!;
            return this.#getProducerState(id, holder);
        }

        // Find transport
        let transportHolder = this.#webRtcTransports.get(command.transportId) || this.#plainTransports.get(command.transportId) || this.#pipeTransports.get(command.transportId);
        if (transportHolder) {
            if (!transportHolder.transport) {
                throw Error('Transport closed');
            }
        } else {
            throw Error('Unable to find transport');
        }

        // Create producer
        let id = randomKey();
        let appData = command.args.appData || {};
        let producer = await transportHolder.transport.produce(command.args);

        // What if transport has been closed concurrently?
        if (!transportHolder.transport) {
            throw Error('Transport closed');
        }
        producer.observer.on('close', () => {
            let holder = this.#producers.get(id)!;
            this.#onProducerClose(id, holder);
        });
        producer.observer.on('paused', () => {
            let holder = this.#producers.get(id)!;
            this.#reportProducerState(id, holder);
        });
        producer.observer.on('resume', () => {
            let holder = this.#producers.get(id)!;
            this.#reportProducerState(id, holder);
        });
        let holder: ProducerHolder = {
            producer,
            rtpParameters: producer.rtpParameters,
            kind: producer.kind,
            type: producer.type,
            routerId: transportHolder.routerId,
            transportId: id,
            appData: appData
        };
        this.#producers.set(id, holder);
        this.#producersRepeatKey.set(id, repeatKey);
        return this.#getProducerState(id, holder);
    }

    #commandProducePause = async (command: ProducePauseCommand): Promise<ProducePauseResponse> => {
        let holder = this.#producers.get(command.args.id);
        if (!holder) {
            throw Error('Unable to find producer');
        }
        if (!holder.producer) {
            return this.#getProducerState(command.args.id, holder);
        }
        await holder.producer.pause();
        return this.#getProducerState(command.args.id, holder);
    }

    #commandProduceResume = async (command: ProduceResumeCommand): Promise<ProduceResumeResponse> => {
        let holder = this.#producers.get(command.args.id);
        if (!holder) {
            throw Error('Unable to find producer');
        }
        if (!holder.producer) {
            return this.#getProducerState(command.args.id, holder);
        }
        await holder.producer.resume();
        return this.#getProducerState(command.args.id, holder);
    }

    #commandProduceClose = async (command: ProduceCloseCommand): Promise<ProduceCloseResponse> => {
        let holder = this.#producers.get(command.args.id);
        if (!holder) {
            throw Error('Unable to find producer');
        }
        if (!holder.producer) {
            return this.#getProducerState(command.args.id, holder);
        }
        holder.producer.close();
        this.#onProducerClose(command.args.id, holder);

        return this.#getProducerState(command.args.id, holder);
    }

    #onProducerClose = (id: string, holder: ProducerHolder) => {
        if (holder.producer) {
            holder.producer = null;
            this.#reportProducerState(id, holder);
        }
    }

    #getProducerState = (id: string, holder: ProducerHolder): ProducerState => {
        return {
            id,
            appData: holder.appData,
            rtpParameters: holder.rtpParameters,
            closed: !holder.producer,
            paused: holder.producer ? holder.producer.paused : true,
            kind: holder.kind,
            type: holder.type,
            time: now()
        }
    }

    #reportProducerState = (id: string, holder: ProducerHolder) => {
        let state = this.#getProducerState(id, holder);
        this.#loggerInfo('Producer: ' + JSON.stringify(state));
        this.#doEvent({
            type: 'state-producer',
            state,
            producerId: id,
            transportId: holder.transportId,
            routerId: holder.routerId,
            workerId: this.#id,
            time: now(),
        });
    }

    //
    // Consumer
    //

    #commandConsumeCreate = async (command: ConsumeCommand, repeatKey: string): Promise<ConsumeResponse> => {
        if (this.#consumersRepeatKey.has(repeatKey)) {
            let id = this.#consumersRepeatKey.get(repeatKey)!;
            let holder = this.#consumers.get(id)!;
            return this.#getConsumerState(id, holder);
        }

        let transportHolder = this.#webRtcTransports.get(command.transportId) || this.#plainTransports.get(command.transportId) || this.#pipeTransports.get(command.transportId);
        if (!transportHolder) {
            throw Error('Unable to find transport');
        }
        let producer = this.#producers.get(command.producerId);
        if (!producer) {
            throw Error('Unable to find producer');
        }
        if (!transportHolder.transport) {
            throw Error('Transport closed');
        }
        if (!producer.producer) {
            throw Error('Producer closed');
        }

        let consumer = await transportHolder.transport.consume({ producerId: producer.producer.id, ...command.args });

        if (!transportHolder.transport) {
            throw Error('Transport closed');
        }
        if (!producer.producer) {
            throw Error('Producer closed');
        }

        let id = randomKey();
        consumer.observer.on('close', () => {
            let holder = this.#consumers.get(id)!;
            this.#onConsumerClose(id, holder);
        });
        consumer.observer.on('pause', () => {
            let holder = this.#consumers.get(id)!;
            this.#reportConsumerState(id, holder);
        });
        consumer.observer.on('resume', () => {
            let holder = this.#consumers.get(id)!;
            this.#reportConsumerState(id, holder);
        });
        let holder: ConsumerHolder = {
            routerId: transportHolder.routerId,
            transportId: command.transportId,
            producerId: command.producerId,
            consumer: consumer,
            rtpParameters: consumer.rtpParameters,
            appData: command.args.appData || {},
            type: consumer.type,
            kind: consumer.kind
        };
        this.#consumers.set(id, holder);
        this.#consumersRepeatKey.set(repeatKey, id);

        return this.#getConsumerState(id, holder);
    }

    #commandConsumePause = async (command: ConsumePauseCommand): Promise<ConsumePauseResponse> => {
        let holder = this.#consumers.get(command.args.id);
        if (!holder) {
            throw Error('Unable to find consumer');
        }
        if (!holder.consumer) {
            return this.#getConsumerState(command.args.id, holder);
        }
        await holder.consumer.pause();
        return this.#getConsumerState(command.args.id, holder);
    }

    #commandConsumeResume = async (command: ConsumeResumeCommand): Promise<ConsumeResumeResponse> => {
        let holder = this.#consumers.get(command.args.id);
        if (!holder) {
            throw Error('Unable to find consumer');
        }
        if (!holder.consumer) {
            return this.#getConsumerState(command.args.id, holder);
        }
        await holder.consumer.resume();
        return this.#getConsumerState(command.args.id, holder);
    }

    #commandConsumeClose = async (command: ConsumeCloseCommand): Promise<ConsumeCloseResponse> => {
        let holder = this.#consumers.get(command.args.id);
        if (!holder) {
            throw Error('Unable to find consumer');
        }
        if (!holder.consumer) {
            return this.#getConsumerState(command.args.id, holder);
        }
        holder.consumer.close();
        this.#onConsumerClose(command.args.id, holder);
        return this.#getConsumerState(command.args.id, holder);
    }

    #commandGetStats = async (command: StatsCommand): Promise<StatsResponse> => {

        let webrtcTransport = this.#webRtcTransports.get(command.args.id);
        if (webrtcTransport && webrtcTransport.transport) {
            return { data: JSON.stringify(await webrtcTransport.transport.getStats()) };
        }

        let pipeTransport = this.#pipeTransports.get(command.args.id);
        if (pipeTransport && pipeTransport.transport) {
            return { data: JSON.stringify(await pipeTransport.transport.getStats()) };
        }

        let plainTransport = this.#plainTransports.get(command.args.id);
        if (plainTransport && plainTransport.transport) {
            return { data: JSON.stringify(await plainTransport.transport.getStats()) };
        }

        let consumer = this.#consumers.get(command.args.id);
        if (consumer && consumer.consumer) {
            return { data: JSON.stringify(await consumer.consumer.getStats()) };
        }

        let producer = this.#producers.get(command.args.id);
        if (producer && producer.producer) {
            return { data: JSON.stringify(await producer.producer.getStats()) };
        }

        return { data: null };
    }

    #onConsumerClose = (id: string, holder: ConsumerHolder) => {
        if (holder.consumer) {
            holder.consumer = null;
            this.#reportConsumerState(id, holder);
        }
    }

    #getConsumerState = (id: string, holder: ConsumerHolder): ConsumerState => {
        return {
            id,
            type: holder.type,
            kind: holder.kind,
            closed: !holder.consumer,
            paused: holder.consumer ? holder.consumer.paused : true,
            appData: holder.appData,
            rtpParameters: holder.rtpParameters,
            time: now()
        };
    }

    #reportConsumerState = (id: string, holder: ConsumerHolder) => {
        let state = this.#getConsumerState(id, holder);
        this.#loggerInfo('Consumer: ' + JSON.stringify(state));
        this.#doEvent({
            type: 'state-consumer',
            state,
            consumerId: id,
            producerId: holder.producerId,
            transportId: holder.transportId,
            routerId: holder.routerId,
            workerId: this.#id,
            time: now(),
        });
    }

    //
    // Events
    //

    #reportWorkerState = (state: 'alive' | 'dead') => {
        if (state === 'alive') {
            if (!this.#reportedAlive) {
                this.#reportedAlive = true;
                this.#loggerInfo('Report: ' + state);
            }
        } else {
            if (this.#reportedAlive) {
                this.#reportedAlive = false;
                this.#loggerError('Report: ' + state);
            }
        }

        let data: Report = {
            type: 'report',
            workerId: this.#id,
            appData: this.#worker.appData,
            state,
            time: now()
        };
        this.#nc.publish(this.#rootTopic + '.report', data);
    }

    #doEvent = (data: Event) => {
        if (eventsCodec.is(data)) {
            this.#currentSeq++;
            this.#events[this.#currentSeq - 1] = data; // Array will auto expand
            let box: EventBox = {
                seq: this.#currentSeq,
                event: data
            }
            this.#nc.publish(this.#rootTopic + '.' + this.id + '.events', box);
        }
    }

    //
    // Lifecycle
    //

    #init = async () => {

        // Handle worker death
        this.#worker.on('died', () => {
            this.#loggerError('Dies');
            this.close();
        });

        // Subscribe for commands
        try {
            this.#subscription = await this.#nc.subscribe(this.#rootTopic + '.' + this.#id + '.commands', (err: nats.NatsError | null, src: nats.Msg) => {

                // Close worker on error
                if (err) {
                    this.close();
                    return;
                }

                // Decode wire format
                let boxData = commandBoxCodec.decode(src.data);
                if (isLeft(boxData)) {
                    this.#loggerError('Invalit package');
                    this.#loggerError(boxData.left);
                    if (src.reply && this.#alive) {
                        this.#nc.publish(src.reply, { response: 'error', message: 'Invalid package' });
                    }
                    return;
                }
                let box = boxData.right;

                // Handle command
                (async () => {
                    try {
                        let r = await this.#handleCommand(box.command, box.repeatKey);
                        if (src.reply && this.#alive) {
                            this.#nc.publish(src.reply, { response: 'success', data: r });
                        }
                    } catch (e) {
                        this.#loggerError('Command errored');
                        this.#loggerError(e);
                        let message = 'Unknown error';
                        if (e && typeof e.message === 'string') {
                            message = e.message;
                        }
                        if (src.reply && this.#alive) {
                            this.#nc.publish(src.reply, { response: 'error', message });
                        }
                    }
                })();
            });

            this.#loggerInfo('Subscribed');

            // Already closed
            if (!this.#alive) {
                this.#subscription.unsubscribe();
                return;
            }

            // Report node
            this.#reportWorkerState('alive');
            this.#reportInterval = setInterval(() => {
                this.#reportWorkerState('alive');
            }, 2500);

            this.#loggerInfo('Started');
        } catch (e) {
            this.#loggerError(e);
            this.close();
        }
    }


    close = () => {
        if (this.#alive) {
            this.#alive = false;

            this.#loggerInfo('Closing');

            // Stop reporting
            if (this.#reportInterval) {
                clearInterval(this.#reportInterval);
            }

            // Stop subscription
            if (this.#subscription) {
                this.#subscription.unsubscribe();
            }

            // Report theath
            this.#reportWorkerState('dead');

            // Close Worker
            this.#worker.close();

            this.#loggerInfo('Closed');

            if (this.onClosed) {
                this.onClosed();
            }
        } else {
            // Just ignore
        }
    }
}