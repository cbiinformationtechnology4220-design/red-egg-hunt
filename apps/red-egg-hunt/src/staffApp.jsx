import { useEffect, useRef, useState } from 'react';
import { ClientApiError, requestStaffApi } from './api.js';

function makeRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `staff-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const STATUS_COPY = Object.freeze({
  invalid: ['Invalid code', 'No campaign record matches this eight-digit code.'],
  available: ['Not yet submitted', 'This winning code has not been submitted by a participant.'],
  'submitted-but-unclaimed': ['Submitted but unclaimed', 'This winning code is ready for the staff claim action.'],
  'already-claimed': ['Already claimed', 'This winning code was already marked as claimed.'],
  claimed: ['Claim recorded', 'This winning code is now marked as claimed.'],
});

function statusText(status) { return STATUS_COPY[status] || ['Unknown state', 'The server returned an unrecognized state.']; }

export default function StaffApp() {
  const [session, setSession] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);
  const claimRequestId = useRef(makeRequestId());

  useEffect(() => {
    requestStaffApi('/api/staff/session')
      .then(setSession)
      .catch((error) => setAuthError(error instanceof ClientApiError ? error.message : 'Staff access is required.'));
  }, []);

  const lookup = async (event) => {
    event.preventDefault();
    setFeedback(null);
    setStatus(null);
    if (!/^\d{8}$/.test(code)) {
      setFeedback({ tone: 'error', text: 'Enter exactly eight digits.' });
      return;
    }
    setBusy(true);
    try {
      setStatus(await requestStaffApi('/api/staff/code', { method: 'POST', body: { printedCode: code } }));
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof ClientApiError ? error.message : 'The code could not be checked.' });
    } finally {
      setBusy(false);
    }
  };

  const claim = async () => {
    setFeedback(null);
    setBusy(true);
    try {
      const result = await requestStaffApi('/api/staff/claim', { method: 'POST', body: { printedCode: code, requestId: claimRequestId.current } });
      setStatus(result);
      if (result.status === 'claimed') setFeedback({ tone: 'success', text: 'Claim recorded exactly once with the authenticated staff identity and server timestamp.' });
      else setFeedback({ tone: 'warning', text: statusText(result.status)[1] });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof ClientApiError ? error.message : 'The claim could not be recorded. Retry using the same code.' });
    } finally {
      setBusy(false);
    }
  };

  if (authError) {
    return <div className="staff-shell"><header className="staff-header"><div className="content-width"><a className="staff-back" href="/">Back to public page</a><h1>Staff code tracker</h1></div></header><main className="content-width staff-main"><section className="staff-gate panel" aria-labelledby="staff-access-title"><span className="eyebrow">Protected staff area</span><h2 id="staff-access-title">Staff access is required.</h2><p>{authError}</p><p>Sign in through the approved staff access system, then reload this page. The printed code alone never grants staff access.</p></section></main></div>;
  }
  if (!session) return <div className="staff-shell"><main className="content-width staff-main"><section className="staff-gate panel" role="status"><span className="eyebrow">Protected staff area</span><h1>Checking staff access</h1><p>Please wait.</p></section></main></div>;

  const [label, description] = statusText(status?.status);
  const canClaim = status?.status === 'submitted-but-unclaimed';
  return (
    <div className="staff-shell">
      <header className="staff-header"><div className="content-width staff-header-inner"><div><a className="staff-back" href="/">Public page</a><h1>Staff code tracker</h1></div><span className="staff-identity">Signed in: {session.staffSubject}</span></div></header>
      <main className="content-width staff-main">
        <section className="staff-intro"><span className="eyebrow">Authenticated staff workflow</span><h2>Check and claim a printed card code.</h2><p>Enter the same eight-digit code printed beside the QR. This page never asks for participant details.</p></section>
        <section className="staff-workspace panel" aria-labelledby="lookup-title">
          <span className="eyebrow">One-time state transition</span><h2 id="lookup-title">Look up a code</h2>
          {feedback && <div className={`notice notice-${feedback.tone}`} role="alert">{feedback.text}</div>}
          <form className="staff-form" onSubmit={lookup} noValidate>
            <label htmlFor="staff-printed-code">Eight-digit printed code</label>
            <input id="staff-printed-code" name="printedCode" type="text" inputMode="numeric" autoComplete="off" maxLength="8" aria-describedby="staff-code-hint" value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 8)); setStatus(null); setFeedback(null); claimRequestId.current = makeRequestId(); }} />
            <span className="field-hint" id="staff-code-hint">No participant name or mobile number is shown in the staff result.</span>
            <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Checking code' : 'Check code'}</button>
          </form>
          {status && <article className={`staff-result result-${status.status}`} aria-live="polite"><span className="eyebrow">Server result</span><h3>{label}</h3><p>{description}</p>{status.status === 'already-claimed' && status.claimedAt && <p className="staff-timestamp">Claimed at {new Date(status.claimedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}.</p>}{canClaim && <button className="button button-secondary" type="button" onClick={claim} disabled={busy}>{busy ? 'Recording claim' : 'Confirm claim'}</button>}</article>}
        </section>
      </main>
    </div>
  );
}
