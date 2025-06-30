import React from 'react';
import App from '../App';

// Simple smoke test to ensure the App component can be imported and instantiated
describe('App', () => {
  it('can be imported without errors', () => {
    expect(App).toBeDefined();
    expect(typeof App).toBe('function');
  });

  it('can be instantiated as a React component', () => {
    const component = React.createElement(App);
    expect(component).toBeDefined();
    expect(component.type).toBe(App);
  });
});
