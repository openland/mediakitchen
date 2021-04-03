import os from 'os';
import * as changeCase from 'change-case';
import publicIp from 'public-ip';
import { connect, Payload } from 'ts-nats';
import {
    randomKey, backoff, SimpleMap
} from 'mediakitchen-common';
import { ServerWorker } from './ServerWorker';
import { createWorker } from "./createWorker";
import { WorkerLogTag } from 'mediasoup/lib/Worker';
import debug from 'debug';

const loggerInfo = debug('mediakitchen:');
loggerInfo.log = console.info.bind(console);

(async () => {
    try {
        loggerInfo('Starting...');

        // Resolve Workers Count
        const workersCount =
            process.env.MEDIAKITCHEN_WORKERS
                ? parseInt(process.env.MEDIAKITCHEN_WORKERS, 10)
                : os.cpus().length;

        // Resolve IPs
        let listenIp = process.env.MEDIAKITCHEN_LISTEN || '0.0.0.0';
        let announce = process.env.MEDIAKITCHEN_ANNOUNCE || '127.0.0.1';
        if (process.env.MEDIAKITCHEN_DETECT_IP === 'true') {
            loggerInfo('Detecting public ip...');
            let ip = await publicIp.v4();
            loggerInfo('IP detected: ' + ip);
            announce = ip;
        }

        // Resolve Ports
        let minPort = process.env.MEDIAKITCHEN_MIN_PORT ? parseInt(process.env.MEDIAKITCHEN_MIN_PORT, 10) : 10000;
        let maxPort = process.env.MEDIAKITCHEN_MAX_PORT ? parseInt(process.env.MEDIAKITCHEN_MAX_PORT, 10) : 59999;

        // Resolve log tags
        let logTags: WorkerLogTag[] = [];
        if (process.env.MEDIAKITCHEN_LOG_TAGS) {
            logTags = process.env.MEDIAKITCHEN_LOG_TAGS.split(',') as WorkerLogTag[];
        }

        // Resolve log level
        let logLevel: 'debug' | 'warn' | 'error' | 'none' = 'error';
        if (process.env.MEDIAKITCHEN_LOG_LEVEL === 'debug') {
            logLevel = 'debug';
        } else if (process.env.MEDIAKITCHEN_LOG_LEVEL === 'warn') {
            logLevel = 'warn';
        } else if (process.env.MEDIAKITCHEN_LOG_LEVEL === 'error') {
            logLevel = 'error';
        } else if (process.env.MEDIAKITCHEN_LOG_LEVEL === 'none') {
            logLevel = 'none';
        }

        // Resolve Root Topic
        let rootTopic = process.env.MEDIAKITCHEN_TOPIC || 'mediakitchen';

        // NATS
        let natsHost = process.env.MEDIAKITCHEN_NATS ? process.env.MEDIAKITCHEN_NATS.split(',').map((v) => v.trim()) : [];

        // Resolve App Data
        const appData: SimpleMap = {};
        const processId = randomKey();
        appData['process'] = processId;
        appData['topic'] = rootTopic;
        appData['ip'] = announce;
        appData['maxPort'] = maxPort;
        appData['minPort'] = minPort;

        for (let k of Object.keys(process.env)) {
            if (k.startsWith('MEDIAKITCHEN_')) {
                let subs = k.substring('MEDIAKITCHEN_'.length);
                let converted = changeCase.camelCase(subs);
                appData[converted] = process.env[k]!
            }
        }

        loggerInfo('App Data:');
        loggerInfo(appData);

        // Connect to NATS
        loggerInfo('Connecting to NATS...');
        const nc = await connect({ payload: Payload.JSON, servers: natsHost.length > 0 ? natsHost : undefined });

        // Spawn Workers
        loggerInfo('Spawing workers....');
        let closing = false;
        let workers: ServerWorker[] = [];
        async function spawnWorker(index: number) {
            let w = await createWorker({
                listenIps: [{ ip: listenIp, announcedIp: announce }],
                connectionInfo: { nc, rootTopic },
                settings: {
                    rtcMaxPort: maxPort,
                    rtcMinPort: minPort,
                    logTags,
                    logLevel,
                    appData: appData
                }
            });
            w.onClosed = () => {
                if (closing) {
                    return;
                }
                loggerInfo('Worker ' + w.id + ' closed');
                backoff(async () => {
                    if (closing) {
                        return;
                    }
                    await spawnWorker(index);
                });
            };
            if (closing) {
                w.close();
                return;
            }
            loggerInfo('Worker ' + w.id + ' started');
            workers[index] = w;
        }
        for (let i = 0; i < workersCount; i++) {
            await spawnWorker(i);
        }

        // Started
        loggerInfo('Started');

        // Graceful shutdown
        async function onExit() {
            if (closing) {
                return;
            }
            closing = true;
            loggerInfo('Stopping....');
            for (let w of workers) {
                w.close();
            }
            await nc.flush();
            console.log('Bye!');
        }
        process.on('exit', onExit);
        process.on('SIGTERM', onExit);
        process.on('SIGINT', onExit);
    } catch (e) {
        console.warn(e);
        process.exit(-1);
    }
})()