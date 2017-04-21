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
    const key = args.ship.id;
    return HANDLERS[key] = HANDLERS[key] || new BatchSyncHandler(args); // eslint-disable-line no-return-assign
  }

  constructor({ ship = {}, hull, options = {} }) {
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
    const { maxSize } = this.options;
    if (this.messages.length >= maxSize) {
      this.flush();
    } else {
      this.flushLater();
    }
    return Promise.resolve();
  }

  onError(err) {
    this.log("batchSyncHandler.flush.error", { message: err.message });
  }

  onSuccess() {
    this.log("batchSyncHandler.flush.sucess");
  }


  flush() {
    try {
      const messages = this.messages;
      this.log("batchSyncHandler.flush.start", { messages: messages.length });
      this.messages = [];
      return this.callback(messages, this)
        .catch(this.onError.bind(this))
        .then(this.onSuccess.bind(this));
    } catch (err) {
      this.onError(err);
      return false;
    }
  }
}
