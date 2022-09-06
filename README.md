# Node.js inspector
Inspector for Node.js process & worker_threads

# 1. Inspector
Inspector is a wrapper for Node.js inspector module, but with promiseify API.

## 1.1 takeHeapSnapshot
```
const { Inspector } = require('nodejs-inspector');
const inspector = new Inspector();
inspector.start();
inspector.on('HeapProfiler.addHeapSnapshotChunk', (m) => {
    //
});
await inspector.post('HeapProfiler.takeHeapSnapshot');
inspector.stop();
```

## 1.2 CPU Profile
```
const { Inspector, util } = require('nodejs-inspector');
const inspector = new Inspector();
inspector.start();
await inspector.post('Profiler.enable');
await inspector.post('Profiler.setSamplingInterval', { interval: 1000 });
await inspector.post('Profiler.start');
await util.sleep(1000);
const { profile } = await inspector.post('Profiler.stop');
await inspector.post('Profiler.disable');
inspector.stop();
```

# 2. Thread Inspector
Thread Inspector is a Inspector communicate with the `worker_thread`.

## 2.1 takeHeapSnapshot
```
const { Worker } = require('worker_threads');
const { ThreadInspector } = require('nodejs-inspector');
const worker = new Worker('setInterval(() => {}, 10000)', { eval: true });
const inspector = new ThreadInspector();
inspector.on('attachedToWorker', async (sessionContext) => {
    const { sessionId } = sessionContext.getWorkerInfo();
    sessionContext.on('HeapProfiler.addHeapSnapshotChunk', (m) => {
        // 
    });
    await inspector.post(sessionId, { method: 'HeapProfiler.takeHeapSnapshot' });
    await inspector.stop();
    worker.terminate();
});
inspector.start();
```

## 2.2 CPU Profile
```
const { Worker } = require('worker_threads');
const { ThreadInspector, util } = require('nodejs-inspector');
const worker = new Worker('setInterval(() => {}, 10000)', { eval: true });
const inspector = new ThreadInspector();
inspector.on('attachedToWorker', async (sessionContext) => {
    const { sessionId } = sessionContext.getWorkerInfo();
    await inspector.post(sessionId, { method: 'Profiler.enable' });
    await inspector.post(sessionId, { 
        method: 'Profiler.setSamplingInterval', 
        params: { interval: 1000 }
    });
    await inspector.post(sessionId, { method: 'Profiler.start' });
    await util.sleep(1000);
    const { profile } = await inspector.post(sessionId, { method: 'Profiler.stop' });
    await inspector.post(sessionId, { method: 'Profiler.disable' });
    await inspector.stop();
    worker.terminate();
});
inspector.start();
```

# 3. API

## 3.1 Inspector
1. `post(method, params)`
Communicate with Node.js by inspector protocol.
2. `start`
Start the Inspector before using other API.
2. `stop`
Stop the Inspector If it is no longer needed.

## 3.2 ThreadInspector
1. `post(sessionId, message)`
Communicate with Node.js worker_threads by inspector protocol.
2. `start`
Start the Inspector before using other API.
2. `stop`
Stop the Inspector If it is no longer needed.

See more informations in https://chromedevtools.github.io/devtools-protocol/v8/ .