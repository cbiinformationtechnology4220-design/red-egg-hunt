import { runStaffApiHandler } from '../../server/staffHttp.js';

export default function staffCodeHandler(request, response) {
  return runStaffApiHandler(request, response, { method: 'POST' }, async ({ runtime, principal, body }) => (
    runtime.staff.lookup(principal, body)
  ));
}
