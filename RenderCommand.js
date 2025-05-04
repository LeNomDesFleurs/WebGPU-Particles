class Command {
    constructor({execute, condition}) {
        if (typeof execute !== 'function') {
            throw new Error('execute must be a function.');
        }

        this.execute = execute;
        this.condition = condition ? condition : () => true;
    }

    execute() { if (this.condition) this.execute(); }

}

export class CommandQueue {
    constructor(device) {
        this.device = device;
        this.queue = [];
    }

    addCommand(obj) {
        this.queue.push(new Command(obj));
        return this;
    }

    run() {
        for (let cmd of this.queue) {
            cmd.execute();
        }
    }
}