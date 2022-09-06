require('jest');

const { Worker } = require('worker_threads');
const { ThreadInspector, util } = require('../');

describe('test worker inspector', () => {
  test('cpuprofile', () => {
    return new Promise((resolve) => {
      const worker = new Worker('setInterval(() => {}, 10000)', { eval: true });
      const inspector = new ThreadInspector();
      inspector.on('attachedToWorker', async (sessionContext) => {
        const { sessionId } = sessionContext.getWorkerInfo();
          await inspector.postToWorker(sessionId, { method: 'Profiler.enable' });
          await inspector.postToWorker(sessionId, { method: 'Profiler.setSamplingInterval', params: { interval: 1000 } });
          await inspector.postToWorker(sessionId, { method: 'Profiler.start' });
          await util.sleep(1000);
          const { profile } = await inspector.postToWorker(sessionId, { method: 'Profiler.stop' });
          await inspector.postToWorker(sessionId, { method: 'Profiler.disable' });
          await inspector.stop();
          worker.terminate();
          expect(!!profile).toBe(true);
          resolve();
      });
      inspector.start();
    })
  });

  test('heapsnapshot', () => {
    return new Promise((resolve) => {
      const worker = new Worker('setInterval(() => {}, 10000)', { eval: true });
      const inspector = new ThreadInspector();
      inspector.on('attachedToWorker', async (sessionContext) => {
        const { sessionId } = sessionContext.getWorkerInfo();
        let count = 0;
        sessionContext.on('HeapProfiler.addHeapSnapshotChunk', (m) => {
          count++;
        });
        await inspector.postToWorker(sessionId, { method: 'HeapProfiler.takeHeapSnapshot' });
        await inspector.stop();
        worker.terminate();
        expect(count > 0).toBe(true);
        resolve();
      });
      inspector.start();
    });
  });

  test('master heapsnapshot', async () => {
    const inspector = new ThreadInspector();
    await inspector.start();
    let count = 0;
    inspector.on('HeapProfiler.addHeapSnapshotChunk', (m) => {
      count++;
    });
    await inspector.post('HeapProfiler.takeHeapSnapshot');
    expect(count > 0).toBe(true);
    inspector.stop();
  });

  test('getSessions', async () => {
    const worker = new Worker('setInterval(() => {}, 10000)', { eval: true });
    const inspector = new ThreadInspector();
    const promise = new Promise((resolve) => {
      inspector.on('attachedToWorker', () => {
        expect(Object.keys(inspector.getSessions()).length > 0).toBe(true);
        worker.terminate();
        resolve();
      });
    });
    
    await Promise.all([inspector.start(), promise]);
    await inspector.stop();
  });


  test('invalid method', async () => {
    const worker = new Worker('setInterval(() => {}, 10000)', { eval: true });
    const inspector = new ThreadInspector();
    const promise = new Promise((resolve) => {
      inspector.on('attachedToWorker', async (sessionContext) => {
        const promise = inspector.postToWorker(sessionContext.getWorkerInfo().sessionId);
        expect(promise).rejects.toThrow(
          "Message must have string 'method' property",
        );
        worker.terminate();
        resolve();
      });
    });
    
    await Promise.all([inspector.start(), promise]);
    await inspector.stop();
    
  });

});
