export function pLimit(concurrency: number) {
  const queue: (() => Promise<void>)[] = [];
  let activeCount = 0;

  const next = () => {
    activeCount--;
    if (queue.length > 0) {
      queue.shift()!();
    }
  };

  const run = async (fn: () => Promise<any>, resolve: (value: any) => void, reject: (reason?: any) => void) => {
    activeCount++;
    const result = (async () => fn())();
    try {
      const value = await result;
      resolve(value);
    } catch (err) {
      reject(err);
    }
    next();
  };

  const enqueue = (fn: () => Promise<any>, resolve: (value: any) => void, reject: (reason?: any) => void) => {
    queue.push(run.bind(null, fn, resolve, reject));
    (async () => {
      if (activeCount < concurrency && queue.length > 0) {
        queue.shift()!();
      }
    })();
  };

  const generator = (fn: () => Promise<any>): Promise<any> => {
    return new Promise((resolve, reject) => {
      enqueue(fn, resolve, reject);
    });
  };

  return generator;
}
