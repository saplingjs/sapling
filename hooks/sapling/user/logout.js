/**
 * User Logout
 *
 * Log out the current user.
 */

'use strict';


/* Dependencies */
import Response from '@sapling/sapling/lib/Response.js';


/* Hook /api/user/logout */
export default async function logout(app, request, response) {
	/* Destroy the session */
	request.session.destroy();
	request.session = null;

	/* Redirect if needed, respond otherwise */
	if (request.query.redirect) {
		response.redirect(request.query.redirect);
	} else {
		return new Response(app, request, response);
	}
}
