/*global React*/
import {createApp} from '../../src/reapp';
import assign from 'lodash/object/assign';
import pick from 'lodash/object/pick';
const {h1, div, p, a, button} = React.DOM;

const app = createApp(document.getElementById('app'), {
  routes: [
    ['viewPage', '/:page']
  ],

  state: {user: 'Christian'},

  finalizeData(data, location, state) {
    return assign(data, pick(state, 'flash'));
  }
});

app.addAction('gotoURL', app.gotoURL);
app.addAction('updateState', app.updateState);

const FlashMessage = React.createFactory(React.createClass({
  render() {
    if (!this.props.message) {
      return null;
    }
    return p({className: 'flash-message'}, this.props.message);
  }
}));

const PageComponent = React.createFactory(React.createClass({
  render() {
    const {flash, page, text, editPageURL, actions} = this.props;

    return div({},
               FlashMessage(flash),
               h1({}, page),
               p({}, text),
               p({}, a({
                 href: editPageURL,
                 onClick: app.performAction(actions.editPage)
               }, 'Edit page')),
               p({}, button({
                 onClick: app.performAction(actions.triggerFlash)
               }, 'Trigger flash')));
  }
}));

app.addPages({
  viewPage: {
    getData({location, state}) {
      return {
        text: `Data belonging to ${state.user}`
      };
    },

    prepareData({pageData, location: {params: {page}}}) {
      const editPageURL = app.getURL('viewPage', {page: 'editPage'});
      return {
        page,
        editPageURL,
        title: `Welcome to ${page}!`,
        text: pageData.text,
        actions: {
          editPage: ['gotoURL', editPageURL],
          triggerFlash: ['updateState', {flash: {message: 'I am a flash'}}]
        }
      };
    },

    render: PageComponent
  }
});

app.start();
