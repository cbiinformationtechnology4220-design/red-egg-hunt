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
    expect(app).toContain("pathname === '/bokya'");
    expect(app).toContain('Bokya muna!');
    expect(app).toContain('Walang form at walang kailangang ilagay na pangalan o mobile number');
    expect(app).toContain('Scan at Manalo!');
    expect(app).toContain('I-type ang 8-digit code na makikita sa tabi nito para opisyal na makapasok ang entry mo!');
    expect(app).toContain('hanggang ₱2,500 Cash Voucher');
    expect(app).toContain('...CAMPAIGN_INTRO');
    expect(app).toContain('I-upload sa comment section ng official social media post ng Red Egg Deli');
    expect(app).toContain('Sun–Thu, 7AM to 5PM');
    expect(app).toContain('Fri & Sat, 7AM to 7PM');
    expect(app).toContain('function DeliIcon');
    expect(app).toContain('name="instagram"');
    expect(app).toContain('name="facebook"');
    expect(app).toContain('href="tel:09952863665"');
    expect(css).toContain('.detail-icon-wrap');
    expect(css).toContain('.menu-card-icon');
    expect(css).toContain('.footer-contact');
    expect(staff).toContain('htmlFor="staff-printed-code"');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('@media (max-width: 760px)');
    expect(css).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});
