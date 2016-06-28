/*global describe, beforeEach, it */
import {parseRoute, createRoutes, getLocation, getURL,
        toURLString, parseQueryString, formatURL} from '../';
import {assert, refute} from './test-helper';

describe('Router', () => {
  let routes;

  beforeEach(() => {
    routes = createRoutes([
      ['viewList', '/lists/:id'],
      ['viewListItemComment', '/lists/:id/items/:itemId/comments/:listItemCommentId']
    ]);
  });

  describe('parseRoute', () => {
    it('parses route', () => {
      assert.match(parseRoute('/something/:id'), {
        paramNames: ['id'],
        route: '/something/:id'
      });
    });

    it('allows dash in route variable', () => {
      assert.match(parseRoute('/something/:id-here'), {
        paramNames: ['id-here'],
        route: '/something/:id-here'
      });
    });

    it('generates regexp to recognize path', () => {
      assert(parseRoute('/something/:id').regexp.test('/something/42'));
    });
  });

  describe('createRoutes', () => {
    it('parses out paramNames', () => {
      assert.equals(routes[0].paramNames, ['id']);
    });

    it('keeps page name and original route', () => {
      assert.match(routes[0], {
        page: 'viewList',
        route: '/lists/:id'
      });
    });

    it('parses all routes', () => {
      assert.match(routes, [
        {page: 'viewList', route: '/lists/:id'},
        {page: 'viewListItemComment',
         paramNames: ['id', 'itemId', 'listItemCommentId']}
      ]);
    });

    it('parses out prefix', () => {
      const routes = createRoutes([['viewList', '/lists/:id']], {prefix: '/news'});

      assert.match(routes[0], {
        route: '/lists/:id',
        prefix: '/news'
      });
    });
  });

  describe('getLocation', () => {
    it('returns noop route for non-existent page', () => {
      assert.equals(getLocation([], '/lists/12'), {params: {}});
    });

    it('returns matching route', () => {
      assert.match(getLocation(routes, '/lists/12'), {
        page: 'viewList',
        url: '/lists/12',
        path: '/lists/12',
        host: undefined,
        port: 80,
        scheme: 'http',
        query: {},
        params: {id: 12}
      });
    });

    it('returns matching route with host and port', () => {
      assert.match(getLocation(routes, 'https://localhost:6777/lists/12'), {
        page: 'viewList',
        url: 'https://localhost:6777/lists/12',
        path: '/lists/12',
        host: 'localhost',
        port: 6777,
        scheme: 'https',
        query: {},
        params: {id: 12}
      });
    });

    it('parses number parameters as numbers', () => {
      assert.same(getLocation(routes, 'https://localhost:6777/lists/12').params.id, 12);
    });

    it('parses query string', () => {
      const match = getLocation(routes, '/lists/12?something=2&dude=other');
      assert.equals(match.query, {something: 2, dude: 'other'});
    });

    it('parses query string numbers as numbers', () => {
      const match = getLocation(routes, '/lists/12?one=1&two=-2.34&three=4.3&four=-34');

      assert.equals(match.query, {one: 1, two: -2.34, three: 4.3, four: -34});
    });

    it('does not parse query string number-like strings as numbers', () => {
      const match = getLocation(routes, '/lists/12?one=p1&two=-2.34x');

      assert.equals(match.query, {one: 'p1', two: '-2.34x'});
    });

    it('parses empty query string', () => {
      const match = getLocation(routes, '/lists/12?');
      assert.equals(match.query, {});
    });

    it('parses query string with multiple versions for same key as array param', () => {
      const match = getLocation(routes, '/lists/12?tag=one&tag=two');
      assert.equals(match.query.tag, ['one', 'two']);
    });

    it('parses query string booleans', () => {
      const match = getLocation(routes, '/lists/12?doit');
      assert.equals(match.query.doit, true);
    });

    it('URI decodes parameters', () => {
      const match = getLocation(routes, '/lists/d%C3%B8d?something=gj%C3%B8dsel');

      assert.equals(match.params.id, 'død');
      assert.equals(match.query.something, 'gjødsel');
    });

    it('does not match un-prefixed route to prefixed path', () => {
      const match = getLocation(createRoutes([['index', '/:id']]), '/something/42');

      assert.equals(match, {params: {}});
    });

    it('parses out route prefix', () => {
      const match = getLocation(
        createRoutes([['index', '/:id']], {prefix: '/something'}),
        '/something/42'
      );

      assert.match(match, {page: 'index', prefix: '/something', params: {id: 42}});
    });

    it('matches prefixed /', () => {
      const match = getLocation(
        createRoutes([['index', '/']], {prefix: '/something'}),
        '/something'
      );

      assert.match(match, {page: 'index', prefix: '/something'});
    });

    it('defaults prefix to empty string', () => {
      const match = getLocation(createRoutes([['index', '/:id']]), '/42');

      assert.match(match, {prefix: ''});
    });
  });

  describe('getURL', () => {
    it('generates URL', () => {
      assert.equals(getURL(routes, 'viewList', {id: 12}), '/lists/12');
    });

    it('generates fully qualified URL', () => {
      assert.equals(getURL(routes, 'viewList', {
        id: 12,
        host: 'nrk.no'
      }), 'http://nrk.no/lists/12');
    });

    it('generates fully qualified URL with port', () => {
      assert.equals(getURL(routes, 'viewList', {
        id: 12,
        host: 'nrk.no',
        port: 666,
        scheme: 'https'
      }), 'https://nrk.no:666/lists/12');
    });

    it('generates fully qualified URL with port and prefix', () => {
      const routes = createRoutes([['viewList', '/lists/:id']], {prefix: '/something'});

      assert.equals(getURL(routes, 'viewList', {
        id: 12,
        host: 'nrk.no',
        port: 666,
        scheme: 'https'
      }), 'https://nrk.no:666/something/lists/12');
    });

    it('generates URL with query parameters', () => {
      const url = getURL(routes, 'viewList', {id: 12}, {filter: 'blergh'});
      assert.equals(url, '/lists/12?filter=blergh');
    });

    it('generates URL with URL encoded query parameters', () => {
      const url = getURL(routes, 'viewList', {id: 12}, {filter: 'blergh & blarg'});
      assert.equals(url, '/lists/12?filter=blergh%20%26%20blarg');
    });

    it('generates URL with array query parameters', () => {
      const url = getURL(routes, 'viewList', {id: 12}, {tag: ['one', 'two']});
      assert.equals(url, '/lists/12?tag=one&tag=two');
    });
  });

  describe('toURLString', () => {
    it('generates URL', () => {
      assert.equals(toURLString({
        query: {},
        path: '/lists/12'
      }), '/lists/12');
    });

    it('generates URL with query string', () => {
      assert.equals(toURLString({
        query: {id: 12, something: 'other'},
        path: '/lists/12'
      }), '/lists/12?id=12&something=other');
    });

    it('generates URL with URL encoded query string', () => {
      assert.equals(toURLString({
        query: {id: 12, something: 'blerg blarg'},
        path: '/lists/12'
      }), '/lists/12?id=12&something=blerg%20blarg');
    });

    it('generates URL with boolean query string params', () => {
      assert.equals(toURLString({
        query: {something: true},
        path: '/lists/12'
      }), '/lists/12?something');
    });
  });

  describe('parseQueryString', () => {
    it('parses query string', () => {
      assert.equals(parseQueryString('id=12&something=other'), {
        id: 12,
        something: 'other'
      });
    });

   it('parses URL encoded query string', () => {
      assert.equals(parseQueryString('id=12&something=other%20dat'), {
        id: 12,
        something: 'other dat'
      });
    });

    it('parses location.search with leading question mark', () => {
      assert.equals(parseQueryString('?id=12&something=other'), {
        id: 12,
        something: 'other'
      });
    });
  });

  describe('formatURL', () => {
    it('formats URL', () => {
      assert.equals(
        formatURL(parseRoute('/something/:id'), {id: 42}, {ok: true}),
        '/something/42?ok'
      );
    });
  });
});
