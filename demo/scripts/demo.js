/*global React*/
import {createApp} from '../../src/reapp';
import assign from 'lodash/object/assign';
import pick from 'lodash/object/pick';
const {h1, div, p, a, button} = React.DOM;

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
  },

  editUser: {
    render: EditUserComponent
  }
});

app.start();
