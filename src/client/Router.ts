import { KitchenRouter } from './model/KitchenRouter';
export class Router {
    #router: KitchenRouter

    constructor(router: KitchenRouter) {
        this.#router = router;
    }

    get id() {
        return this.#router.id;
    }

    get appData() {
        return this.#router.appData;
    }

    get alive() {
        return this.#router.alive;
    }

    async close() {
        return this.#router.close();
    }
}