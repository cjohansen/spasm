# Spreact - Single Page React Applications

Spreact provides "just enough structure" for single page web applications that use
React for rendering.

## Concepts

Spreact's goal is to help you organize data flow, and separate concerns that
should not be conflated:

* Data fetching
* Data processing
* Managing client-side state
* Rendering
* Triggering actions
* Syncing/responding to URL updates

Spreact defines three main concepts to help with this separation.

### Routes

Spreact includes a simple router. It supports URL templates with named parts, and
allows you to order routes by precedence. A route is associated with a page
name, and is only used to resolve which page is being requested.

The router is bi-directional. It can resolve page name and parameters from URLs,
and it can generate URLs from a page name and parameters. The router also parses
and exposes query string parameters, but cannot route based on them.

### Pages

A page is an object with at least a `render` method, and optionally a method to
fetch data, and a method to process data. When a page is requested, Spreact will
perform the following steps to render the page:

* Get data with `page.getData(currentState)`
* Prepare data for rendering with `page.prepareData(data)`
* Finalize data for rendering with `app.finalizeData(preparedData, location, state)`
* Render with `page.render(data)`, which should return a rendered React
  component

The goal of this pipeline is to avoid putting data fetching and processing
inside components. By keeping these separate in pure functions, the UI becomes a
1:1 visual representation of a data structure. This data structure is
dramatically easier to test than a complex and ever-changing UI.

The details of the various function calls can be found in the API documentation
below.

### Actions

When the user interacts with the application, it needs to perform some work in
response, and most of the time re-render. Spreact suggests that an action is an
event with some data. This means that the only thing event handlers in React
components need to do is to emit an event, which again means less logic inside
the components. Spreact even goes as far as suggesting that the component
shouldn't even know *what arguments* to pass along with the action. This
decision is made by `prepareData` (more on this below).

An action is implemented as a function. In addition to performing
application-specific work, actions can load a new page, manipulate the query
parameters of the current page, manipulate the client-side state, or trigger a
refresh.

## An example

We start by creating an app instance. Doing so will not make anything appear on
screen. The app is bound to an element on the page, and takes in a list of
routes:

```js
import {createApp} from 'spreact';

const app = createApp(document.getElementById('app'), {
  routes: [
    ['viewUser', '/users/:id'],
    ['editUser', '/users/:id/edit']
  ]
});
```

The app needs a definition of the `viewUser` page (we'll add in the edit page
later):

```js
const {h1, div, p} = React.DOM;

const UserComponent = React.createFactory(React.createClass({
  render() {
    return h1({}, 'Hello world');
  }
}));

app.addPages({
  viewUser: {
    render(data) {
      return UserComponent(data);
    }
  }
});
```

Finally, a call to `start` will trigger the initial render:

```js
app.start();
```

Visiting
[http://localhost:10666/users/chris](http://localhost:10666/users/chris) should
now display "Hello world!". Let's display the requested user's name. To do so,
we will add a function to process the data so the component only receives the
bits it needs to render.

```js
const UserComponent = React.createFactory(React.createClass({
  render() {
    return React.DOM.h1({}, this.props.name);
  }
}));

app.addPages({
  viewUser: {
    prepareData({location: {params: {id}}}) {
      const name = id[0].toUpperCase() + id.slice(1);
      return {
        name,
        title: `User: ${name}`
      };
    },

    render(data) {
      return UserComponent(data);
    }
  }
});
```

Including a `title` in the data returned from `prepareData` will cause Spreact to
update `document.title` to reflect it.

In practice, most pages need to fetch some data from somewhere. Data fetch can
be synchronous or asynchronous. If it is asynchronous, `getData` should return a
promise. The `getData` function receives the current client-side state and the
location, which it can use to inform its retrieval. For instance, if the app
requires logging in a user, you might want to store the user in the client-side
state, and look it up to retrieve user-specific data:

```js
const UserComponent = React.createFactory(React.createClass({
  render() {
    return div({},
               h1({}, this.props.name),
               p({}, this.props.info));
  }
}));

app.addPages({
  viewUser: {
    getData({location: {params: {id}}, state}) {
      return {
        id,
        name: id[0].toUpperCase() + id.slice(1),
        info: 'Some old user'
      };
    },

    prepareData({pageData: user, location}) {
      return {
        name: user.name,
        title: `User: ${user.name}!`,
        info: user.info
      };
    },

    render: UserComponent
  }
});
```

The data returned from `getData` (or eventually resolved from a promise returned
from it) will be included in the object passed to `prepareData` as `pageData`.
`prepareData` pulls relevant data from the different sources and produces a
single object that will be rendered by the component.

Initial state can be provided when creating the app:

```js
const app = createApp(document.getElementById('app'), {
  routes: [
    ['viewUser', '/users/:id'],
    ['editUser', '/users/:id/edit']
  ],

  state: {currentUser: 'Christian'}
});
```

Let's add an action to the application - a regular link that loads a different
page. First, we will define the action itself:

```js
app.addAction('gotoURL', url => app.gotoURL(url));
```

To trigger this action in the component, we should first expose it in
`prepareData`:

```js
prepareData({pageData: user, location}) {
  const editUserURL = app.getURL('editUser', user);
  return {
    name: user.name,
    title: `User: ${user.name}!`,
    info: user.info,
    editUserURL,
    actions: {
      edit: ['gotoURL', editUserURL]
    }
  };
}
```

This adds two things: the `editUserURL`, which is generated from the
bi-directional router, and the action. Note how `prepareData` makes all the
decisions on what data to display and what data to pass with actions. This
separation of concerns leaves our components wonderfully oblivious about details
in our data structures, and tightly focused on rendering:

```js
const UserComponent = React.createFactory(React.createClass({
  render() {
    return div({},
               h1({}, this.props.name),
               p({}, this.props.info),
               p({}, a({
                 href: this.props.editUserURL,
                 onClick(e) {
                   e.preventDefault()
                   app.triggerAction(this.props.actions.edit);
                 }
               }, 'Edit user')));
  }
}));
```

The event handler used with the click event is so common, that the app instance
provides a helper for it:

```js
a({
  href: this.props.editPageURL,
  onClick: app.performAction(this.props.actions.edit)
}, 'Edit page')
```

Clicking the link will produce a 404, because we haven't implemented the
`editUser` page yet, here's a stub:

```js
const EditUserComponent = React.createFactory(React.createClass({
  render() {
    return div({},
               h1({}, 'Edit user'));
  }
}));

app.addPages({
  viewUser: {
    // ...
  },

  editUser: {
    render: EditUserComponent
  }
});
```

For our final example, we will consider adding a "flash message" - a message
pinned to the top of the page regardless of which URL you're currently watching.
We will start by adding a new action. It will add some data to the client-side
state and trigger a re-render.

```js
app.addAction('updateState', (state, data) => app.updateState(state));
```

Next up, we will include an action for the UI so it can trigger the flash:

```js
prepareData({pageData: user, location}) {
  const editUserURL = app.getURL('editUser', user);
  return {
    name: user.name,
    title: `User: ${user.name}!`,
    info: user.info,
    editUserURL,
    actions: {
      edit: ['gotoURL', editUserURL],
      triggerFlash: ['updateState', {flash: {message: 'I am a flash'}}]
    }
  };
}
```

Because the flash needs to be available on all pages, we don't want to repeat
the code in `prepareData` on all the pages. This is what the app's global
`finalizeData` is for. It receives the data as prepared by the rendering page,
along with the client-side state and the current location:

```js
import assign from 'lodash/object/assign';
import pick from 'lodash/object/pick';

const app = createApp(document.getElementById('app'), {
  routes: [
    ['viewUser', '/users/:id'],
    ['editUser', '/users/:id/edit']
  ],

  state: {currentUser: 'Christian'},

  finalizeData(data, location, state) {
    return assign(data, pick(state, 'flash'));
  }
});
```

Now every page in the app will be able to access `flash` on the data passed to
`render` (if there is a flash). Finally, we render it:

```js
const FlashMessage = React.createFactory(React.createClass({
  render() {
    if (!this.props.message) {
      return null;
    }
    return p({className: 'flash-message'}, this.props.message);
  }
}));

const UserComponent = React.createFactory(React.createClass({
  render() {
    console.log(this.props);
    const {flash, name, info, editUserURL, actions} = this.props;

    return div({},
               FlashMessage(flash),
               h1({}, name),
               p({}, info),
               p({}, a({
                 href: editUserURL,
                 onClick: app.performAction(actions.edit)
               }, 'Edit user')),
               p({}, button({
                 onClick: app.performAction(actions.triggerFlash)
               }, 'Trigger flash')));
  }
}));

const EditUserComponent = React.createFactory(React.createClass({
  render() {
    return div({},
               FlashMessage(this.props.flash),
               h1({}, 'Edit user'));
  }
}));
```

That about sums up the important bits about Spreact. Below you will find complete
API docs for all the details.

The demo can be found in the `demo` directory, and can be run with `npm start`
(following `npm install`).

## API docs

### `const app = createApp(el, {routes, state, finalizeData})`

Creates a new application instance.

#### `el`

A DOM element to render the app into.

#### `routes`

An array of routes. A route is a "tuple"/a two-element array where the first
element is the name of the page the route matches, and the second element is the
URL template:

```js
[['viewThing', '/things/:id'],
 ['editThing', '/things/:id/edit']]
```

#### `state`

Initial client-side state, as an object. Optional.

#### `finalizeData(preparedData, location, state)`

A function that finalizes data processing before every render. `preparedData` is
the data returned from the current page's `prepareData` function. `location` is
the result of the router's parsing, see below. `state` is the client-side state.

The object returned from this function will be passed to the page's `render`
function.

### `app.loadURL(url[, state])`

Use the router to resolve the page for this URL, fetch its data, prepare it, and
render. Optionally update client-side state as well.

### `app.gotoURL(url[, state])`

Like `loadURL`, but also push the `url` to the browser.

### `app.triggerAction(action)`

Triggers an action. If trying to trigger an action that has no handlers, this
will throw an exception. The action is a tuple/two-element array, where the
first element is the name of the action, and the second element is the action
argument.

The action will be called with the action argument as its first argument, and
the current data as the second argument, e.g.:

```js
app.addAction('test', (actionArgs, {location, pageData, state}) => {
  // ...
});

// ...

app.triggerAction(['test', {action: 'args'}]);
```

### `app.getURL(pageName, params)`

Uses the bi-directional router to generate a URL from the page name and
parameters.

### `app.getCurrentURL()`

Returns the URL corresponding to the current page and current state. You can
modify `query` in `location` and have it reflected in the URL returned from
`getCurrentURL`.

```js
app.action('addQueryParams', (params, {location}) => {
  // Merge the new params into the current params
  assign(location.params, params);
  app.gotoURL(app.getCurrentURL());
});
```

### `app.refresh([state])`

Runs the current page over again - fetches data, prepares data and renders.
Optionally takes some new client-side state.

### `app.updateState(state)`

Add some local state and re-render the application.

### `app.updateQueryParams(params)`

Add some URL query parameters. This will cause the app to refresh with the new
query parameters included in the URL. The new URL will also be loaded in the
browser.

### `app.addAction(actionName, handler)`

Define an action. There's no expectations on how the action should behave. Most
actions will want to cause visual changes at some point, and for this purpose,
you might be interested in the app's `loadURL`, `updateState`,
`updateQueryParams`, and `refresh` functions.

The action handler will be called with an action-specific argument as its first
argument, and the current data (which consists of `{location, state, pageData}`)
as its second argument.

### `app.performAction(action)`

Convenience for use as event handler in React components. Returns a function
that can be used as an event handler. The handler will call `preventDefault` and
then trigger the action.

```js
React.DOM.a({onClick: app.performAction(['gotoURL', '/'])}, 'Home');
```

### `app.addPages(pages)`

Add page definitions. `pages` should be an object where the name of the page is
the property name, and the page object is the value. See below for details on
page objects.

### `app.start()`

Kick things off by rendering `location.href`.

### Pages

Pages are plain old JavaScript objects. Every page *must* implement the `render`
function, which can be a single React component, e.g.: `{render:
SomeComponent}`. Additionally, pages may implement `getData` and `prepareData`.

#### `page.getData({state, location})`

Fetch data for this page. May return data directly, or a promise that resolves
with the data. The state contains whatever was previously put in it. `location`
is described with the router below.

#### `page.prepareData({pageData, state, location})`

Perform any data processing necessary for rendering the UI and return the object
to render. `pageData` is the data retrieved with `getData`.

If the object returned from `prepareData` includes a `title`, it will be used
for the page title (e.g. `document.title`).

## The router

The router is not exposed directly, although it is completely possible to use it
on its own if desired.

### `const routingTable = createRoutes(routes)`

Creates a routing table. `routes` is an array of routes, where each route is a
tuple of `[pageName, urlTemplate]`.

### `const url = toURLString({path, query})`

Produces a URL string from a path and a query parameter object.

### `const url = getURL(routes, page, params)`

Generates the URL to the given page type with the given parameters.

### `const location = getPage(routes, url)`

Returns the matching page from the routing table for the giving URL. If no route
matches, it returns `null`. The location description includes the following
properties:

#### String `page`

The name of the matching page.

#### String `url`

The URL matched against.

#### String `path`

Only the path part of the URL matched against.

#### Object `params`

Parameters matched from the route. Any `:paramName` placeholder from URL
templates are included. For instance, if the matching route was `/stuff/:id`,
then `params` will contain the `id` property.

#### Object `query`

The query string, parsed into an object.
