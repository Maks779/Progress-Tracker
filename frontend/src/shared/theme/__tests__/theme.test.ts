import { breakpointFor } from '../breakpoints';
import { resolveScheme } from '../ThemeProvider';
import { palettes } from '../tokens';

describe('breakpointFor', () => {
  it.each([
    [390, 'compact'],
    [599, 'compact'],
    [600, 'medium'],
    [768, 'medium'],
    [1023, 'medium'],
    [1024, 'expanded'],
    [1440, 'expanded'],
  ])('%i px is %s', (width, expected) => {
    expect(breakpointFor(width)).toBe(expected);
  });
});

describe('resolveScheme', () => {
  it('follows the system by default and falls back to dark', () => {
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', null)).toBe('dark');
  });

  it('lets an explicit choice win', () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });
});

describe('palettes', () => {
  it('define the same tokens in both themes', () => {
    const keys = (palette: object) => JSON.stringify(Object.keys(palette).sort());
    expect(keys(palettes.dark)).toBe(keys(palettes.light));
    expect(keys(palettes.dark.accent)).toBe(keys(palettes.light.accent));
  });

  it('keeps dark text on the accent fill in both themes', () => {
    expect(palettes.dark.accent.onFill).toBe('#0B0D0C');
    expect(palettes.light.accent.onFill).toBe('#0B0D0C');
  });
});
