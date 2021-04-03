import debug from 'debug';
import * as mediasoup from 'mediasoup';
import { randomKey } from 'mediakitchen-common';
import { WorkerOptions } from './WorkerOptions';
import { ServerWorker } from './ServerWorker';

export async function createWorker(options: WorkerOptions) {

    // Globaly unique id of a worker
    let id = randomKey();

    let loggerInfo = debug('mediakitchen:' + id);
    loggerInfo.log = console.info.bind(console);
    let loggerError = debug('mediakitchen:' + id + ':ERROR');
    loggerError.log = console.error.bind(console);

    loggerInfo('Starting');

    let settings: mediasoup.types.WorkerSettings = {
        logLevel: 'error',
        rtcMinPort: 10000,
        rtcMaxPort: 59999,
        appData: {},
        ...options.settings
    };

    let rawWorker = await mediasoup.createWorker(settings);

    loggerInfo('Raw Worker started');

    return new ServerWorker(id, rawWorker, options, loggerInfo, loggerError);
}