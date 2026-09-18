import { useEffect, useRef, useState } from 'react';
import { ClientApiError, requestApi } from './api.js';
import StaffApp from './staffApp.jsx';
import './styles.css';

const BRAND_ASSETS = Object.freeze({
  logo: '/brand/red-egg-deli-logo.png',
  menu: '/brand/2026-red-egg-menu.pdf',
  officialPage: 'https://www.balaiisabel.com/kaintayo/redeggdeli',
  instagram: 'https://www.instagram.com/redegg.deli/',
  facebook: 'https://www.facebook.com/profile.php?id=61577582626176',
  location: 'Club Balai Isabel, Brgy. Banga, Talisay, Batangas 4220',
  locationUrl: 'https://www.google.com/maps/search/?api=1&query=Red+Egg+Deli+Club+Balai+Isabel+Talisay+Batangas',
});

const DELI_HOURS = Object.freeze({
  weekday: 'Sun–Thu, 7AM to 5PM',
  weekend: 'Fri & Sat, 7AM to 7PM',
});

const PUBLIC_COPY = Object.freeze({
  heroKicker: 'Scan. I-type. Malaman agad.',
  heroTitle: 'Hanapin ang Red Egg.',
  heroLede: 'Pare-pareho ang QR sa bawat card. I-type ang walong-digit code na naka-print sa tabi nito para maitala ang entry mo.',
  heroNote: 'QR scan lang ito, hindi pa ubos ang card. Magiging consumed lang pagkatapos ng matagumpay na submission.',
  instructionsTitle: 'Itago muna ang printed code bago mag-submit.',
  instructionsBody: 'Hanap ng Red Egg Hunt card, i-scan ang shared QR, at i-type ang walong-digit code na naka-print sa tabi nito.',
  screenshotInstructions: 'I-screenshot ang acknowledgement message na ito para may reference ka. Huwag i-post ang mobile number o ibang private information publicly.',
});

const BOKYA_COPY = Object.freeze({
  heroKicker: 'False alarm muna.',
  heroTitle: 'Bokya muna!',
  heroLede: 'Hindi winning egg ang na-scan mo. Huwag susuko, kabayan—hanap pa ng ibang Red Egg.',
  heroNote: 'Walang form at walang kailangang ilagay na pangalan o mobile number sa card na ito.',
});

function route() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  return pathname === '/staff' || pathname.startsWith('/staff/') ? 'staff' : 'public';
}

function publicMode() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  return pathname === '/bokya' || pathname.startsWith('/bokya/') ? 'bokya' : 'winning';
}

function makeRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function Brand({ compact = false }) {
  return (
    <a className={`brand${compact ? ' brand-compact' : ''}`} href="/" aria-label="Red Egg Hunt home">
      <img className="brand-logo" src={BRAND_ASSETS.logo} alt="Red Egg Deli" />
      <span className="brand-copy"><span className="brand-kicker">Red Egg Deli</span><span className="brand-title">Hunt</span></span>
    </a>
  );
}

function formatServerTime(value, timezone) {
  if (!value) return 'Server time unavailable';
  try {
    return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(value));
  } catch {
    return 'Server time unavailable';
  }
}

function campaignWindow(campaign) {
  if (!campaign) return '';
  const formatter = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: campaign.timezone });
  return `${formatter.format(new Date(campaign.startsAt))} to ${formatter.format(new Date(campaign.endsAt))} (${campaign.timezone})`;
}

function stateLabel(state) {
  if (state === 'live') return 'Open na';
  if (state === 'ended') return 'Closed na';
  return 'Hindi pa bukas';
}

function CampaignCounters({ campaign }) {
  if (!campaign) return null;
  const counters = campaign.counters || {};
  return (
    <dl className="counter-grid" aria-label="Bilang ng entries sa campaign">
      <div><dt>Na-submit</dt><dd>{counters.submitted ?? 0} <span>/ {campaign.total}</span></dd></div>
      <div><dt>Natitira</dt><dd>{counters.remaining ?? campaign.total}</dd></div>
      <div><dt>Na-claim</dt><dd>{counters.claimed ?? 0}</dd></div>
    </dl>
  );
}

function Field({ id, label, hint, error, children }) {
  return (
    <div className={`field${error ? ' field-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <span className="field-hint" id={`${id}-hint`}>{hint}</span>}
      {error && <span className="field-error-message" id={`${id}-error`} role="alert">{error}</span>}
    </div>
  );
}

function validateForm(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Paki-type ang pangalan mo.';
  else if (form.name.trim().length > 120) errors.name = 'Paikliin ang pangalan sa 120 characters o mas kaunti.';
  if (!/^09\d{9}$/.test(form.mobile.replace(/[\s().-]/g, '')) && !/^\+639\d{9}$/.test(form.mobile.replace(/[\s().-]/g, ''))) errors.mobile = 'Paki-type ang valid na Philippine mobile number.';
  if (!/^\d{8}$/.test(form.printedCode.trim())) errors.printedCode = 'Paki-type ang walong digit na naka-print sa tabi ng QR.';
  return errors;
}

function Acknowledgement({ result, screenshotInstructions, onAnother }) {
  return (
    <section className="acknowledgement" aria-labelledby="acknowledgement-title">
      <div className="acknowledgement-card">
        <span className="eyebrow">Na-record na ang entry</span>
        <h2 id="acknowledgement-title">May winning card ka!</h2>
        <p className="acknowledgement-lede">Ayos! Na-record na ang Red Egg Hunt entry mo.</p>
        <div className="receipt-block">
          <span>Printed code</span>
          <strong>{result.printedCode}</strong>
        </div>
        <p className="result-line"><span className="result-dot result-dot-winning" aria-hidden="true" />Winning card ito</p>
        <div className="screenshot-note">
          <strong>Sunod na gawin</strong>
          <p>{screenshotInstructions}</p>
        </div>
        <button className="button button-secondary" type="button" onClick={onAnother}>Mag-submit ng ibang code</button>
      </div>
    </section>
  );
}

function BokyaPanel() {
  return (
    <section className="bokya-panel panel" aria-labelledby="bokya-title">
      <div className="bokya-wordmark" aria-hidden="true">BOKYA</div>
      <span className="eyebrow">False alarm muna</span>
      <h2 id="bokya-title">Huwag susuko, kabayan.</h2>
      <p className="bokya-lede">Walang winning code sa egg na ito. Hanap pa ng ibang Red Egg para makasali.</p>
      <div className="bokya-next">
        <strong>Sunod na gawin</strong>
        <p>Scan ulit ng ibang egg. Kapag winning egg iyon, lalabas ang form para ma-record ang entry mo.</p>
      </div>
    </section>
  );
}

function DeliDetails() {
  return (
    <section className="deli-section" aria-labelledby="deli-title">
      <div className="deli-intro">
        <span className="eyebrow">Dito ang saya</span>
        <h2 id="deli-title">Kain tayo, kabayan!</h2>
        <p>Mas masaya ang hunt kapag may almusal, merienda, at kape. Visit Red Egg Deli sa Club Balai Isabel.</p>
        <div className="deli-links">
          <a className="detail-link" href={BRAND_ASSETS.locationUrl} target="_blank" rel="noreferrer">
            <span className="detail-index" aria-hidden="true">01</span>
            <span><strong>Punta rito</strong><small>{BRAND_ASSETS.location}</small></span>
          </a>
          <div className="detail-link detail-link-static">
            <span className="detail-index" aria-hidden="true">02</span>
            <span><strong>Bukas kami</strong><small>{DELI_HOURS.weekday}<br />{DELI_HOURS.weekend}</small></span>
          </div>
          <a className="detail-link" href="tel:09952863665">
            <span className="detail-index" aria-hidden="true">03</span>
            <span><strong>May tanong?</strong><small>Tawag sa 0995 286 3665</small></span>
          </a>
          <a className="detail-link" href={BRAND_ASSETS.instagram} target="_blank" rel="noreferrer">
            <span className="detail-index" aria-hidden="true">04</span>
            <span><strong>Instagram namin</strong><small>@redegg.deli</small></span>
          </a>
          <a className="detail-link" href={BRAND_ASSETS.facebook} target="_blank" rel="noreferrer">
            <span className="detail-index" aria-hidden="true">05</span>
            <span><strong>Facebook namin</strong><small>Red Egg Deli</small></span>
          </a>
          <a className="detail-link" href={BRAND_ASSETS.officialPage} target="_blank" rel="noreferrer">
            <span className="detail-index" aria-hidden="true">06</span>
            <span><strong>Alamin pa</strong><small>Red Egg Deli at Club Balai Isabel</small></span>
          </a>
        </div>
      </div>
      <a className="menu-card" href={BRAND_ASSETS.menu} target="_blank" rel="noreferrer" aria-label="Open the 2026 Red Egg Deli menu PDF">
        <span className="menu-card-top"><span className="eyebrow">Menu 2026</span><span className="menu-card-open">Buksan ang PDF</span></span>
        <span className="menu-card-title">May masarap para sa’yo.</span>
        <span className="menu-card-copy">Rice meals, pasta, merienda, pancakes, kape, tsokolate, at juices.</span>
        <span className="menu-card-action">Tingnan ang menu</span>
      </a>
    </section>
  );
}

function PublicApp() {
  const bokyaMode = publicMode() === 'bokya';
  const [campaign, setCampaign] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState({ name: '', mobile: '', printedCode: '' });
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const requestIdRef = useRef(makeRequestId());
  const summaryRef = useRef(null);
  const campaignRequestRef = useRef(null);

  const loadCampaign = async () => {
    if (campaignRequestRef.current) return campaignRequestRef.current;
    const request = (async () => {
      let lastError = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const next = await requestApi('/api/public/campaign');
          setCampaign(next);
          setLoadError(null);
          return next;
        } catch (error) {
          lastError = error;
          if (attempt === 0 && error instanceof ClientApiError && (error.network || error.status >= 500)) {
            await new Promise((resolve) => window.setTimeout(resolve, 650));
            continue;
          }
          break;
        }
      }
      if (lastError instanceof ClientApiError && lastError.status >= 500) {
        setLoadError('May aberya sa promo service. Sandali lang, tap Retry ulit.');
      } else if (lastError instanceof ClientApiError && lastError.code === 'REQUEST_TIMEOUT') {
        setLoadError('Mabagal ang promo service. Check ang internet, tapos tap Retry ulit.');
      } else {
        setLoadError('Hindi ma-load ang status ng hunt. Tap Retry para subukan ulit.');
      }
      return null;
    })();
    campaignRequestRef.current = request;
    try {
      return await request;
    } finally {
      if (campaignRequestRef.current === request) campaignRequestRef.current = null;
    }
  };

  useEffect(() => { if (!bokyaMode) loadCampaign(); }, [bokyaMode]);

  const updateField = (name, value) => {
    setForm((current) => ({ ...current, [name]: name === 'printedCode' ? value.replace(/\D/g, '').slice(0, 8) : value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
    setNotice(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    setNotice(null);
    if (Object.keys(nextErrors).length > 0) {
      summaryRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const response = await requestApi('/api/public/submit', {
        method: 'POST',
        body: { name: form.name, mobileNumber: form.mobile, printedCode: form.printedCode, requestId: requestIdRef.current },
      });
      if (response.outcome === 'already-submitted') {
        setNotice({ tone: 'warning', text: 'Na-submit na ang printed code na ito. Hindi na ito puwedeng gamitin ulit.' });
      } else {
        setResult(response);
      }
      await loadCampaign();
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof ClientApiError ? error.message : 'Hindi na-record ang entry. Subukan ulit kapag stable ang internet.' });
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setResult(null);
    setNotice(null);
    setErrors({});
    setForm({ name: '', mobile: '', printedCode: '' });
    requestIdRef.current = makeRequestId();
  };

  const visibleErrors = Object.entries(errors).filter(([, message]) => Boolean(message));

  if (route() === 'staff') return <StaffApp />;

  const pageCopy = bokyaMode ? BOKYA_COPY : PUBLIC_COPY;

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="content-width header-inner"><Brand /><span className="header-tag"><span>Almusal + Kape</span><span className="header-divider" aria-hidden="true">/</span><span>Promo ng Red Egg Deli</span></span></div>
      </header>
      <main id="main-content" className="content-width public-main">
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-copy">
            <span className="eyebrow">{pageCopy.heroKicker}</span>
            <h1 id="page-title">{pageCopy.heroTitle}</h1>
            <p className="hero-lede">{pageCopy.heroLede}</p>
            <p className="hero-note">{pageCopy.heroNote}</p>
            {!bokyaMode && <a className="button button-primary hero-cta" href="#participant-form">I-submit ang entry</a>}
          </div>
          <div className="hero-art" aria-hidden="true">
            <span className="hero-orbit hero-orbit-one" />
            <span className="hero-orbit hero-orbit-two" />
            <img className="hero-logo" src={BRAND_ASSETS.logo} alt="" />
            <div className="hero-seal"><span>50</span><small>winning cards</small></div>
            <span className="hero-art-note">Almusal + Kape</span>
          </div>
        </section>

        {bokyaMode ? <BokyaPanel /> : (
          <>
            {loadError && <div className="notice notice-error" role="alert"><strong>Hindi ma-load ang status ng hunt.</strong><span>{loadError}</span><button className="text-button" type="button" onClick={loadCampaign}>Try ulit</button></div>}
            {campaign && (
              <>
                <section className={`campaign-status status-${campaign.state}`} aria-labelledby="status-title">
                  <div><span className="eyebrow">Status ng hunt</span><h2 id="status-title">{stateLabel(campaign.state)}</h2></div>
                  <div className="server-time"><span>Server time</span><strong>{formatServerTime(campaign.serverNow, campaign.timezone)}</strong></div>
                  <p>{campaign.state === 'locked' ? `Bukas ang hunt mula ${campaignWindow(campaign)}.` : campaign.state === 'ended' ? 'Closed na ang bagong submissions.' : `Open ang hunt mula ${campaignWindow(campaign)}.`}</p>
                </section>
                <CampaignCounters campaign={campaign} />
              </>
            )}

            <div className="public-grid">
              <section className="instructions panel" aria-labelledby="instructions-title">
                <span className="eyebrow">Paano sumali</span>
                <h2 id="instructions-title">{PUBLIC_COPY.instructionsTitle}</h2>
                <p>{PUBLIC_COPY.instructionsBody}</p>
                <ol className="steps"><li><span>1</span><div><strong>I-scan ang shared QR</strong><small>Dadalhin ka nito sa page na ito.</small></div></li><li><span>2</span><div><strong>Ilagay ang details mo</strong><small>Pangalan, mobile number, at printed code.</small></div></li><li><span>3</span><div><strong>I-screenshot ang resulta</strong><small>Itago ang acknowledgement para may reference ka.</small></div></li></ol>
              </section>

              {result ? <Acknowledgement result={result} screenshotInstructions={PUBLIC_COPY.screenshotInstructions} onAnother={resetForm} /> : (
                <section id="participant-form" className="form-panel panel" aria-labelledby="form-title">
                  <span className="eyebrow">Entry form</span>
                  <h2 id="form-title">I-record ang card mo.</h2>
                  <p className="panel-lede">I-type ang walong-digit number sa tabi ng QR. Walang spaces.</p>
                  <p className="prize-note"><strong>Premyo:</strong> {campaign?.prizeDescription || 'PHP50 cash voucher'}</p>
                  {visibleErrors.length > 0 && <div className="error-summary" tabIndex="-1" ref={summaryRef} role="alert"><strong>Paki-check ito:</strong><ul>{visibleErrors.map(([key, message]) => <li key={key}><a href={`#field-${key}`}>{message}</a></li>)}</ul></div>}
                  {notice && <div className={`notice notice-${notice.tone}`} role="alert">{notice.text}</div>}
                  <form onSubmit={submit} noValidate>
                    <Field id="field-name" label="Pangalan" hint="Gamitin ang pangalang gusto mong naka-associate sa entry na ito." error={errors.name}><input id="field-name" name="name" type="text" autoComplete="name" maxLength="120" aria-invalid={errors.name ? 'true' : 'false'} aria-describedby={`field-name-hint${errors.name ? ' field-name-error' : ''}`} value={form.name} onChange={(event) => updateField('name', event.target.value)} /></Field>
                    <Field id="field-mobile" label="Mobile number" hint="Private ito. Halimbawa: 0917 123 4567." error={errors.mobile}><input id="field-mobile" name="mobile" type="tel" inputMode="tel" autoComplete="tel" maxLength="20" aria-invalid={errors.mobile ? 'true' : 'false'} aria-describedby={`field-mobile-hint${errors.mobile ? ' field-mobile-error' : ''}`} value={form.mobile} onChange={(event) => updateField('mobile', event.target.value)} /></Field>
                    <Field id="field-printedCode" label="Walong-digit na printed code" hint="I-type ang number na naka-print sa tabi ng QR." error={errors.printedCode}><input id="field-printedCode" name="printedCode" type="text" inputMode="numeric" autoComplete="off" pattern="[0-9]{8}" maxLength="8" aria-invalid={errors.printedCode ? 'true' : 'false'} aria-describedby={`field-printedCode-hint${errors.printedCode ? ' field-printedCode-error' : ''}`} value={form.printedCode} onChange={(event) => updateField('printedCode', event.target.value)} /></Field>
                    <p className="privacy-copy">Private lang ang pangalan at mobile number mo para ma-record ang entry at ma-contact ang verified winners. Huwag i-post publicly. Para sa privacy questions, tawag sa {campaign?.supportContact || '0995 286 3665'}.</p>
                    <button className="button button-primary button-wide" type="submit" disabled={busy || campaign?.state !== 'live'}>{busy ? 'Sine-save ang entry...' : campaign?.state === 'live' ? 'I-submit ang entry' : 'Hindi pa bukas ang form'}</button>
                  </form>
                </section>
              )}
            </div>
          </>
        )}
        <DeliDetails />
      </main>
      <footer className="site-footer"><div className="content-width footer-inner"><div><Brand compact /><p>May tanong? Tawag sa {campaign?.supportContact || '0995 286 3665'}.</p></div><p className="footer-note">Itago ang acknowledgement mo at huwag i-post ang pangalan o mobile number publicly.</p></div></footer>
    </div>
  );
}

export default PublicApp;
