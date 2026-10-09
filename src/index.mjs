import { dispatchApi } from "./api.mjs";

export class ApiCoordinator {
    constructor(ctx, env) {
        this.env = env;
        this.tail = Promise.resolve();
    }

    fetch(request) {
        const run = () => dispatchApi(request, this.env);
        const response = this.tail.then(run, run);
        this.tail = response.then(() => undefined, () => undefined);
        return response;
    }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
            const id = env.API.idFromName("nandoapp-api");
            return env.API.get(id).fetch(request);
        }
        return env.ASSETS.fetch(request);
    }
};
