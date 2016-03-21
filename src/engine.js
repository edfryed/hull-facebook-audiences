import _ from 'lodash';
import { EventEmitter } from 'events';

const EVENT = 'CHANGE';

export default class Engine extends EventEmitter {

  constructor(hull, config) {
    super();
    this.hull = hull;
    this.config = config;
    const currentUser = hull.currentUser();
    setTimeout((() => this.fetchUserCredentials(hull.currentUser())), 1000)
    this.login = this.login.bind(this)
  }

  setState(changes) {
    this.state = Object.assign({}, this.state, changes);
    this.emitChange();
    console.warn('engine state', this.state);
    return this.state;
  }

  fetchUserCredentials(currentUser) {
    this.setState({ currentUser, loading: !!currentUser });
    if (currentUser) {
      const credentials = this.hull.api('me/credentials');
      const permissions = this.hull.api({ provider: 'facebook', path: 'me/permissions' });
      Promise.all([credentials, permissions]).then(res => {
        console.warn('DONE WITH res', res);
      })
    }
  }

  getState() {
    return this.state || {};
  }

  addChangeListener(listener) {
    this.addListener(EVENT, listener);
  }

  removeChangeListener(listener) {
    this.removeListener(EVENT, listener);
  }

  emitChange() {
    this.emit(EVENT);
  }

  updateShip(ship) {
  }

  login() {
    const params = { scope: 'ads_read,ads_management,manage_pages' }
    this.hull.login('facebook', params).then(currentUser => {
      this.setState({ currentUser })
    }).then(user => {
      hull.api('me/credentials', credentials => {
        this.setState({ credentials })
      })
    })
  }
}
