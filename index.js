// Babel chokes on `export * from './src/router';`
export {getURL, toURLString, parseQueryString, match,
        getLocation, parseRoute, createRoute, createRoutes, formatURL} from './src/router';
export {createApp} from './src/spasm';

function getLink(el) {
  if (!el) {
    return null;
  }

  if (el.tagName === 'A') {
    return el;
  }

  return getLink(el.parentNode);
}

const identity = v => v;

export function monitorLinks(app, handleExternalLinks = identity) {
  return e => {
    const href = (getLink(e.target) || {}).href;

    if (!href || e.which !== 1 || e.ctrlKey || e.metaKey) {
      return;
    }

    const {host, port, page} = app.getLocation(href);
    const hostport = `${host}${port && port !== 80 ? `:${port}` : ''}`;

    if (page && (!host || hostport === window.location.host)) {
      e.preventDefault();
      app.gotoURL(href);
    } else {
      handleExternalLinks(e);
    }
  };
}
