import {createApp} from '../src/spreact';
import {assert, refute, sinon} from './test-helper';

function promised(val) {
  return new Promise((resolve, reject) => resolve(val));
}

describe('Spreact', () => {
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
        then(() => {
          assert.calledOnceWith(render, page.render, {id: 42});
        });
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
});
