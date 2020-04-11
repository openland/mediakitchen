import debug from 'debug';
import * as mediasoup from 'mediasoup';
import { randomKey } from 'mediakitchen-common';
import { WorkerOptions } from './WorkerOptions';
import { ServerWorker } from './ServerWorker';

export async function createWorker(options: WorkerOptions) {

    // Globaly unique id of a worker
    let id = randomKey();

    let logger = debug('mediakitchen:' + id);

    logger('Starting');

    let settings: mediasoup.types.WorkerSettings = {
        logLevel: 'error',
        rtcMinPort: 10000,
        rtcMaxPort: 59999,
        appData: {},
        ...options.settings
    };

    let rawWorker = await mediasoup.createWorker(settings);

    logger('Raw Worker started');

    return new ServerWorker(id, rawWorker, options, logger);
}