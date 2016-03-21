import { queryParams } from './utils';
import React from 'react';
import ReactDOM from 'react-dom';
import App from './app';
import Engine from './engine';

window.hullAsyncInit = function (hull) {
  const root = document.getElementById('app');
  const { ship, organization, secret } = queryParams();

  hull.ready(function() {
    const engine = new Engine(hull, { ship, organization, secret });
    ReactDOM.render(<App engine={engine} />, root);
  });
}
