class RenderQueue {
    constructor() {
        this.queue = [];
    }

    add(fn) {
        if (typeof fn !== 'function') throw new Error('you can only add function to render queue.')
        this.queue.push(fn);
        return this;
    }
}