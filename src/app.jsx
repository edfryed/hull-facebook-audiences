import React, { Component } from 'react';

export default class App extends Component {
  constructor(props) {
    super(props);
    this.state = props.engine.getState();
    this._onChange = this._onChange.bind(this);
  }

  componentWillMount() {
    this.props.engine.addChangeListener(this._onChange);
  }

  componentWillUnmount() {
    this.props.engine.removeChangeListener(this._onChange);
  }

  _onChange() {
    const state = this.props.engine.getState();
    console.warn("_onChange", state)
    this.setState(state);
  }

  render() {
    console.warn('render ', this.state);
    const { currentUser } = this.state;
    const { login } = this.props.engine;
    if (currentUser) {
      return <div>
        BOOM
      </div>;
    } else {
      return <button onClick={login} className='btn btn-primary'>
        Authorize Facebook
      </button>
    }
  }
}
