# Red Egg Hunt interface design contract

Status: simplified local implementation draft; final brand and campaign copy still require approval.

## Direction

Use the existing Red Egg visual tone: warm paper, dark ink, strong red, and a restrained yellow signal. The experience should feel like a focused hospitality campaign page, not a generic form or dashboard. The same brand treatment appears on locked, loading, error, success, already-submitted, and staff states.

## Interaction rules

- One dominant action per state.
- Buttons and inputs meet a 48px touch target.
- Name, mobile number, and printed-code inputs have visible labels and field-level error relationships.
- The acknowledgement is a self-contained phone-sized card with the printed eight-digit code, outcome, and screenshot instruction. It never repeats the mobile number or exposes internal data.
- A timeout preserves the current form and request identifier so a retry is safe. A second request with different participant details receives only an already-submitted state.
- Staff sees only code state; participant details are not part of the staff tracker result.

## Responsive and accessible behavior

- Minimum supported viewport: 320px with no horizontal scrolling.
- Public form is one column on narrow screens and a context/form split on wider screens.
- Status meaning is written in text; color and shape are supporting cues only.
- Visible keyboard focus, semantic headings, labels, focusable error summary, readable contrast, increased-zoom support, and reduced-motion treatment are required.
- Slow or interrupted requests preserve a retry path and never show success before the server responds.

## State and privacy presentation

Public counters show only submitted, remaining, and redeemed/claimed counts. The participant form never places name, mobile number, outcome, or code data in a URL. The staff page is protected by server authorization; hiding the `/staff` link is not a security boundary.

There is intentionally no private credential, participant account, social-media verification queue, or transaction form in this simplified design. QR generation and production inventory printing are outside this local implementation.
