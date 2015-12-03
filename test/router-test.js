/*global describe, beforeEach, it */
import {createRoutes, getPage, getURL, toURLString} from '../src/router';
import {assert, refute} from './test-helper';

describe('Router', () => {
  let routes;

  beforeEach(() => {
    routes = createRoutes([
      ['viewList', '/lists/:id'],
      ['viewListItemComment', '/lists/:id/items/:itemId/comments/:listItemCommentId']
    ]);
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
  });

  describe('getPage', () => {
    it('returns noop route for non-existent page', () => {
      assert.equals(getPage([], '/lists/12'), {params: {}});
    });

    it('returns matching route', () => {
      assert.equals(getPage(routes, '/lists/12'), {
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
      assert.equals(getPage(routes, 'https://localhost:6777/lists/12'), {
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
      assert.same(getPage(routes, 'https://localhost:6777/lists/12').params.id, 12);
    });

    it('parses query string', () => {
      const match = getPage(routes, '/lists/12?something=2&dude=other');
      assert.equals(match.query, {something: 2, dude: 'other'});
    });

    it('parses query string numbers as numbers', () => {
      const match = getPage(routes, '/lists/12?one=1&two=-2.34&three=4.3&four=-34');

      assert.equals(match.query, {one: 1, two: -2.34, three: 4.3, four: -34});
    });

    it('does not parse query string number-like strings as numbers', () => {
      const match = getPage(routes, '/lists/12?one=p1&two=-2.34x');

      assert.equals(match.query, {one: 'p1', two: '-2.34x'});
    });

    it('parses empty query string', () => {
      const match = getPage(routes, '/lists/12?');
      assert.equals(match.query, {});
    });

    it('URI decodes parameters', () => {
      const match = getPage(routes, '/lists/d%C3%B8d?something=gj%C3%B8dsel');

      assert.equals(match.params.id, 'død');
      assert.equals(match.query.something, 'gjødsel');
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

    it('generates URL with query parameters', () => {
      const url = getURL(routes, 'viewList', {id: 12}, {filter: 'blergh'});
      assert.equals(url, '/lists/12?filter=blergh');
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

    it('generates URL with boolean query string params', () => {
      assert.equals(toURLString({
        query: {something: true},
        path: '/lists/12'
      }), '/lists/12?something');
    });
  });
});
