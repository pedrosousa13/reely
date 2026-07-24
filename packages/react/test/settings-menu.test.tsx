// @vitest-environment happy-dom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import * as Player from '../src/index';

afterEach(cleanup);

const Menu = () => (
  <Player.SettingsMenu>
    <Player.SettingsMenuTrigger />
    <Player.SettingsMenuContent>
      <Player.MenuItem>Quality</Player.MenuItem>
      <Player.MenuItem>Speed</Player.MenuItem>
    </Player.SettingsMenuContent>
  </Player.SettingsMenu>
);

const attr = (el: Element | null, n: string) => el?.getAttribute(n) ?? null;
const hasFocus = (el: Element | null) => document.activeElement === el;

describe('SettingsMenu', () => {
  test('trigger is a labelled button that is closed by default', () => {
    render(<Menu />);
    const trigger = screen.getByRole('button', { name: 'Settings' });
    expect(attr(trigger, 'aria-haspopup')).toBe('menu');
    expect(attr(trigger, 'aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  test('clicking the trigger opens the menu and moves focus to the first item', async () => {
    render(<Menu />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const menu = screen.getByRole('menu');
    expect(attr(menu, 'data-reely-menu')).toBe('open');
    expect(attr(menu, 'data-reely-part')).toBe('settings-menu');
    await waitFor(() =>
      expect(hasFocus(screen.getAllByRole('menuitem')[0])).toBe(true)
    );
  });

  test('arrow keys move roving focus and wrap', async () => {
    render(<Menu />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const items = screen.getAllByRole('menuitem');
    await waitFor(() => expect(hasFocus(items[0])).toBe(true));
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(hasFocus(items[1])).toBe(true);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(hasFocus(items[0])).toBe(true); // wraps
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'End' });
    expect(hasFocus(items[1])).toBe(true);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Home' });
    expect(hasFocus(items[0])).toBe(true);
  });

  test('Escape closes the menu and returns focus to the trigger', async () => {
    render(<Menu />);
    const trigger = screen.getByRole('button', { name: 'Settings' });
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole('menu')).toBeTruthy());
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(hasFocus(trigger)).toBe(true);
    expect(attr(trigger, 'aria-expanded')).toBe('false');
  });

  test('selecting an item fires onSelect, closes, and restores focus to trigger', async () => {
    let picked = '';
    render(
      <Player.SettingsMenu>
        <Player.SettingsMenuTrigger />
        <Player.SettingsMenuContent>
          <Player.MenuItem onSelect={() => (picked = 'quality')}>
            Quality
          </Player.MenuItem>
        </Player.SettingsMenuContent>
      </Player.SettingsMenu>
    );
    const trigger = screen.getByRole('button', { name: 'Settings' });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Quality' }));
    expect(picked).toBe('quality');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(hasFocus(trigger)).toBe(true);
  });

  test('outside pointerdown closes the menu without stealing focus', async () => {
    render(
      <div>
        <button type="button">outside</button>
        <Menu />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await waitFor(() => expect(screen.getByRole('menu')).toBeTruthy());
    fireEvent.pointerDown(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  test('menu items meet the 44px hit target', async () => {
    render(<Menu />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const item = (await screen.findAllByRole('menuitem'))[0];
    expect(item.style.minWidth).toBe('44px');
    expect(item.style.minHeight).toBe('44px');
  });
});
