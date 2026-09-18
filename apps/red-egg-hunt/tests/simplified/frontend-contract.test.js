import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('frontend accessibility and responsive contracts', () => {
  it('has labeled public and staff controls, focus treatment, reduced motion, and no emojis', async () => {
    const [app, staff, css] = await Promise.all([
      readFile('src/App.jsx', 'utf8'),
      readFile('src/staffApp.jsx', 'utf8'),
      readFile('src/styles.css', 'utf8'),
    ]);
    expect(app).toContain('label="Pangalan"');
    expect(app).toContain('label="Mobile number"');
    expect(app).toContain('Walong-digit na printed code');
    expect(staff).toContain('htmlFor="staff-printed-code"');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('@media (max-width: 760px)');
    expect(css).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});
