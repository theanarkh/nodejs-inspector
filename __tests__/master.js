require('jest');

const { Inspector, util } = require('..');

describe('test master inspector', () => {

  test('cpuprofile', async () => {
    const inspector = new Inspector();
    inspector.start();
    await inspector.post('Profiler.enable');
    await inspector.post('Profiler.setSamplingInterval', { interval: 1000 });
    await inspector.post('Profiler.start');
    await util.sleep(1000);
    const { profile } = await inspector.post('Profiler.stop');
    await inspector.post('Profiler.disable');
    expect(!!profile).toBe(true);
    inspector.stop();
  });

  test('heapsnapshot', async () => {
    const inspector = new Inspector();
    inspector.start();
    let count = 0;
    inspector.on('HeapProfiler.addHeapSnapshotChunk', (m) => {
      count++;
    });
    await inspector.post('HeapProfiler.takeHeapSnapshot');
    expect(count > 0).toBe(true);
    inspector.stop();
  });
  
});
