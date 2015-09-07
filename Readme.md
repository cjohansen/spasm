# Reapp!

Reapp provides "just enough structure" for single page web applications that use
React for rendering.

## Concepts

Reapp's goal is to help you organize data flow, and separate concerns that
should not be conflated:

* Data fetching
* Data processing
* Managing client-side state
* Rendering
* Triggering actions
* Syncing/responding to URL updates

Reapp defines three main concepts to help with this separation:

### Routes

Reapp includes a simple router. It supports URL templates with named parts, and
allows you to order routes by precedence. A route is associated with a page
name, and is only used to resolve which page is being requested.

The router is bidirectional. It can resolve page name and parameters from URLs,
and it can generate URLs from a page name and parameters. The router also parses
and exposes query string parameters, but cannot route based on them.

### Pages

A page is an object with at least a `render` method, and optionally a method to
fetch data, and a method to process data. When a page is requested, Reapp will
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
response, and most of the time re-render. Reapp suggests that an action is an
event with some data. This means that the only thing event handlers in React
components need to do is to emit an event, which again means less logic inside
the components. Reapp even goes as far as suggesting that the component
shouldn't even know *what arguments* to pass along with the action. This
decision is made by `prepareData` (more on this below).

An action is implemented as a function. In addition to performing
application-specific work, actions can load a new page, manipulate the query
parameters of the current page, manipulate the client-side state, or trigger a
refresh.

## An example

Let's see a small example of an app. First off, we create an app instance. Doing
so will not make anything appear on screen. The app is bound to an element on
the page, takes in a list of routes:

```js
import {createApp} from 'reapp';

const app = createApp(document.getElementById('app'), {
  routes: [
    ['viewPage', '/:page']
  ]
});
```

The app needs a definition of the `viewPage` page:

```js
const PageComponent = React.createFactory(React.createClass({
  render() {
    return React.DOM.h1({}, 'Hello world!');
  }
}));

app.addPages({
  viewPage: {
    render(data) {
      return PageComponent(data);
    }
  }
});
```
