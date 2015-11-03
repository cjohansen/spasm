function first(pred, coll) {
  for (let i = 0, l = coll.length; i < l; ++i) {
    const res = pred(coll[i]);
    if (res) {
      return res;
    }
  }
}

function find(pred, coll) {
  for (let i = 0, l = coll.length; i < l; ++i) {
    if (pred(coll[i])) {
      return coll[i];
    }
  }
}

function qualifyURL(path, {host, port, scheme}) {
  if (!host) {
    return path;
  }
  if (port) {
    host = host.replace(/(:.*)?$/, `:${port}`);
  }
  return `${scheme || 'http'}://${host.replace(/\/$/, '')}${path}`;
}

function formatURL(route, params = {}) {
  if (!route) { return null; }
  return qualifyURL(route.paramNames.reduce((url, param) => {
    return url.replace(':' + param, params[param]);
  }, route.route), params);
}

export function getURL(routes, page, params) {
  return formatURL(find(r => r.page === page, routes), params);
}

function val(v) {
  if (!v) {
    return true;
  }
  return /^-?\d+(\.\d+)?$/.test(v.trim()) ? parseFloat(v) : v;
}

function mapify(pairs = []) {
  return pairs.reduce((m, [k, v]) => {
    m[k] = v;
    return m;
  }, {});
}

export function toURLString({query, path}) {
  const queryString = Object.keys(query).map(k => {
    if (query[k] === null || query[k] === undefined) {
      return null;
    }
    if (query[k] === true) {
      return k;
    }
    return `${k}=${query[k]}`;
  }).filter(p => p).join('&');
  return path + (queryString ? '?' + queryString : '');
}

const URL_RE = /(?:(?:(https?):)?\/\/([^:\/]+)(?::(\d+))?)?([^\?]*)(?:\?(.*))?/;

export function match({regexp, page, paramNames}, url) {
  const [, scheme, host, port, path, query] = url.match(URL_RE);
  const vals = path.match(regexp);
  if (!vals) { return null; }

  return {
    page,
    url,
    path,
    host,
    port: Number(port || 80),
    scheme: scheme || 'http',
    params: mapify(vals.slice(1).map((v, idx) => [paramNames[idx], v])),
    query: mapify(query && query.split('&').map(kv => kv.split('=')) || [])
  };
}

export function getPage(routes, url) {
  return first(route => match(route, url), routes) || {params: {}};
}

export function createRoute(page, route) {
  const paramNames = (route.match(/:[a-zA-Z0-9]+/g) || []).map(n => n.slice(1));
  return {
    page,
    paramNames,
    route,
    regexp: new RegExp(paramNames.reduce((page, param) => {
      return page.replace(':' + param, '([^/?]+)');
    }, route) + '$')
  };
}

export function createRoutes(routes) {
  return routes.map(([page, route]) => createRoute(page, route));
}
