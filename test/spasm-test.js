/*global describe, beforeEach, it */
import {createApp} from '../src/spasm';
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
  });

  describe('loadURL', () => {
    it('calls getData on page', () => {
      return app.loadURL('/users/42').
        then(() => {
          assert.calledOnceWith(page.getData);
          assert.equals(page.getData.getCall(0).args, [{
            location: {
              host: undefined,
              page: 'viewUser',
              params: {id: '42'},
              path: '/users/42',
              port: 80,
              query: {},
              scheme: 'http',
              url: '/users/42'
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
          assert.equals(args, [
            {id: 42},
            {host: undefined,
             page: 'viewUser',
             params: {id: '42'},
             path: '/users/42',
             port: 80,
             query: {},
             scheme: 'http',
             url: '/users/42'},
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
});
