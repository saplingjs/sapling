/**
 * User Logout
 *
 * Log out the current user.
 */


/* Dependencies */
const Response = require('../../../lib/Response');


/* Hook /api/user/logout */
module.exports = async function (app, request, res) {
	/* Destroy the session */
	request.session.destroy();
	request.session = null;

	/* Redirect if needed, respond otherwise */
	if (request.query.redirect) {
		res.redirect(request.query.redirect);
	} else {
		new Response(app, request, res);
	}
};
