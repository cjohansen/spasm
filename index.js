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
    const link = getLink(e.target) || {};

    if (!link.href || e.which !== 1 || e.ctrlKey || e.metaKey) {
      return;
    }

    const {host, port, page} = app.getLocation(link.href);
    const hostport = `${host}${port && port !== 80 ? `:${port}` : ''}`;

    if (page && (!host || hostport === window.location.host)) {
      e.preventDefault();
      link.dataset.replace ? app.replaceURL(link.href) : app.gotoURL(link.href);
    } else {
      handleExternalLinks(e, link);
    }
  };
}
