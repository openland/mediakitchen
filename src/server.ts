import os from 'os';
import * as changeCase from 'change-case';
import publicIp from 'public-ip';
import { SimpleMap } from './wire/common';
import { ServerWorker } from './server/ServerWorker';
import { connect, Payload } from "ts-nats";
import { createWorker } from "./server/createWorker";
import { backoff } from './utils/backoff';
import { randomKey } from './utils/randomKey';

(async () => {
    try {
        console.log('Starting...');

        // Resolve Workers Count
        const workersCount =
            process.env.MEDIAKITCHEN_WORKERS
                ? parseInt(process.env.MEDIAKITCHEN_WORKERS, 10)
                : os.cpus().length;

        // Resolve IPs
        let listenIp = process.env.MEDIAKITCHEN_LISTEN || '0.0.0.0';
        let announce = process.env.MEDIAKITCHEN_ANNOUNCE || '127.0.0.1';
        if (process.env.MEDIAKITCHEN_DETECT_IP === 'true') {
            console.log('Detecting public ip...');
            let ip = await publicIp.v4();
            console.log('IP detected: ' + ip);
            announce = ip;
        }

        // Resolve Root Topic
        let rootTopic = process.env.MEDIAKITCHEN_TOPIC || 'mediakitchen';

        // Resolve App Data
        const appData: SimpleMap = {};
        const processId = randomKey();
        appData[processId] = processId;

        for (let k of Object.keys(process.env)) {
            if (k.startsWith('MEDIAKITCHEN_')) {
                let subs = k.substring('MEDIAKITCHEN_'.length);
                let converted = changeCase.camelCase(subs);
                appData[converted] = process.env[k]!
            }
        }

        // Connect to NATS
        console.log('Connecting to NATS...');
        const nc = await connect({ payload: Payload.JSON });

        // Spawn Workers
        console.log('Spawing workers....');
        let closing = false;
        let workers: ServerWorker[] = [];
        async function spawnWorker(index: number) {
            let w = await createWorker({
                listenIps: [{ ip: listenIp, announcedIp: announce }],
                connectionInfo: { nc, rootTopic }
            });
            w.onClosed = () => {
                if (closing) {
                    return;
                }
                console.log('Worker ' + w.id + ' closed');
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
            console.log('Worker ' + w.id + ' started');
            workers[index] = w;
        }
        for (let i = 0; i < workersCount; i++) {
            await spawnWorker(i);
        }

        // Started
        console.log('Started');

        // Graceful shutdown
        async function onExit() {
            if (closing) {
                return;
            }
            closing = true;
            console.log('Stopping....');
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