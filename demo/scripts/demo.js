/*global React*/
import {createApp} from '../../src/spasm';
const {h1, div, p, a, button} = React.DOM;

const app = createApp({
  state: {currentUser: 'Christian'},

  finalizeData(data, location, state) {
    data.flash = state.flash;
    return data;
  },

  render(component, data) {
    React.render(component(data), document.getElementById('app'));
  }
});

app.addAction('gotoURL', url => app.gotoURL(url));
app.addAction('updateState', (state, data) => app.updateState(state));

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

app.addPage('viewUser', '/users/:id', {
  getData({location: {params: {id}}, state}) {
    return {
      id,
      name: id[0].toUpperCase() + id.slice(1),
      info: 'Some old user'
    };
  },

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
  },

  render: UserComponent
});

app.addPage('editUser', '/users/:id/edit', {
  render: EditUserComponent
});

app.start();
