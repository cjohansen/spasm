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

function qualifyURL(path, {host, port, scheme, prefix}) {
  if (!host) {
    return path;
  }
  if (port) {
    host = host.replace(/(:.*)?$/, `:${port}`);
  }
  return `${scheme || 'http'}://${host.replace(/\/$/, '')}${prefix || ''}${path}`;
}

function formatURL(route, params = {}, query = {}) {
  if (!route) { return null; }
  return toURLString({
    path: qualifyURL(route.paramNames.reduce((url, param) => {
      return url.replace(':' + param, params[param]);
    }, route.route), params),
    query
  });
}

export function getURL(routes, page, params, query) {
  return formatURL(find(r => r.page === page, routes), params, query);
}

function val(v) {
  if (!v) {
    return true;
  }
  return /^-?\d+(\.\d+)?$/.test(v.trim()) ? parseFloat(v) : v;
}

function paramValue(v) {
  if (/^-?\d+$/.test(v)) {
    return parseInt(v, 10);
  }
  if (/^-?\d+\.\d+$/.test(v)) {
    return parseFloat(v);
  }
  return v;
}

function paramify(pairs = []) {
  return pairs.reduce((m, [k, v]) => {
    const val = paramValue(decodeURIComponent(v));

    if (m[k]) {
      if (!Array.isArray(m[k])) {
        m[k] = [m[k]];
      }
      m[k].push(val);
    } else {
      m[k] = val;
    }

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
    return (Array.isArray(query[k]) ? query[k] : [query[k]]).map(v => {
      return `${k}=${v}`;
    }).join('&');
  }).filter(p => p).join('&');
  return path + (queryString ? '?' + queryString : '');
}

const URL_RE = /(?:(?:(https?):)?\/\/([^:\/]+)(?::(\d+))?)?([^\?]*)(?:\?(.*))?/;

function stripPrefix(path, prefix) {
  if (prefix) {
    return path.replace(new RegExp(`^${prefix}`), '');
  } else {
    return path;
  }
}

export function match({regexp, page, paramNames, prefix}, url) {
  const [, scheme, host, port, path, query] = url.match(URL_RE);
  const vals = stripPrefix(path, prefix).match(regexp);
  if (!vals) { return null; }

  return {
    page,
    url,
    path,
    host,
    prefix: prefix || '',
    port: Number(port || 80),
    scheme: scheme || 'http',
    params: paramify(vals.slice(1).map((v, idx) => [paramNames[idx], v])),
    query: paramify(query && query.split('&').map(kv => kv.split('=')) || [])
  };
}

export function getPage(routes, url) {
  return first(route => match(route, url), routes) || {params: {}};
}

export function createRoute(page, route, options = {}) {
  const paramNames = (route.match(/:[a-zA-Z0-9]+/g) || []).map(n => n.slice(1));
  return {
    page,
    paramNames,
    route,
    prefix: options.prefix,
    regexp: new RegExp('^' + paramNames.reduce((page, param) => {
      return page.replace(':' + param, '([^/?]+)');
    }, route) + '$')
  };
}

export function createRoutes(routes, options) {
  return routes.map(([page, route]) => createRoute(page, route, options || {}));
}
