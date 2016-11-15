import {createRoute, getLocation, getURL, toURLString} from './router';
import {EventEmitter} from 'events';
import {createAtom} from 'js-atom';

const identity = v => v;

const deref = data => ({
  pageData: data.pageData,
  location: data.location,
  state: data.state.deref()
});

export function createApp({render, state, finalizeData, logger, prefix}) {
  const events = new EventEmitter();
  const routes = [];
  const bus = new EventEmitter();
  const pages = {};
  prefix = prefix || '';
  let currentData = {state: createAtom(state || {})}, currentPage;
  let pageViewId = 0;

  const log = typeof logger === 'undefined' ? identity : function (...args) {
    return logger.log(...args);
  };

  function getData(page, currentData, callback) {
    const dereffed = deref(currentData);
    log('getData', dereffed);
    const res = page.getData && page.getData(dereffed);
    const id = ++pageViewId;

    if (res && res.then) {
      return res.then(callback);
    } else if (Array.isArray(res) && res[0] && res[0].then) {
      const pageData = {isPartial: true};
      let results = 0;
      callback(pageData);
      return Promise.all(res.map(r => r.then(data => {
        if (pageViewId !== id) {
          return;
        }

        results += 1;
        if (results === res.length) {
          delete pageData.isPartial;
        }
        Object.keys(data).forEach(k => pageData[k] = data[k]);
        return callback(pageData);
      }))).then(res => {
        events.emit('dataLoaded', pageData);
        return res;
      });
    } else {
      return callback(res);
    }
  }

  function prep(page, data) {
    if (page.prepareData) {
      log('prepareData', data);
      return page.prepareData(data);
    }

    log('No prepareData, using raw page data', data.pageData);
    return data.pageData;
  }

  function finalize(data, location, state) {
    if (finalizeData) {
      log('finalizeData', data, location, state);
      return finalizeData(data, location, state);
    }

    return data || {};
  }

  function renderApp() {
    const data = finalize(
      prep(currentPage, deref(currentData)),
      currentData.location,
      currentData.state.deref()
    );
    if (data.title) {
      log('set page title', data.title);
      document.title = data.title;
    }
    log('render', data);
    render(currentPage.render, data);
    return data;
  }

  function swapState(state) {
    currentData.state.swap(currentState => Object.keys(state).reduce((res, k) => {
      if (state[k] === null) {
        delete res[k];
      } else {
        res[k] = state[k];
      }
      return res;
    }, currentState));
  }

  function seedState(page) {
    if (!page.seedState) {
      return;
    }

    swapState(page.seedState(deref(currentData)) || {});
  }

  function renderPage(page) {
    return getData(page, currentData, pageData => {
      currentData.pageData = pageData;
      currentPage = page;
      seedState(page);
      return Promise.resolve(renderApp());
    });
  }

  function updateState(state) {
    if (typeof state === 'function') {
      state = state(currentData.state.deref());
    }

    swapState(state);
    events.emit('updateState', currentData.state.deref());
  }

  function qualify(url) {
    const pf = `${window.location.protocol}//${window.location.host}`;
    return url.indexOf(pf) < 0 ? `${pf}${url.replace(/^\/?/, '/')}` : url;
  }

  function loadURL(url, state = {}) {
    updateState(state);
    const res = getLocation(routes, qualify(url));
    log('loadURL', url, res.page, res.params, res.query);
    currentData.location = res;
    return renderPage(pages[res.page] || pages[404]);
  }

  function triggerAction(action, ...callTimeArgs) {
    if (!action) {
      return;
    }

    const [actionName, ...actionArgs] = action;
    const args = actionArgs.concat(callTimeArgs);
    const listeners = bus.listeners(actionName);
    if (listeners.length === 0) {
      throw new Error(`Tried to trigger action ${actionName} (${args}), which has no handlers`);
    }
    return Promise.all(listeners.map(listener => listener(...args)));
  }

  function refresh(state = {}) {
    updateState(state);
    return renderPage(currentPage);
  }

  function getCurrentURL() {
    return toURLString(currentData.location);
  }

  function rerender() {
    if (currentPage) {
      return renderApp();
    } else {
      return Promise.resolve();
    }
  }

  function updateStateAndRender(state) {
    updateState(state);
    return rerender();
  }

  function updateQueryParams(params) {
    if (!currentPage) {
      throw new Error('Cannot update query params before a page is loaded');
    }
    currentData.location.query = params;
    history.pushState({}, '', getCurrentURL());
    return refresh();
  }

  function gotoURL(url, state, historyMethod) {
    const currentPage = currentData.location && pages[currentData.location.page];

    if (currentPage && currentPage.canUnload) {
      if (currentPage.canUnload(deref(currentData)) === false) {
        return rerender();
      }
    }

    if (currentPage && currentPage.onUnload) {
      updateState(currentPage.onUnload(deref(currentData)) || {});
    }

    history[historyMethod]({}, '', url.replace(new RegExp(`^(${prefix})?`), prefix));
    return loadURL(url, state);
  }

  const flashSchedule = {};

  return {
    loadURL,
    triggerAction,
    refresh,
    getCurrentURL,
    rerender,

    on: events.on.bind(events),
    once: events.once.bind(events),
    off: events.removeListener.bind(events),

    getURL(...args) {
      return getURL(routes, ...args);
    },

    addAction(event, handler) {
      bus.on(event, (...data) => handler(deref(currentData), ...data));
    },

    performAction(action) {
      if (!action) {
        return null;
      }

      return function (e) {
        if (e && e.preventDefault) {
          e.preventDefault();
        }
        triggerAction(action, e && e.nativeEvent || e);
      };
    },

    addPage(name, route, page) {
      routes.push(createRoute(name, route, {prefix}));
      pages[name] = page;
    },

    start() {
      window.onpopstate = function () {
        loadURL(location.href);
      };

      return loadURL(location.href);
    },

    gotoURL(url, state = {}) {
      return gotoURL(url, state, 'pushState');
    },

    replaceURL(url, state = {}) {
      return gotoURL(url, state, 'replaceState');
    },

    updateQueryParams(params, state = {}) {
      updateState(state);
      return updateQueryParams(Object.keys(params).reduce((newParams, key) => {
        newParams[key] = params[key];
        return newParams;
      }, currentData.location.query));
    },

    clearQueryParams() {
      return updateQueryParams({});
    },

    updateState: updateStateAndRender,

    flashState(state, ttl = 5000) {
      updateState(state);
      const t = new Date().getTime() + ttl;
      Object.keys(state).forEach(k => flashSchedule[k] = t);

      setTimeout(function () {
        const now = new Date().getTime();
        updateStateAndRender(Object.keys(flashSchedule).reduce((state, key) => {
          if (flashSchedule[key] <= now) {
            state[key] = null;
            delete flashSchedule[key];
          }
          return state;
        }, {}));
      }, ttl);
    },

    getState() {
      return currentData.state.deref();
    },

    getLocation(url) {
      return url ? getLocation(routes, qualify(url)) : currentData.location;
    },

    getData() {
      return deref(currentData);
    }
  };
}
