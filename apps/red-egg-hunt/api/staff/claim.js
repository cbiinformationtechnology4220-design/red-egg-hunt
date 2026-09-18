import { runStaffApiHandler } from '../../server/staffHttp.js';

export default function staffClaimHandler(request, response) {
  return runStaffApiHandler(request, response, { method: 'POST', mutating: true }, async ({ runtime, principal, body }) => (
    runtime.staff.claim(principal, body)
  ));
}
