import { useEffect, useRef, useState } from 'react';
import { ClientApiError, requestApi } from './api.js';
import StaffApp from './staffApp.jsx';
import './styles.css';

function route() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  return pathname === '/staff' || pathname.startsWith('/staff/') ? 'staff' : 'public';
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
      <svg className="brand-mark" viewBox="0 0 64 72" aria-hidden="true" focusable="false">
        <path d="M32 3C18 3 7 20 7 39c0 17 10 30 25 30s25-13 25-30C57 20 46 3 32 3Z" fill="currentColor" />
        <path d="M22 19c-4 5-6 11-6 17" fill="none" stroke="#fffaf6" strokeLinecap="round" strokeWidth="5" />
        <path d="M27 54c4 3 9 4 14 2" fill="none" stroke="#fffaf6" strokeLinecap="round" strokeWidth="4" />
      </svg>
      <span className="brand-copy"><span className="brand-kicker">Red Egg</span><span className="brand-title">Hunt</span></span>
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
  if (state === 'live') return 'Open now';
  if (state === 'ended') return 'Closed';
  return 'Not open yet';
}

function CampaignCounters({ campaign }) {
  if (!campaign) return null;
  const counters = campaign.counters || {};
  return (
    <dl className="counter-grid" aria-label="Public campaign counters">
      <div><dt>Submitted</dt><dd>{counters.submitted ?? 0} <span>/ {campaign.total}</span></dd></div>
      <div><dt>Remaining</dt><dd>{counters.remaining ?? campaign.total}</dd></div>
      <div><dt>Redeemed / claimed</dt><dd>{counters.claimed ?? 0}</dd></div>
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
  if (!form.name.trim()) errors.name = 'Enter your name.';
  else if (form.name.trim().length > 120) errors.name = 'Keep your name under 120 characters.';
  if (!/^09\d{9}$/.test(form.mobile.replace(/[\s().-]/g, '')) && !/^\+639\d{9}$/.test(form.mobile.replace(/[\s().-]/g, ''))) errors.mobile = 'Enter a valid Philippine mobile number.';
  if (!/^\d{8}$/.test(form.printedCode.trim())) errors.printedCode = 'Enter the eight digits printed beside the QR code.';
  return errors;
}

function Acknowledgement({ result, screenshotInstructions, onAnother }) {
  return (
    <section className="acknowledgement" aria-labelledby="acknowledgement-title">
      <div className="acknowledgement-card">
        <span className="eyebrow">Entry recorded</span>
        <h2 id="acknowledgement-title">You found a winning card.</h2>
        <p className="acknowledgement-lede">Your Red Egg Hunt entry was recorded successfully.</p>
        <div className="receipt-block">
          <span>Printed receipt code</span>
          <strong>{result.printedCode}</strong>
        </div>
        <p className="result-line"><span className="result-dot result-dot-winning" aria-hidden="true" />Winning card</p>
        <div className="screenshot-note">
          <strong>Next step</strong>
          <p>{screenshotInstructions}</p>
        </div>
        <button className="button button-secondary" type="button" onClick={onAnother}>Submit another printed code</button>
      </div>
    </section>
  );
}

function PublicApp() {
  const [campaign, setCampaign] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState({ name: '', mobile: '', printedCode: '' });
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const requestIdRef = useRef(makeRequestId());
  const summaryRef = useRef(null);

  const loadCampaign = async () => {
    try {
      const next = await requestApi('/api/public/campaign');
      setCampaign(next);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof ClientApiError ? error.message : 'The promotion service could not be loaded.');
    }
  };

  useEffect(() => { loadCampaign(); }, []);

  const updateField = (name, value) => {
    setForm((current) => ({ ...current, [name]: name === 'printedCode' ? value.replace(/\D/g, '').slice(0, 8) : value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
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
        setNotice({ tone: 'warning', text: 'This printed code has already been submitted. It cannot be used successfully again.' });
      } else {
        setResult(response);
      }
      await loadCampaign();
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof ClientApiError ? error.message : 'The entry could not be recorded. Retry when your connection is stable.' });
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

  if (route() === 'staff') return <StaffApp />;

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="content-width header-inner"><Brand /><span className="header-tag">A Red Egg Deli promotion</span></div>
      </header>
      <main id="main-content" className="content-width public-main">
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-copy">
            <span className="eyebrow">Scan. Enter. Find out.</span>
            <h1 id="page-title">Hunt for the Red Egg.</h1>
            <p className="hero-lede">Every card uses the same QR. Enter the eight-digit code printed beside it to record your entry.</p>
            <p className="hero-note">A QR scan only opens this page. Your card is consumed only after a successful submission.</p>
          </div>
          <div className="hero-seal" aria-hidden="true"><span>50</span><small>cards</small></div>
        </section>

        {loadError && <div className="notice notice-error" role="alert"><strong>Unable to load campaign status.</strong><span>{loadError}</span><button className="text-button" type="button" onClick={loadCampaign}>Retry</button></div>}
        {campaign && (
          <>
            <section className={`campaign-status status-${campaign.state}`} aria-labelledby="status-title">
              <div><span className="eyebrow">Campaign status</span><h2 id="status-title">{stateLabel(campaign.state)}</h2></div>
              <div className="server-time"><span>Server time</span><strong>{formatServerTime(campaign.serverNow, campaign.timezone)}</strong></div>
              <p>{campaign.state === 'locked' ? `The hunt opens ${campaignWindow(campaign)}.` : campaign.state === 'ended' ? 'New card submissions are closed.' : `Open from ${campaignWindow(campaign)}.`}</p>
            </section>
            <CampaignCounters campaign={campaign} />
          </>
        )}

        <div className="public-grid">
          <section className="instructions panel" aria-labelledby="instructions-title">
            <span className="eyebrow">How it works</span>
            <h2 id="instructions-title">Keep the printed code private until you submit it.</h2>
            <p>{campaign?.instructions || 'Find a Red Egg Hunt card, scan the shared QR, and enter the eight-digit code printed beside it.'}</p>
            <ol className="steps"><li><span>1</span><div><strong>Scan the shared QR</strong><small>It opens this branded page.</small></div></li><li><span>2</span><div><strong>Enter your details</strong><small>Name, mobile number, and the printed code.</small></div></li><li><span>3</span><div><strong>Screenshot your result</strong><small>Keep the acknowledgement for your records.</small></div></li></ol>
          </section>

          {result ? <Acknowledgement result={result} screenshotInstructions={campaign?.screenshotInstructions || 'Screenshot this acknowledgement for your records. Do not post your mobile number or other private information publicly.'} onAnother={resetForm} /> : (
            <section className="form-panel panel" aria-labelledby="form-title">
              <span className="eyebrow">Participant form</span>
              <h2 id="form-title">Record your card</h2>
              <p className="panel-lede">The code is the eight-digit number printed beside the QR. Do not add spaces.</p>
              <p className="prize-note"><strong>Prize:</strong> {campaign?.prizeDescription || 'PHP50 cash voucher'}</p>
              {Object.keys(errors).length > 0 && <div className="error-summary" tabIndex="-1" ref={summaryRef} role="alert"><strong>Review these fields:</strong><ul>{Object.entries(errors).map(([key, message]) => <li key={key}><a href={`#field-${key}`}>{message}</a></li>)}</ul></div>}
              {notice && <div className={`notice notice-${notice.tone}`} role="alert">{notice.text}</div>}
              <form onSubmit={submit} noValidate>
                <Field id="field-name" label="Name" hint="Use the name you want associated with this entry." error={errors.name}><input id="field-name" name="name" type="text" autoComplete="name" maxLength="120" aria-invalid={errors.name ? 'true' : 'false'} aria-describedby={`field-name-hint${errors.name ? ' field-name-error' : ''}`} value={form.name} onChange={(event) => updateField('name', event.target.value)} /></Field>
                <Field id="field-mobile" label="Mobile number" hint="Kept private. Example: 0917 123 4567." error={errors.mobile}><input id="field-mobile" name="mobile" type="tel" inputMode="tel" autoComplete="tel" maxLength="20" aria-invalid={errors.mobile ? 'true' : 'false'} aria-describedby={`field-mobile-hint${errors.mobile ? ' field-mobile-error' : ''}`} value={form.mobile} onChange={(event) => updateField('mobile', event.target.value)} /></Field>
                <Field id="field-printedCode" label="Eight-digit printed code" hint="Enter the number printed beside the QR code." error={errors.printedCode}><input id="field-printedCode" name="printedCode" type="text" inputMode="numeric" autoComplete="off" pattern="[0-9]{8}" maxLength="8" aria-invalid={errors.printedCode ? 'true' : 'false'} aria-describedby={`field-printedCode-hint${errors.printedCode ? ' field-printedCode-error' : ''}`} value={form.printedCode} onChange={(event) => updateField('printedCode', event.target.value)} /></Field>
                <p className="privacy-copy">{campaign?.privacyNotice || 'Your name and mobile number are collected privately for this entry. Do not post them publicly.'}</p>
                <button className="button button-primary button-wide" type="submit" disabled={busy || campaign?.state !== 'live'}>{busy ? 'Recording entry' : campaign?.state === 'live' ? 'Submit entry' : 'Form locked until opening'}</button>
              </form>
            </section>
          )}
        </div>
      </main>
      <footer className="site-footer"><div className="content-width"><Brand compact /><p>Need help? Contact {campaign?.supportContact || 'campaign support'}.</p><p className="footer-note">Keep your acknowledgement private and do not post your name or mobile number publicly.</p></div></footer>
    </div>
  );
}

export default PublicApp;
