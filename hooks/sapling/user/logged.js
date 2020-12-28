/**
 * User Logged In Status
 * 
 * Fetch whether the user is currently logged in or not.  Returns false
 * if the user isn't logged in, or the user object if they are.
 */


/* Dependencies */
const Response = require("../../../lib/Response");
const SaplingError = require("../../../lib/SaplingError");


/* Hook /api/user/logged */
module.exports = async function(app, req, res) {

	/* If session exists */
	if (req.session && req.session.user) {
		/* Get the user from storage */
		app.storage.get({
			url: `/data/users/_id/${req.session.user._id}/?single=true`,
			session: req.session
		}, (err, user) => {
			if(err) {
				new Response(app, req, res, new SaplingError(err));
				return false;
			}

			/* Set the user session */
			req.session.user = _.extend({}, user);

			/* Remove sensitive fields */
			delete req.session.user.password;
			delete req.session.user._salt;

			/* Respond with the user object */
			new Response(app, req, res, null, req.session.user);
		});
	} else {
		/* If no session, return empty object */
		new Response(app, req, res, null, {});
	}
};
