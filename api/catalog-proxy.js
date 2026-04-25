const ALLOWED_HOST = 'bibliothekskatalog.leipzig.de';
const ALLOWED_PATH_PATTERN = /^\/webOPACClient\/(?:start|search|hitList|singleHit)\.do$/;
const ALLOWED_METHODS = new Set(['GET', 'HEAD']);

const sendError = (res, statusCode, message) => {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify({ error: message }));
};

const parseTargetUrl = (rawUrl) => {
  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    return null;
  }

  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
};

const isAllowedTarget = (url) =>
  url.protocol === 'https:' &&
  url.hostname.toLowerCase() === ALLOWED_HOST &&
  ALLOWED_PATH_PATTERN.test(url.pathname);

const copyResponseHeader = (source, target, headerName) => {
  const value = source.headers.get(headerName);
  if (value) {
    target.setHeader(headerName, value);
  }
};

module.exports = async function catalogProxy(req, res) {
  const method = String(req.method ?? 'GET').toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    res.setHeader('allow', 'GET, HEAD');
    sendError(res, 405, 'Method not allowed');
    return;
  }

  const targetUrl = parseTargetUrl(req.query?.url);
  if (!targetUrl || !isAllowedTarget(targetUrl)) {
    sendError(res, 400, 'Target URL is not allowed');
    return;
  }

  try {
    const headers = {
      accept: req.headers.accept ?? 'text/html,application/xhtml+xml',
      'user-agent': req.headers['user-agent'] ?? 'openlib-catalog-proxy',
    };
    const proxyCookie = req.headers['x-openlib-proxy-cookie'];
    if (typeof proxyCookie === 'string' && proxyCookie.trim() !== '') {
      headers.cookie = proxyCookie;
    }

    const upstream = await fetch(targetUrl.toString(), {
      method,
      headers,
      redirect: 'manual',
    });

    res.statusCode = upstream.status;
    res.setHeader('cache-control', 'no-store');
    copyResponseHeader(upstream, res, 'content-type');
    copyResponseHeader(upstream, res, 'location');

    const setCookie = upstream.headers.get('set-cookie');
    if (setCookie) {
      res.setHeader('x-openlib-proxy-set-cookie', setCookie);
    }

    if (method === 'HEAD') {
      res.end();
      return;
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    res.end(body);
  } catch {
    sendError(res, 502, 'Catalog proxy request failed');
  }
};
