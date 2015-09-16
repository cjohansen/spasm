(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.spreact = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _react = _dereq_('react');

var _react2 = _interopRequireDefault(_react);

var h1 = _react2['default'].DOM.h1;
var createFactory = _react2['default'].createFactory;
var createClass = _react2['default'].createClass;
exports['default'] = createFactory(createClass({
  render: function render() {
    return h1({}, 'Page not found');
  }
}));
module.exports = exports['default'];

},{"react":"react"}],3:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

exports.getURL = getURL;
exports.toURLString = toURLString;
exports.match = match;
exports.getPage = getPage;
exports.createRoutes = createRoutes;
function first(pred, coll) {
  for (var i = 0, l = coll.length; i < l; ++i) {
    var res = pred(coll[i]);
    if (res) {
      return res;
    }
  }
}

function find(pred, coll) {
  for (var i = 0, l = coll.length; i < l; ++i) {
    if (pred(coll[i])) {
      return coll[i];
    }
  }
}

function formatURL(route, params) {
  if (!route) {
    return null;
  }
  return route.paramNames.reduce(function (url, param) {
    return url.replace(':' + param, params[param]);
  }, route.route);
}

function getURL(routes, page, params) {
  return formatURL(find(function (r) {
    return r.page === page;
  }, routes), params);
}

function val(v) {
  if (!v) {
    return true;
  }
  return (/^-?\d+(\.\d+)?$/.test(v.trim()) ? parseFloat(v) : v
  );
}

function mapify() {
  var pairs = arguments.length <= 0 || arguments[0] === undefined ? [] : arguments[0];

  return pairs.reduce(function (m, _ref) {
    var _ref2 = _slicedToArray(_ref, 2);

    var k = _ref2[0];
    var v = _ref2[1];

    m[k] = v;
    return m;
  }, {});
}

function toURLString(_ref3) {
  var query = _ref3.query;
  var path = _ref3.path;

  var queryString = Object.keys(query).map(function (k) {
    if (query[k] === null || query[k] === undefined) {
      return null;
    }
    if (query[k] === true) {
      return k;
    }
    return k + '=' + query[k];
  }).filter(function (p) {
    return p;
  }).join('&');
  return path + (queryString ? '?' + queryString : '');
}

;

function match(_ref4, url) {
  var regexp = _ref4.regexp;
  var page = _ref4.page;
  var paramNames = _ref4.paramNames;

  var _url$split = url.split('?');

  var _url$split2 = _slicedToArray(_url$split, 2);

  var path = _url$split2[0];
  var query = _url$split2[1];

  var vals = path.match(regexp);
  if (!vals) {
    return null;
  }

  return {
    page: page,
    url: url,
    path: path.replace(/^(https?:\/\/[^\/]+)/, ''),
    params: mapify(vals.slice(1).map(function (v, idx) {
      return [paramNames[idx], v];
    })),
    query: mapify(query && query.split('&').map(function (kv) {
      return kv.split('=');
    }))
  };
}

function getPage(routes, url) {
  return first(function (route) {
    return match(route, url);
  }, routes) || { params: {} };
}

function createRoutes(routes) {
  return routes.map(function (_ref5) {
    var _ref52 = _slicedToArray(_ref5, 2);

    var page = _ref52[0];
    var route = _ref52[1];

    var paramNames = (route.match(/:[a-zA-Z0-9]+/g) || []).map(function (n) {
      return n.slice(1);
    });
    return {
      page: page,
      paramNames: paramNames,
      route: route,
      regexp: new RegExp(paramNames.reduce(function (page, param) {
        return page.replace(':' + param, '([^/?]+)');
      }, route) + '$')
    };
  });
}

},{}],4:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.createApp = createApp;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

function _toArray(arr) { return Array.isArray(arr) ? arr : Array.from(arr); }

var _react = _dereq_('react');

var _react2 = _interopRequireDefault(_react);

var _router = _dereq_('./router');

var _events = _dereq_('events');

var _notFound = _dereq_('./not-found');

var _notFound2 = _interopRequireDefault(_notFound);

function getData(page, currentData) {
  var res = page.getData && page.getData(currentData);
  if (res && res.then) {
    return res;
  } else {
    return new Promise(function (resolve, reject) {
      return resolve(res);
    });
  }
}

function prep(page, data) {
  return page.prepareData ? page.prepareData(data) : data;
}

function createApp(el, _ref) {
  var routes = _ref.routes;
  var state = _ref.state;
  var finalizeData = _ref.finalizeData;

  routes = (0, _router.createRoutes)(routes);
  var bus = new _events.EventEmitter();
  var pages = {};
  var currentData = { state: state || {} },
      currentPage = undefined;
  finalizeData = finalizeData || function (d) {
    return d;
  };

  function render() {
    var data = finalizeData(prep(currentPage, currentData), currentData.location, currentData.state);
    document.title = data.title || '';
    _react2['default'].render(currentPage.render(data), el);
  }

  function renderPage(page) {
    getData(page, currentData).then(function (pageData) {
      currentData.pageData = pageData;
      currentPage = page;
      render();
    });
  }

  function _updateState(state) {
    Object.keys(state).forEach(function (k) {
      if (state[k] === null) {
        delete currentData.state[k];
      } else {
        currentData.state[k] = state[k];
      }
    });
  }

  function loadURL(url) {
    var state = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    _updateState(state);
    var res = (0, _router.getPage)(routes, url);
    currentData.location = res;
    renderPage(pages[res.page] || pages[404] || { render: _notFound2['default'] });
  }

  function triggerAction(_ref2) {
    var _ref22 = _toArray(_ref2);

    var action = _ref22[0];

    var actionArgs = _ref22.slice(1);

    for (var _len = arguments.length, callTimeArgs = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      callTimeArgs[_key - 1] = arguments[_key];
    }

    var args = actionArgs.concat(callTimeArgs);
    if (bus.listeners(action).length === 0) {
      throw new Error('Tried to trigger action ' + action + ' (' + args + '), which has no handlers');
    }
    bus.emit.apply(bus, [action].concat(_toConsumableArray(args)));
  }

  function refresh() {
    var state = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _updateState(state);
    renderPage(currentPage);
  }

  function getCurrentURL() {
    return (0, _router.toURLString)(currentData.location);
  }

  window.onpopstate = function () {
    loadURL(location.href);
  };

  return {
    el: el,
    loadURL: loadURL,
    triggerAction: triggerAction,
    refresh: refresh,
    getCurrentURL: getCurrentURL,

    getURL: function getURL() {
      for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      return _router.getURL.apply(undefined, [routes].concat(args));
    },

    addAction: function addAction(event, handler) {
      bus.on(event, function () {
        for (var _len3 = arguments.length, data = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
          data[_key3] = arguments[_key3];
        }

        return handler.apply(undefined, data.concat([currentData]));
      });
    },

    performAction: function performAction(action) {
      return function (e) {
        e.preventDefault();
        triggerAction(action);
      };
    },

    addPages: function addPages(newPages) {
      Object.keys(newPages).forEach(function (name) {
        return pages[name] = newPages[name];
      });
    },

    start: function start() {
      loadURL(location.href);
    },

    gotoURL: function gotoURL(url) {
      var state = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      history.pushState({}, '', url);
      loadURL(url, state);
    },

    updateQueryParams: function updateQueryParams(params) {
      if (!currentPage) {
        throw new Error('Cannot update query params before a page is loaded');
      }
      Object.keys(params).forEach(function (k) {
        return currentData.location.params[k] = params[k];
      });
      history.pushState({}, '', getCurrentURL());
      refresh();
    },

    updateState: function updateState(state) {
      _updateState(state);
      if (currentPage) {
        render();
      }
    }
  };
}

},{"./not-found":2,"./router":3,"events":1,"react":"react"}]},{},[4])(4)
});