import { commandBoxCodec, Commands, RouterCreateResponse, RouterCreateCommand, RouterCloseCommand, RouterCloseResponse, WebRTCTransportCreateCommand, WebRTCTransportCreateResponse, WebRTCTransportCloseCommand, WebRTCTransportCloseResponse, WebRTCTransportConnectCommand, WebRTCTransportConnectResponse, ProduceCommand, ProduceResponse, ProduceCloseCommand, ProduceCloseResponse, ConsumeCommand, ConsumeResponse } from './../wire/commands';
import { Event, eventCodec } from './../wire/events';
import * as nats from 'ts-nats';
import * as mediasoup from 'mediasoup';
import { randomKey } from '../utils/randomKey';
import debug from 'debug';
import { isLeft } from 'fp-ts/lib/Either';
import { now } from '../utils/time';
import { TransportListenIp } from 'mediasoup/lib/types';

export class KitchenServerWorker {
    #id: string
    #worker: mediasoup.types.Worker;
    #nc: nats.Client;
    #logger: debug.Debugger;
    #listenIps: TransportListenIp[] | string[];

    // State
    #alive: boolean = true;
    #reportInterval!: NodeJS.Timeout;
    #subscription!: nats.Subscription;
    #commands = new Map<string, Promise<any>>();

    // Media
    #routers = new Map<string, mediasoup.types.Router>();
    #transports = new Map<string, { transport: mediasoup.types.WebRtcTransport, routerId: string }>();
    #producers = new Map<string, { producer: mediasoup.types.Producer, routerId: string, transportId: string }>();
    #consumers = new Map<string, { consumer: mediasoup.types.Consumer, routerId: string, transportId: string, producerId: string }>();

    constructor(id: string, worker: mediasoup.types.Worker, listenIps: TransportListenIp[] | string[], nc: nats.Client, logger: debug.Debugger) {
        this.#id = id;
        this.#worker = worker;
        this.#nc = nc;
        this.#logger = logger;
        this.#listenIps = listenIps;
        this.#init();
    }


    #handleCommand = async (command: Commands) => {
        if (command.type === 'router-create') {
            return this.#commandRouterCreate(command);
        } else if (command.type === 'router-close') {
            return this.#commandRouterClose(command);
        } else if (command.type === 'transport-webrtc-create') {
            return this.#commandWebRTCTransportCreate(command);
        } else if (command.type === 'transport-webrtc-close') {
            return this.#commandWebRTCTransportClose(command);
        } else if (command.type === 'transport-webrtc-connect') {
            return this.#commandWebRTCTransportConnect(command);
        } else if (command.type === 'produce-create') {
            return this.#commandProduceCreate(command);
        } else if (command.type === 'produce-close') {
            return this.#commandProduceClose(command);
        } else if (command.type === 'consume-create') {
            return this.#commandConsumeCreate(command);
        } else if (command.type === 'worker-kill') {
            this.close();
            return {};
        }

        throw Error('Unknown command');
    }

    #commandRouterCreate = async (command: RouterCreateCommand): Promise<RouterCreateResponse> => {
        let id = randomKey();
        let router = await this.#worker.createRouter({ mediaCodecs: command.args.mediaCodecs, appData: command.args.appData || {} });
        router.observer.on('close', () => {
            this.#reportRouterClose(id)
        });
        this.#routers.set(id, router);
        return { id: id };
    }

    #commandRouterClose = async (command: RouterCloseCommand): Promise<RouterCloseResponse> => {
        let id = command.args.id;
        let router = this.#routers.get(id);
        if (!router) {
            throw Error('Unable to find router ' + id);
        }
        this.#routers.delete(id)
        router.close();
        return { id: id };
    }

    #commandWebRTCTransportCreate = async (command: WebRTCTransportCreateCommand): Promise<WebRTCTransportCreateResponse> => {
        let router = this.#routers.get(command.routerId);
        if (!router) {
            throw Error('Unable to find router ' + command.routerId);
        }

        let id = randomKey();
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
            appData: command.args.appData || {}
        });
        this.#transports.set(id, { transport: tr, routerId: command.routerId });
        return {
            transportId: id,
            routerId: command.routerId,
            appData: command.args.appData || {},
            dtlsParameters: {
                dtlsRole: tr.dtlsParameters.role,
                fingerprints: tr.dtlsParameters.fingerprints.map((v) => ({ algorithm: v.algorithm, value: v.value }))
            },
            iceParameters: {
                iceLite: tr.iceParameters.iceLite,
                usernameFragment: tr.iceParameters.usernameFragment,
                password: tr.iceParameters.password
            }
        };
    }

    #commandWebRTCTransportConnect = async (command: WebRTCTransportConnectCommand): Promise<WebRTCTransportConnectResponse> => {
        let transport = this.#transports.get(command.args.id);
        if (!transport) {
            throw Error('Unable to find transport ' + command.args.id);
        }

        await transport.transport.connect({
            dtlsParameters: command.args.dtlsParameters
        });

        return { id: command.args.id };
    }

    #commandWebRTCTransportClose = async (command: WebRTCTransportCloseCommand): Promise<WebRTCTransportCloseResponse> => {
        let transport = this.#transports.get(command.args.id);
        if (!transport) {
            throw Error('Unable to find transport ' + command.args.id);
        }
        transport.transport.close();
        this.#transports.delete(command.args.id);
        return { id: command.args.id };
    };

    #commandProduceCreate = async (command: ProduceCommand): Promise<ProduceResponse> => {
        let transport = this.#transports.get(command.transportId);
        if (!transport) {
            throw Error('Unable to find transport ' + command.transportId);
        }

        let id = randomKey();
        let producer = await transport.transport.produce(command.args);
        this.#producers.set(id, { producer, routerId: transport.routerId, transportId: id });
        return {
            id,
            type: producer.type,
            paused: producer.paused,
            rtpParameters: producer.rtpParameters as any
        };
    }

    #commandProduceClose = async (command: ProduceCloseCommand): Promise<ProduceCloseResponse> => {
        let producer = this.#producers.get(command.args.id);
        if (!producer) {
            throw Error('Unable to find producer ' + command.args.id);
        }
        producer.producer.close();
        this.#producers.delete(command.args.id);
        return { id: command.args.id };
    }

    #commandConsumeCreate = async (command: ConsumeCommand): Promise<ConsumeResponse> => {
        let transport = this.#transports.get(command.transportId);
        if (!transport) {
            throw Error('Unable to find transport ' + command.transportId);
        }
        let producer = this.#producers.get(command.producerId);
        if (!producer) {
            throw Error('Unable to find producer ' + command.producerId);
        }

        let id = randomKey();
        let consumer = await transport.transport.consume({ producerId: producer.producer.id, ...command.args });
        this.#consumers.set(id, { routerId: transport.routerId, transportId: transport.routerId, producerId: command.producerId, consumer });

        return {
            id,
            type: consumer.type,
            paused: consumer.paused,
            rtpParameters: consumer.rtpParameters as any
        }
    }

    //
    // Events
    //

    #reportWorkerState = (state: 'alive' | 'dead') => {
        this.#logger('Report: ' + state);
        this.#doReport({
            type: 'report',
            workerId: this.#id,
            time: now(),
            appData: this.#worker.appData,
            state
        });
    }

    #reportRouterClose = (id: string) => {
        this.#logger('Router close: ' + id);
        this.#doReport({
            type: 'router-closed',
            routerId: id,
            workerId: this.#id,
            time: now(),
        });
    }

    #doReport = (data: Event) => {
        if (eventCodec.is(data)) {
            this.#nc.publish('mediakitchen/report', data);
        }
    }

    //
    // Lifecycle
    //

    #init = async () => {
        // Subscribe for commands
        try {
            this.#subscription = await this.#nc.subscribe('mediakitchen/worker/' + this.#id, (err: nats.NatsError | null, src: nats.Msg) => {

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

                // Handle command retry
                let commandPromise = this.#commands.get(box.command.type + '-' + box.repeatKey);
                if (!commandPromise) {
                    commandPromise = this.#handleCommand(box.command);
                    this.#commands.set(box.command.type + '-' + box.repeatKey, commandPromise);
                }

                // Handle command
                (async () => {
                    try {
                        let r = await commandPromise;
                        if (src.reply && this.#alive) {
                            this.#nc.publish(src.reply, { response: 'success', data: r });
                        }
                    } catch (e) {
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

            this.#logger('Subscribed');

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

            // Handle worker death
            this.#worker.on('dies', () => {
                this.close();
            });

            this.#logger('Started');
        } catch (e) {
            this.#logger(e);
            this.close();
        }
    }


    close = () => {
        if (this.#alive) {
            this.#alive = false;

            this.#logger('Closing');

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

            this.#logger('Closed');
        } else {
            // Just ignore
        }
    }
}

export async function createWorker(nc: nats.Client, listenIps: TransportListenIp[] | string[], {
    logLevel = 'error',
    logTags,
    rtcMinPort = 10000,
    rtcMaxPort = 59999,
    dtlsCertificateFile,
    dtlsPrivateKeyFile,
    appData = {}
}: mediasoup.types.WorkerSettings = {}) {

    // Globaly unique id of a worker
    let id = randomKey();

    let logger = debug('mediakitchen:' + id);

    logger('Starting');

    let rawWorker = await mediasoup.createWorker({
        logLevel,
        logTags,
        rtcMinPort,
        rtcMaxPort,
        dtlsCertificateFile,
        dtlsPrivateKeyFile,
        appData
    });

    logger('Raw Worker started');

    return new KitchenServerWorker(id, rawWorker, listenIps, nc, logger);
}