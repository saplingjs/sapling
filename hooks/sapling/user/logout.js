/**
 * User Logout
 * 
 * Log out the current user.
 */


/* Dependencies */
const Response = require("../../../lib/Response");


/* Hook /api/user/logout */
module.exports = async function(app, req, res) {

	/* Destroy the session */
	req.session.destroy();
	req.session = null;

	/* Redirect if needed, respond otherwise */
	if (req.query.redirect) {
		res.redirect(req.query.redirect);
	} else {
		new Response(app, req, res);
	}

};
