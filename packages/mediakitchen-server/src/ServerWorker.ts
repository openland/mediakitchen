import * as nats from 'ts-nats';
import * as mediasoup from 'mediasoup';
import debug from 'debug';
import { isLeft } from 'fp-ts/lib/Either';
import { WorkerOptions } from './WorkerOptions';
import {
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
    now
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
    #listenIps: { ip: string, announceIp?: string }[] | string[];
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

    #transports = new Map<string, WebRtcTransportHolder>();
    #transportsRepeatKey = new Map<string, string>();

    #producers = new Map<string, ProducerHolder>();
    #producersRepeatKey = new Map<string, string>();

    #consumers = new Map<string, ConsumerHolder>();
    #consumersRepeatKey = new Map<string, string>();

    constructor(id: string, worker: mediasoup.types.Worker, options: WorkerOptions, logger: debug.Debugger, loggerError: debug.Debugger) {
        this.#id = id;
        this.#worker = worker;
        this.#nc = options.connectionInfo.nc;
        this.#loggerInfo = logger;
        this.#loggerError = loggerError;
        this.#listenIps = options.listenIps || ['127.0.0.1'];
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

    #commandRouterCreate = async (command: RouterCreateCommand, repeatKey: string): Promise<RouterCreateResponse> => {
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

    #commandWebRTCTransportCreate = async (command: WebRTCTransportCreateCommand, repeatKey: string): Promise<WebRTCTransportCreateResponse> => {
        if (this.#transportsRepeatKey.has(repeatKey)) {
            let id = this.#transportsRepeatKey.get(repeatKey)!;
            let holder = this.#transports.get(id)!;
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
            listenIps: this.#listenIps,
            enableUdp: command.args.enableUdp,
            enableTcp: command.args.enableTcp,
            preferUdp: command.args.preferUdp,
            preferTcp: command.args.preferTcp,
            initialAvailableOutgoingBitrate: command.args.initialAvailableOutgoingBitrate,
            enableSctp: command.args.enableSctp,
            numSctpStreams: command.args.numSctpStreams,
            maxSctpMessageSize: command.args.maxSctpMessageSize,
            appData: appData
        });
        if (!routerHolder.router) {
            throw Error('Router closed');
        }
        tr.observer.on('close', () => {
            let holder = this.#transports.get(id)!;
            this.#onWebRtcTransportClose(id, holder);
        });
        tr.on('icestatechange', () => {
            let holder = this.#transports.get(id)!;
            this.#reportWebRtcTransportState(id, holder);
        });
        tr.on('iceselectedtuplechange', () => {
            let holder = this.#transports.get(id)!;
            this.#reportWebRtcTransportState(id, holder);
        });
        tr.on('dtlsstatechange', () => {
            let holder = this.#transports.get(id)!;
            this.#reportWebRtcTransportState(id, holder);
        });
        tr.on('sctpstatechange', () => {
            let holder = this.#transports.get(id)!;
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
        this.#transportsRepeatKey.set(repeatKey, id);
        this.#transports.set(id, holder);
        return this.#getWebRTCTransportState(id, holder);
    }

    #commandWebRTCTransportConnect = async (command: WebRTCTransportConnectCommand): Promise<WebRTCTransportConnectResponse> => {
        let holder = this.#transports.get(command.args.id);
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

    #commandWebRTCTransportClose = async (command: WebRTCTransportCloseCommand): Promise<WebRTCTransportCloseResponse> => {
        let holder = this.#transports.get(command.args.id);
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
    // Producer
    //

    #commandProduceCreate = async (command: ProduceCommand, repeatKey: string): Promise<ProduceResponse> => {
        if (this.#producersRepeatKey.has(repeatKey)) {
            let id = this.#producersRepeatKey.get(repeatKey)!;
            let holder = this.#producers.get(id)!;
            return this.#getProducerState(id, holder);
        }

        let transportHolder = this.#transports.get(command.transportId);
        if (!transportHolder) {
            throw Error('Unable to find transport');
        }
        if (!transportHolder.transport) {
            throw Error('Transport closed');
        }

        let id = randomKey();
        let appData = command.args.appData || {};
        let producer = await transportHolder.transport.produce(command.args);
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

        let transport = this.#transports.get(command.transportId);
        if (!transport) {
            throw Error('Unable to find transport');
        }
        let producer = this.#producers.get(command.producerId);
        if (!producer) {
            throw Error('Unable to find producer');
        }
        if (!transport.transport) {
            throw Error('Transport closed');
        }
        if (!producer.producer) {
            throw Error('Producer closed');
        }

        let consumer = await transport.transport.consume({ producerId: producer.producer.id, ...command.args });

        if (!transport.transport) {
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
            routerId: transport.routerId,
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
                    return /* Ignore */;
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