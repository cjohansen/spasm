/*global React*/
import {createRoutes, getPage, getURL, toURLString} from './router';
import {EventEmitter} from 'events';
import notFound from './not-found';

function getData(page, currentData) {
  const res = page.getData && page.getData(currentData);
  if (res && res.then) {
    return res;
  } else {
    return new Promise((resolve, reject) => resolve(res));
  }
}

function prep(page, data, options) {
  return page.prepareData ? page.prepareData(data, options) : data;
}

export function createApp(el, {routes, state, finalizeData}) {
  routes = createRoutes(routes);
  const getRouterURL = getURL(routes);
  const bus = new EventEmitter();
  const pages = {};
  let currentData = {state: state || {}}, currentPage;
  finalizeData = finalizeData || (d => d);

  function render() {
    const data = finalizeData(
      prep(currentPage, currentData, {getUrl: getRouterURL}),
      currentData.location,
      currentData.state
    );
    document.title = data.title;
    React.render(currentPage.render(data), el);
  }

  function renderPage(page) {
    getData(page, currentData).
      then(pageData => {
        currentData.pageData = pageData;
        currentPage = page;
        render();
      });
  }

  function loadURL(url) {
    const res = getPage(routes, url);
    currentData.location = res;
    renderPage(pages[res.page] || pages[404] || {render: notFound});
  }

  return {
    loadURL,
    render,

    getCurrentURL() {
      return toURLString(currentData.location);
    },

    addAction(event, handler) {
      bus.on(event, data => handler(data, currentData));
    },

    performAction([action, ...args]) {
      return function (e) {
        e.preventDefault();
        if (bus.listeners(action).length === 0) {
          throw new Error(`Tried to trigger action ${action} (${args}),
                          which has no handlers`);
        }
        bus.emit(action, ...args);
      };
    },

    addPages(newPages) {
      Object.keys(newPages).forEach(name => pages[name] = newPages[name]);
    },

    start() {
      loadURL(location.href);
    },

    refresh() {
      renderPage(currentPage);
    }
  };
}
