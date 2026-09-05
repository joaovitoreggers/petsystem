import { AppController } from './app.controller';

describe('AppController', () => {
  it('reports healthy status', () => {
    const controller = new AppController();
    expect(controller.health()).toEqual({ status: 'ok' });
  });
});
