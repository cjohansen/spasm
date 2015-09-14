import react from 'react';
const {DOM: {h1}, createFactory, createClass} = react;

export default createFactory(createClass({
  render() {
    return h1({}, 'Page not found');
  }
}));
