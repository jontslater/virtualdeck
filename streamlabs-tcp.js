/**
 * Streamlabs Desktop local JSON-RPC over TCP (127.0.0.1:28194 by default).
 * Local connections are auto-authorized — no Remote Control token required.
 * @see https://github.com/streamlabs/desktop/blob/master/docs/README.md
 */

const net = require('net');

let _rpcId = 1;

function nextRpcId() {
  _rpcId += 1;
  if (_rpcId > 1e9) _rpcId = 1;
  return _rpcId;
}

/**
 * @param {object} opts
 * @param {string} [opts.host]
 * @param {number} [opts.port]
 * @param {string} opts.method
 * @param {string} opts.resource
 * @param {unknown[]} [opts.args]
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<unknown>}
 */
function streamlabsTcpRequest(opts) {
  const host = opts.host || '127.0.0.1';
  const port = opts.port || 28194;
  const method = opts.method;
  const resource = opts.resource;
  const args = opts.args || [];
  const timeoutMs = opts.timeoutMs || 12000;
  const reqId = nextRpcId();
  const line =
    JSON.stringify({
      jsonrpc: '2.0',
      id: reqId,
      method,
      params: { resource, args },
    }) + '\n';

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.write(line, 'utf8');
    });

    let buf = '';
    let promiseSubId = null;
    const timer = setTimeout(() => {
      try {
        socket.destroy();
      } catch (_) {
        /* ignore */
      }
      reject(new Error(`Streamlabs TCP timeout (${timeoutMs}ms)`));
    }, timeoutMs);

    const finishOk = (value) => {
      clearTimeout(timer);
      try {
        socket.end();
      } catch (_) {
        /* ignore */
      }
      resolve(value);
    };

    const finishErr = (err) => {
      clearTimeout(timer);
      try {
        socket.destroy();
      } catch (_) {
        /* ignore */
      }
      reject(err);
    };

    socket.on('error', (err) => finishErr(err));

    socket.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const raw = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!raw) continue;
        let msg;
        try {
          msg = JSON.parse(raw);
        } catch {
          continue;
        }

        if (msg.id === reqId) {
          if (msg.error) {
            const m = msg.error.message || JSON.stringify(msg.error);
            finishErr(new Error(m));
            return;
          }
          const r = msg.result;
          if (r && r._type === 'SUBSCRIPTION' && r.emitter === 'PROMISE' && r.resourceId) {
            promiseSubId = r.resourceId;
            continue;
          }
          finishOk(r);
          return;
        }

        if (
          promiseSubId &&
          msg.result &&
          msg.result._type === 'EVENT' &&
          msg.result.emitter === 'PROMISE' &&
          msg.result.resourceId === promiseSubId
        ) {
          if (msg.result.isRejected) {
            finishErr(new Error('Streamlabs async call rejected'));
            return;
          }
          finishOk(msg.result.data);
          return;
        }
      }
    });
  });
}

const STOPPABLE = new Set(['live', 'starting', 'reconnecting', 'ending']);

/**
 * If Streamlabs is streaming (or stopping mid-flight), request toggleStreaming to end.
 * @param {{ host?: string, port?: number }} [conn]
 * @returns {Promise<{ ok: boolean, reason?: string, detail?: string }>}
 */
async function stopStreamlabsStreamingIfLive(conn = {}) {
  const host = conn.host || process.env.VD_STREAMLABS_TCP_HOST || '127.0.0.1';
  const port = conn.port || parseInt(process.env.VD_STREAMLABS_TCP_PORT || '28194', 10);

  const model = await streamlabsTcpRequest({
    host,
    port,
    method: 'getModel',
    resource: 'StreamingService',
    args: [],
    timeoutMs: 8000,
  });

  const status =
    model && typeof model === 'object' && model.streamingStatus != null
      ? String(model.streamingStatus).toLowerCase()
      : '';

  if (!STOPPABLE.has(status)) {
    return { ok: false, reason: 'not_streaming', detail: status || 'unknown' };
  }

  await streamlabsTcpRequest({
    host,
    port,
    method: 'toggleStreaming',
    resource: 'StreamingService',
    args: [],
    timeoutMs: 45000,
  });

  return { ok: true, detail: status };
}

module.exports = {
  streamlabsTcpRequest,
  stopStreamlabsStreamingIfLive,
};
