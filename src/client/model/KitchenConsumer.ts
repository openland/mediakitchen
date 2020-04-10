import { KitchenApi } from './KitchenApi';
import { SimpleMap } from "../../wire/common";

export class KitchenConsumer {
    id: string;
    appData: SimpleMap;
    api: KitchenApi;

    constructor(
        id: string,
        appData: SimpleMap,
        api: KitchenApi
    ) {
        this.id = id;
        this.appData = appData;
        this.api = api;
    }
}