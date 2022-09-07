const { Session } = require('inspector');
const EventEmitter = require('events');
const util = require('./util');

class SessionContext extends EventEmitter {
  _request = {};
  _workerInfo = {};

  constructor({ workerInfo }) {
    super();
    this._workerInfo = workerInfo;
  }

  getWorkerInfo() {
    return this._workerInfo;
  }

  addRequest(id, options) {
    this._request[id] = options;
  }

  removeRequest(id) {
    delete this._request[id];
  }
  
  hasRequest(id) {
    return !!this._request[id];
  }

  getRequest(id) {
    return this._request[id];
  }
}

class Inspector extends Session {
  post(method, params) {
    return new Promise((resolve, reject) => {
      super.post(method, params, (err, data) => {
        if (err) {
          reject(err);
        } else if (method === 'Runtime.evaluate' && data.result && data.result.subtype === 'error') {
          const error = new Error(data.result.description || JSON.stringify(data));
          error.code = data.result.className;
          reject(error);
        } else {
          resolve(data);
        }
      });
    })
  }
  start() {
    this.connect();
  }
  stop() {
    this.disconnect();
  }
}

class ThreadInspector extends Inspector {
  _id = 1;
  _sessions = {};

  constructor() {
    super();
    this.onAttachedToWorker = (data) => {
      const sessionContext = new SessionContext({
        workerInfo: {
          ...data.params.workerInfo,
          sessionId: data.params.sessionId,
        }
      });
      this._sessions[data.params.sessionId] = sessionContext;
      this.emit('attachedToWorker', sessionContext);
    };

    this.receivedMessageFromWorker = ({ params: { sessionId, message } }) => {
      const sessionContext = this._sessions[sessionId];
      if (!sessionContext) {
        return;
      }
      const data = JSON.parse(message);
      const { id, method, result, error } = data;
      if (id) {
        if (!sessionContext.hasRequest(id)) {
          return;
        }
        const request = sessionContext.getRequest(id);
        if (result && result.result && result.result.subtype === 'error') {
          const error = new Error(result.result.description || JSON.stringify(result));
          error.code = result.result.className;
          request.reject(error);
        } else if (error) {
          const err = new Error(error.message);
          err.code = error.code;
          request.reject(err);
        } else {
          request.resolve(result);
        }
        sessionContext.removeRequest(id);
      } else {
        sessionContext.emit(method, data);
      }
    };

    this.onDetachedFromWorker = (data) => {
      this.emit('detachedFromWorker', data.params.sessionId);
      delete this._sessions[data.params.sessionId];
    }
  }
 
  _addListener() {
    this.on('NodeWorker.attachedToWorker', this.onAttachedToWorker);
    this.on('NodeWorker.detachedFromWorker', this.onDetachedFromWorker);
    this.on('NodeWorker.receivedMessageFromWorker', this.receivedMessageFromWorker);
  }

  _removeListener() {
    this.off('NodeWorker.attachedToWorker', this.onAttachedToWorker);
    this.off('NodeWorker.detachedFromWorker', this.onDetachedFromWorker);
    this.off('NodeWorker.receivedMessageFromWorker', this.receivedMessageFromWorker);
  }

  getSessions() {
    return this._sessions;
  }

  postToWorker(sessionId, message) {
    if (!this._sessions[sessionId]) {
        return Promise.reject(new Error('sessionId invalid'));
    }
    return new Promise(async (resolve, reject) => {
      const requestId = this._id++;
      this._sessions[sessionId].addRequest(requestId, { resolve, reject });
      try {
        await this.post('NodeWorker.sendMessageToWorker', {
          sessionId,
          message: JSON.stringify({
            id: requestId,
            ...message,
          }),
        });
      } catch(err) {
        if (this._sessions[sessionId]) {
          const request = this._sessions[sessionId].getRequest(requestId);;
          request.reject(err);
          this._sessions[sessionId].removeRequest(requestId);
        }
      }
    })
  }

  async start() {
    this._addListener();
    this.connect();
    try {
      await this.post("NodeWorker.enable", { waitForDebuggerOnStart: false });
    } catch(err) {
      // Error(ERR_INSPECTOR_CLOSED) maybe be trigger if NodeWorker.disable is called
      // before NodeWorker.enable callback is called.
      // Can be called more than once
      this._removeListener();
      this.disconnect();
      throw err;
    }
  }

  async stop() {
    try {
      await this.post("NodeWorker.disable");
    } catch(err) {
      throw err;
    } finally {
      this._removeListener();
      this.disconnect();
    }
  }
}

module.exports = {
  Inspector,
  ThreadInspector,
  util,
};