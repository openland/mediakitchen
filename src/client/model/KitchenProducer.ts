import { KitchenApi } from './KitchenApi';
import { SimpleMap } from "../../wire/common";

export class KitchenProducer {
    id: string;
    appData: SimpleMap;
    api: KitchenApi;
    paused: boolean;

    constructor(
        id: string,
        appData: SimpleMap,
        paused: boolean,
        api: KitchenApi
    ) {
        this.id = id;
        this.appData = appData;
        this.api = api;
        this.paused = paused;
    }

    async close() {
        await this.api.closeProducer(this.id);
    }
}