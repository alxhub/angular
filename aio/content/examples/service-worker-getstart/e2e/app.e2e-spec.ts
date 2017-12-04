import { AppPage } from './app.po';
import { browser, element, by } from 'protractor';

describe('sw-example App', () => {
  let page: AppPage;
  let logo = element(by.css('img'));


  beforeEach(() => {
    page = new AppPage();
  });

  it('should display welcome message', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('Welcome to Service Workers!');
  });

  it('should display the Angular logo', () => {
    page.navigateTo();
    expect(logo.isPresent()).toBe(true); });
});
