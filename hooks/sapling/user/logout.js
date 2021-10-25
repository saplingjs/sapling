/**
 * User Logout
 *
 * Log out the current user.
 */

/* Dependencies */
import Redirect from '@sapling/sapling/lib/Redirect.js';
import Response from '@sapling/sapling/lib/Response.js';


/* Hook /api/user/logout */
export default async function logout(app, request, response) {
	/* Destroy the session */
	request.session.destroy();
	request.session = null;

	/* Redirect if needed, respond otherwise */
	if (!(new Redirect(app, request, response)).do()) {
		return new Response(app, request, response);
	}
}
