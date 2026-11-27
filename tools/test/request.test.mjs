// Run with: node --test "tools/test/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';

import request, { requestBytes } from '../../src/api/request.js';

function stubFetch(t, impl) {
  const realFetch = globalThis.fetch;

  globalThis.fetch = impl;
  t.after(() => {
    globalThis.fetch = realFetch;
  });
}

test('a request that gets no answer fails after 10 seconds', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  stubFetch(t, () => new Promise(() => {}));

  let outcome = 'pending';
  const pending = request('http://example.invalid/').then(
    () => {
      outcome = 'resolved';
    },
    (error) => {
      outcome = error;
    }
  );

  t.mock.timers.tick(9999);
  await Promise.resolve();
  assert.equal(outcome, 'pending');

  t.mock.timers.tick(1);
  await pending;
  assert.ok(outcome instanceof Error);
  assert.match(outcome.message, /超时/);
});

test('an answered request hands back the response', async (t) => {
  const response = { status: 200 };

  stubFetch(t, async (url, init) => {
    assert.equal(url, 'http://example.invalid/a');
    assert.deepEqual(init, { method: 'POST' });

    return response;
  });

  assert.equal(
    await request('http://example.invalid/a', { method: 'POST' }),
    response
  );
});

test('a network failure reaches the caller', async (t) => {
  stubFetch(t, async () => {
    throw new TypeError('Network request failed');
  });

  await assert.rejects(request('http://example.invalid/'), {
    name: 'TypeError',
    message: 'Network request failed',
  });
});

test('in the app the bytes of an answer are asked for as bytes', async (t) => {
  const sent = [];

  class FakeXhr {
    constructor() {
      this.headers = {};
    }

    open(method, url) {
      this.method = method;
      this.url = url;
    }

    setRequestHeader(name, value) {
      this.headers[name] = value;
    }

    send() {
      sent.push(this);
      this.response = Uint8Array.from([0x61, 0xe5, 0xbe]).buffer;
      this.onload();
    }
  }

  globalThis.XMLHttpRequest = FakeXhr;
  t.after(() => {
    delete globalThis.XMLHttpRequest;
  });

  const bytes = await requestBytes('http://example.invalid/', { Referer: 'r' });

  assert.deepEqual([...bytes], [0x61, 0xe5, 0xbe]);
  assert.equal(sent[0].method, 'GET');
  assert.equal(sent[0].responseType, 'arraybuffer');
  assert.equal(sent[0].timeout, 10000);
  assert.deepEqual(sent[0].headers, { Referer: 'r' });
});
