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
    expect(app).toContain('SCAN AT MANALO!');
    expect(app).toContain('Scan ang QR!');
    expect(app).toContain('Chance manalo ng hanggang ₱2,500 cash voucher!');
    expect(app).toContain('...CAMPAIGN_INTRO');
    expect(app).toContain('I-upload sa comment section ng official social media post ng Red Egg Deli');
    expect(app).toContain('Sun–Thu, 7AM to 5PM');
    expect(app).toContain('Fri & Sat, 7AM to 7PM');
    expect(app).toContain('Open for delivery');
    expect(app).toContain('Free delivery inside Club Balai Isabel.');
    expect(app).toContain('Loyalty Card');
    expect(app).toContain('Claim at the cafe.');
    expect(app).toContain('Data Privacy Act of 2012 (RA 10173)');
    expect(app).toContain('https://privacy.gov.ph/data-privacy-act/');
    expect(app).toContain('function DeliIcon');
    expect(app).toContain('name="instagram"');
    expect(app).toContain('name="facebook"');
    expect(app).toContain('href="tel:09952863665"');
    expect(css).toContain('.detail-icon-wrap');
    expect(css).toContain('.menu-card-icon');
    expect(css).toContain('.footer-contact');
    expect(css).toContain('.delivery-callout');
    expect(css).toContain('.loyalty-card');
    expect(css).toContain('.privacy-notice');
    expect(css).toContain('@keyframes button-sheen');
    expect(css).toContain('@keyframes number-pop');
    expect(css).toContain('.form-panel form .field');
    expect(css).toContain('@keyframes deli-ring-drift');
    expect(staff).toContain('htmlFor="staff-printed-code"');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('@media (max-width: 760px)');
    expect(css).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});
