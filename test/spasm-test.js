/*global describe, beforeEach, it */
import {createApp} from '../';
import {assert, refute, sinon} from './test-helper';

function promised(val) {
  return new Promise((resolve, reject) => resolve(val));
}

describe('Spasm', () => {
  let app, render, finalizeData, page, state;

  beforeEach(() => {
    render = sinon.spy();
    finalizeData = sinon.stub().returns({});
    state = {some: 'state'};
    app = createApp({render, finalizeData, state});
    page = {
      getData: sinon.stub(),
      prepareData: sinon.stub(),
      render: sinon.stub()
    };
    app.addPage('viewUser', '/users/:id', page);
    global.history = {pushState: sinon.spy()};
  });

  describe('loadURL', () => {
    it('calls getData on page', () => {
      return app.loadURL('/users/42').
        then(() => {
          assert.calledOnceWith(page.getData);
          assert.match(page.getData.getCall(0).args, [{
            location: {
              page: 'viewUser',
              params: {id: 42},
              path: '/users/42',
              port: 80,
              query: {},
              scheme: 'http',
              url: 'http://localhost/users/42'
            },
            pageData: undefined,
            state: {some: 'state'}
          }]);
        });
    });

    it('calls prepare data with page data', () => {
      const data = {};
      page.getData.returns(data);

      return app.loadURL('/users/42').
        then(() => {
          assert.calledOnce(page.prepareData);
          assert.same(page.prepareData.getCall(0).args[0].pageData, data);
        });
    });

    it('does not call prepare data before getData promise resolves', () => {
      page.getData.returns(new Promise(() => {}));

      app.loadURL('/users/42');

      refute.called(page.prepareData);
    });

    it('calls prepare data with resolved page data', () => {
      const data = {};
      page.getData.returns(promised(data));

      return app.loadURL('/users/42').
        then(() => {
          assert.calledOnce(page.prepareData);
          assert.same(page.prepareData.getCall(0).args[0].pageData, data);
        });
    });

    it('does not require a getData function', () => {
      delete page.getData;

      return app.loadURL('/users/42').
        then(() => {
          assert.calledOnce(page.prepareData);
        });
    });

    it('does not require a prepareData function', () => {
      delete page.prepareData;

      return app.loadURL('/users/42').
        then(() => {
          assert.calledOnce(page.getData);
        });
    });

    it('calls finalize data with final data', () => {
      page.prepareData.returns({id: 42});

      return app.loadURL('/users/42').
        then(() => {
          assert.calledOnce(finalizeData);
          const args = finalizeData.getCall(0).args;
          assert.match(args, [
            {id: 42},
            {page: 'viewUser',
             params: {id: 42},
             path: '/users/42',
             port: 80,
             query: {},
             scheme: 'http',
             url: 'http://localhost/users/42'},
            {some: 'state'}
          ]);
        });
    });

    it('passes finalized data and page render to app render', () => {
      finalizeData.returns({id: 42});

      return app.loadURL('/users/42').
        then(() => assert.calledOnceWith(render, page.render, {id: 42}));
    });

    it('passes page data directly to render if prepareData is missing', () => {
      app = createApp({render, state});
      page = {getData: sinon.stub().returns({id: 42}), render: sinon.spy()};
      app.addPage('viewUser', '/users/:id', page);

      return app.loadURL('/users/42').
        then(() => assert.calledOnceWith(render, page.render, {id: 42}));
    });

    it('passes custom state', () => {
      return app.loadURL('/users/42', {more: 'state'}).
        then(() => {
          assert.equals(page.getData.getCall(0).args[0].state, {
            some: 'state',
            more: 'state'
          });
        });
    });

    it('renders the 404 page if no matching page is found', () => {
      const notFound = {render() {}};
      app.addPage('404', '/404', notFound);

      return app.loadURL('/zorg').
        then(() => {
          assert.calledOnceWith(render, notFound.render);
        });
    });

    it('prepares prefixed page', () => {
      const app = createApp({render, prefix: '/myapp'});
      const page = {prepareData: sinon.spy()};
      app.addPage('viewThing', '/things/:id', page);

      return app.loadURL('/myapp/things/42').
        then(() => assert.equals(page.prepareData.getCall(0).args[0].location.params, {
          id: 42
        }));
    });
  });

  describe('getData -> [Promise]', () => {
    it('calls render immediately with pageData object indicating partial response', () => {
      const app = createApp({render});

      const page = {
        getData: sinon.stub().returns([new Promise(() => {})]),
        prepareData: sinon.spy()
      };

      app.addPage('viewThing', '/things/:id', page);
      app.loadURL('/things/42');

      assert.calledOnce(page.prepareData);
      assert.equals(page.prepareData.getCall(0).args[0].pageData, {isPartial: true});
    });

    it('calls render again when first result materializes', () => {
      const app = createApp({render});
      const resolves = [];
      const promise1 = new Promise(res => resolves.push(res));

      const page = {
        getData: sinon.stub().returns([promise1, new Promise(() => {})]),
        prepareData: sinon.spy()
      };

      app.addPage('viewThing', '/things/:id', page);
      app.loadURL('/things/42');

      resolves[0]({id: 42});

      return promise1.then(() => {
        assert.calledTwice(page.prepareData);
        assert.equals(page.prepareData.getCall(1).args[0].pageData, {id: 42, isPartial: true});
      });
    });

    it('merges page data from promises', () => {
      const app = createApp({render});

      const page = {
        getData: sinon.stub().returns([Promise.resolve({id: 42}), Promise.resolve({ab: 13})]),
        prepareData: sinon.spy()
      };

      app.addPage('viewThing', '/things/:id', page);

      return app.loadURL('/things/42').then(() => {
        assert.calledThrice(page.prepareData);
        assert.equals(page.prepareData.getCall(2).args[0].pageData, {id: 42, ab: 13});
      });
    });

    it('ignores async data from previous page views', () => {
      const app = createApp({render});
      const resolves = [];
      const promises = [];

      const page = {
        getData() {
          const promise = new Promise(res => resolves.push(res));
          promises.push(promise);
          return [promise];
        },

        prepareData: sinon.spy()
      };

      app.addPage('viewThing', '/things/:id', page);
      app.loadURL('/things/42');
      app.loadURL('/things/42');

      resolves[0]({id: 42});

      return promises[0].then(() => {
        assert.calledTwice(page.prepareData);
      });
    });

    it('emits event when all data is loaded', () => {
      const app = createApp({render});
      const listener = sinon.spy();
      app.on('dataLoaded', listener);

      const page = {
        getData: sinon.stub().returns([Promise.resolve({id: 42}), Promise.resolve({ab: 13})]),
        prepareData: sinon.spy()
      };

      app.addPage('viewThing', '/things/:id', page);

      return app.loadURL('/things/42').then(() => {
        assert.calledOnce(listener);
        assert(listener.calledAfter(page.prepareData));
      });
    });
  });

  describe('debug logging', () => {
    let logger;

    beforeEach(() => {
      logger = {log: sinon.spy()};
      app = createApp({render, finalizeData, state, logger});
      page = {
        getData: sinon.stub(),
        prepareData: sinon.stub(),
        render: sinon.stub()
      };
      app.addPage('viewUser', '/users/:id', page);
    });

    it('logs profusely', () => {
      page.getData.returns({data: 13});
      page.prepareData.returns({embellished: {data: 13}});

      return app.loadURL('/users/42').
        then(() => {
          assert.equals(logger.log.args[0], ['loadURL', '/users/42', 'viewUser', {id: 42}, {}]);
          assert.match(logger.log.args[1], ['getData', {location: {}, state: {some: 'state'}}]);
          assert.match(logger.log.args[2], ['prepareData', {pageData: {data: 13}}]);
          assert.match(logger.log.args[3], ['finalizeData', {embellished: {data: 13}}, {page: 'viewUser'}, {some: 'state'}]);
        });
    });
  });

  describe('triggerAction', () => {
    it('does nothing if triggering no action', () => {
      refute.defined(app.triggerAction());
    });

    it('fails if triggering action with no handlers', () => {
      assert.exception(() => {
        app.triggerAction(['someAction']);
      });
    });

    it('calls action handler', () => {
      const doIt = sinon.spy();
      app.addAction('doIt', doIt);

      app.triggerAction(['doIt']);

      assert.calledOnce(doIt);
    });

    it('calls action handler with action arguments', () => {
      const doIt = sinon.spy();
      app.addAction('doIt', doIt);

      app.triggerAction(['doIt', 1, 2, 3]);

      assert.calledOnceWith(doIt, 1, 2, 3);
    });

    it('calls action handler with call-time arguments', () => {
      const doIt = sinon.spy();
      app.addAction('doIt', doIt);

      app.triggerAction(['doIt', 1, 2, 3], 4, 5);

      assert.calledOnceWith(doIt, 1, 2, 3, 4, 5);
    });

    it('returns promise that yields all action results', () => {
      app.addAction('doIt', sinon.stub().returns(42));
      app.addAction('doIt', sinon.stub().returns(13));

      return app.triggerAction(['doIt']).
        then(v => assert.equals(v, [42, 13]));
    });

    it('waits for all action results', () => {
      let resolve;
      const result = new Promise((res, reject) => resolve = res);
      app.addAction('doIt', sinon.stub().returns(result));

      setTimeout(() => resolve(42), 0);

      return app.triggerAction(['doIt']).
        then(v => assert.equals(v, [42]));
    });
  });

  describe('refresh', () => {
    it('gets, prepares and renders data from current page', () => {
      return app.loadURL('/users/someone').
        then(() => app.refresh()).
        then(() => {
          assert.calledTwice(page.getData);
          assert.calledTwice(page.prepareData);
          assert.calledTwice(render);
        });
    });

    it('accepts custom state', () => {
      return app.loadURL('/users/someone', {more: 'states'}).
        then(() => app.refresh()).
        then(() => assert.equals(page.getData.getCall(1).args[0].state, {
          some: 'state',
          more: 'states'
        }));
    });
  });

  describe('getCurrentURL', () => {
    it('returns full URL for current location', () => {
      return app.loadURL('/users/someone', {more: 'states'}).
        then(() => app.refresh()).
        then(() => assert.equals(app.getCurrentURL(), '/users/someone'));
    });
  });

  describe('getURL', () => {
    it('resolves page URL with router', () => {
      assert.equals(app.getURL('viewUser', {id: 12}), '/users/12');
    });

    it('resolves prefixed page URL', () => {
      const app = createApp({render, prefix: '/myapp'});
      app.addPage('viewIndex', '/', {});

      assert.equals(app.getURL('viewIndex', {}), '/myapp/');
    });
  });

  describe('gotoURL', () => {
    it('adds prefixes to browser URLs', () => {
      const app = createApp({render, prefix: '/myapp'});
      const page = {getData: sinon.stub().returns({})};
      app.addPage('viewList', '/lists/:id', page);

      app.gotoURL('/lists/42');

      assert.calledOnce(global.history.pushState);
      assert.equals(global.history.pushState.getCall(0).args[2], '/myapp/lists/42');
      assert.match(page.getData.getCall(0).args[0].location, {
        params: {id: 42}
      });
    });

    it('does not duplicate incoming prefixes', () => {
      const app = createApp({render, prefix: '/myapp'});
      const page = {getData: sinon.stub().returns({})};
      app.addPage('viewList', '/lists/:id', page);

      app.gotoURL('/myapp/lists/42');

      assert.calledOnce(global.history.pushState);
      assert.equals(global.history.pushState.getCall(0).args[2], '/myapp/lists/42');
      assert.match(page.getData.getCall(0).args[0].location, {
        params: {id: 42}
      });
    });
  });

  describe('loadURL', () => {
    it('ignores incoming prefixes', () => {
      const app = createApp({render, prefix: '/myapp'});
      const page = {getData: sinon.stub().returns({})};
      app.addPage('viewList', '/lists/:id', page);

      app.loadURL('/myapp/lists/42');

      assert.match(page.getData.getCall(0).args[0].location, {
        params: {id: 42}
      });
    });
  });

  describe('performAction', () => {
    it('creates event handler that triggers action', () => {
      const event = {preventDefault: sinon.spy()};
      const doIt = sinon.spy();
      app.addAction('doIt', doIt);

      app.performAction(['doIt', 42])(event);

      assert.calledOnceWith(doIt, 42);
      assert.calledOnce(event.preventDefault);
    });

    it('does not create event handler for non-existent action', () => {
      assert.isNull(app.performAction(null));
    });

    it('does not fail without event object', () => {
      const doIt = sinon.spy();
      app.addAction('doIt', doIt);

      app.performAction(['doIt'])();

      assert.calledOnce(doIt);
    });

    it('passes nativeEvent to action', () => {
      const nativeEvent = {};
      const doIt = sinon.spy();
      app.addAction('doIt', doIt);

      app.performAction(['doIt'])({nativeEvent});

      assert.same(doIt.getCall(0).args[0], nativeEvent);
    });
  });

  describe('updateQueryParams', () => {
    it('adds params to the location', () => {
      return app.loadURL('/users/42').
        then(() => app.updateQueryParams({filter: 'everything'})).
        then(() => {
          assert.equals(app.getCurrentURL(), '/users/42?filter=everything');
          const arg = page.prepareData.getCall(1).args[0];
          assert.equals(arg.location.query, {filter: 'everything'});
        });
    });

    it('adds additional state', () => {
      return app.loadURL('/users/42').
        then(() => app.updateQueryParams({filter: 'everything'}, {more: 'state'})).
        then(() => assert.equals(app.getState(), {some: 'state', more: 'state'}));
    });
  });

  describe('clearQueryParams', () => {
    it('removes all query params', () => {
      return app.loadURL('/users/42?a=42&b=13').
        then(() => app.clearQueryParams()).
        then(() => {
          assert.equals(app.getCurrentURL(), '/users/42');
        });
    });
  });

  describe('updateState', () => {
    it('updates the state and re-renders', () => {
      return app.loadURL('/users/42').
        then(() => app.updateState({user: 'Someone'})).
        then(() => {
          const arg = page.prepareData.getCall(1).args[0];
          assert.equals(arg.state, {some: 'state', user: 'Someone'});
          assert.calledTwice(render);
        });
    });
  });

  describe('flashState', () => {
    it('does not automatically render', () => {
      return app.loadURL('/users/42').
        then(() => app.flashState({user: 'Someone'})).
        then(() => assert.calledOnce(render));
    });

    it('sets state', () => {
      return app.loadURL('/users/42').
        then(() => app.flashState({user: 'Someone'})).
        then(() => app.refresh()).
        then(() => {
          const arg = page.prepareData.getCall(1).args[0];
          assert.equals(arg.state.user, 'Someone');
        });
    });

    it('reverts state change and re-renders after timeout', (done) => {
      app.loadURL('/users/42').
        then(() => app.flashState({user: 'Someone'}, 5));

      setTimeout(() => {
        const arg = page.prepareData.getCall(1).args[0];
        refute.equals(arg.state.user, 'Someone');
        done();
      }, 20);
    });

    it('extends timeout when re-flashing state', (done) => {
      app.loadURL('/users/42').
        then(() => app.flashState({user: 'Someone'}, 20)).
        then(() => setTimeout(() => {
          app.flashState({user: 'Other'}, 20);
          app.refresh();
        }, 10)).
        then(() => setTimeout(() => {
          const arg = page.prepareData.getCall(1).args[0];
          assert.equals(arg.state.user, 'Other');
          done();
        }, 30));
    });
  });

  describe('seedState', () => {
    beforeEach(() => {
      page = {
        getData: sinon.stub(),
        seedState: sinon.stub(),
        prepareData: sinon.stub(),
        render: sinon.stub()
      };

      app.addPage('viewUser', '/users/:id', page);
    });

    it('is called with current data', () => {
      return app.loadURL('/users/42').
        then(() => {
          assert.calledOnce(page.seedState);
          assert.callOrder(page.getData, page.seedState);
          assert.match(page.seedState.getCall(0).args, [{
            location: {
              host: 'localhost',
              page: 'viewUser',
              params: {id: 42},
              path: '/users/42',
              port: 80,
              query: {},
              scheme: 'http',
              url: 'http://localhost/users/42'
            },
            pageData: undefined,
            state: {some: 'state'}
          }]);
        });
    });

    it('is called after getData, and before prepareData', () => {
      return app.loadURL('/users/42').
        then(() => {
          assert.callOrder(page.getData, page.seedState, page.prepareData);
        });
    });

    it('merges return value into current state', () => {
      page.seedState.returns({name: 'Baloo'});

      return app.loadURL('/users/42').
        then(() => {
          assert.match(page.prepareData.args[0][0], {
            state: {name: 'Baloo'}
          });
        });
    });

    it('ignores undefined return from seedState', () => {
      return app.loadURL('/users/42').
        then(() => {
          assert.equals(page.prepareData.args[0][0].state, {some: 'state'});
        });
    });
  });

  describe('canUnload', () => {
    let page1, page2;

    beforeEach(() => {
      page1 = {canUnload: sinon.stub()};
      page2 = {seedState: sinon.stub()};
      app.addPage('viewUser', '/users/:id', page1);
      app.addPage('viewSettings', '/settings/:id', page2);
    });

    it('calls canUnload before seeding state on next page', () => {
      return app.gotoURL('/users/1')
        .then(() => app.gotoURL('/settings/1'))
        .then(() => {
          assert.calledOnce(page1.canUnload);
          assert.callOrder(page1.canUnload, page2.seedState);
        });
    });

    it('does not navigate if canUnload returns false', () => {
      page1.canUnload.returns(false);

      return app.gotoURL('/users/1')
        .then(() => app.gotoURL('/settings/1'))
        .then(() => {
          refute.called(page2.seedState);
        });
    });
  });

  describe('onUnload', () => {
    beforeEach(() => {
      page = {onUnload: sinon.stub()};
      app.addPage('viewUser', '/users/:id', page);
      app.addPage('viewSettings', '/settings/:id', {render() {}});

    });

    it('calls onUnload before rendering new page', () => {
      return app.gotoURL('/users/1')
        .then(() => {
          refute.called(page.onUnload);
          return app.gotoURL('/settings/1');
        })
        .then(() => assert.calledOnce(page.onUnload));
    });

    it('calls onUnload if canUnload returns true', () => {
      page.canUnload = sinon.stub().returns(true);

      return app.gotoURL('/users/1')
        .then(() => {
          refute.called(page.onUnload);
          return app.gotoURL('/settings/1');
        })
        .then(() => assert.callOrder(page.canUnload, page.onUnload));
    });

    it('does not call onUnload if canUnload returns false', () => {
      page.canUnload = sinon.stub().returns(false);

      return app.gotoURL('/users/1')
        .then(() => {
          refute.called(page.onUnload);
          return app.gotoURL('/settings/1');
        })
        .then(() => refute.called(page.onUnload));
    });

    it('updates state with result of onUnload', () => {
      page.onUnload.returns({lol: 'rofl'});

      return app.gotoURL('/users/1')
        .then(() => app.gotoURL('/settings/1'))
        .then(() => {
          assert.match(app.getState(), {lol: 'rofl'});
        });
    });
  });
});
