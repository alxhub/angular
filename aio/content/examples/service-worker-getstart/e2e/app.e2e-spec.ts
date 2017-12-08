import { AppPage } from './app.po';
import { browser, element, by } from 'protractor';

describe('sw-example App', () => {
  let page: AppPage;
  

  beforeEach(() => {
    page = new AppPage();
  });

  it('should display welcome message', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('Welcome to Service Workers!');
  });

  it('should display the Angular logo', () => {
    let logo = element(by.css('img'));
    page.navigateTo();
    expect(logo.isPresent()).toBe(true);
  });

  it('should show a header for the list of links', () => {
    const listHeader = element(by.css('app-root > h2'));
    expect(listHeader.getText()).toEqual('Here are some links to help you start:');
  });

  it('should show a list of links', () => {
    element.all(by.css('ul > li > h2 > a')).then((items) => {
      expect(items.length).toBe(4);
      expect(items[0].getText()).toBe('Angular Service Worker Intro');
      expect(items[1].getText()).toBe('Tour of Heroes');
      expect(items[2].getText()).toBe('CLI Documentation');
      expect(items[3].getText()).toBe('Angular blog');
    });
  });
  
  it('SwUpdate.checkForUpdate() should return a rejected promise', () => {
    expect(page.checkForUpdates()).toContain('rejected: ');
  });
});
