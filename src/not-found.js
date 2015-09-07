/*global React*/
const {DOM: {h1}, createFactory, createClass} = React;

export default createFactory(createClass({
  render() {
    return h1({}, 'Page not found');
  }
}));
