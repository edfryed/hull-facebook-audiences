import _ from "lodash";
import Promise from "bluebird";

const HANDLERS = {};

export default class BatchSyncHandler {

  static exit() {
    if (!BatchSyncHandler.exiting) {
      const exiting = Promise.all(_.map(HANDLERS, (h) => h.flush()));
      BatchSyncHandler.exiting = exiting;
      return exiting;
    }
    return Promise.resolve([]);
  }

  static getHandler(args) {
    const key = this.ns + args.ship.id;
    return HANDLERS[key] = HANDLERS[key] || new BatchSyncHandler(args); // eslint-disable-line no-return-assign
  }

  constructor({ ns = "", ship = {}, hull, options = {} }) {
    this.ns = ns;
    this.ship = ship;
    this.hull = hull;
    this.messages = [];
    this.options = options;
    this.callback = options.callback;

    this.flushLater = _.throttle(this.flush.bind(this), this.options.throttle);
    return this;
  }

  setCallback(callback) {
    this.callback = callback;
    return this;
  }

  log(msg, data = {}) {
    console.warn(msg, { ship: this.ship.id }, JSON.stringify(data));
  }

  add(message) {
    this.messages.push(message);
    this.log("batchSyncHandler.added", { messages: this.messages.length });
    const { maxSize } = this.options;
    if (this.messages.length >= maxSize) {
      this.flush();
    } else {
      this.flushLater();
    }
    return Promise.resolve();
  }

  flush() {
    const messages = this.messages;
    this.log("batchSyncHandler.flush", { messages: messages.length });
    this.messages = [];
    return this.callback(messages, this)
      .then(() => {
        this.log("batchSyncHandler.flush.sucess");
      }, (err = {}) => {
        this.log("batchSyncHandler.flush.error", { message: err.message });
      });
  }
}
