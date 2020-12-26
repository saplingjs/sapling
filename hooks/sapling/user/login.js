/**
 * User Login
 * 
 * Attempt to log the user in, and return an error on invalid input,
 * or a success message or redirection on success.
 */


/* Dependencies */
const Response = require("../../../lib/Response");
const SaplingError = require("../../../lib/SaplingError");


/* Hook /api/user/login */
module.exports = async function(app, req, res) {

	/* Get the user from storage */
	let data = await app.storage.db.read("users", { email: req.body.email }, {}, []);

	/* If no user is found, throw error */
	if (!data.length) { 
		new Response(app, req, res, new SaplingError({
			"status": "401",
			"code": "4001",
			"title": "Invalid User or Password",
			"detail": "Either the user does not exist or the password is incorrect.",
			"meta": {
				"type": "login",
				"error": "invalid"
			}
		}));
		return false;
	}

	/* If no password was provided, throw error */
	if (!req.body.password) {
		new Response(app, req, res, new SaplingError({
			"status": "422",
			"code": "1001",
			"title": "Invalid Input",
			"detail": "You must provide a value for key `password`",
			"meta": {
				"key": "password",
				"rule": "required"
			}
		}));
		return false;
	}

	/* Select first result */
	const user = data[0];

	/* Hash the incoming password */
	const password = await Hash.hash(req.body.password || "", user._salt);

	/* If the password matches */
	if (user.password === password.toString("base64")) {
		/* Create a user session */
		req.session.user = _.extend({}, user);

		/* Remove the sensitive stuff */
		delete req.session.user.password;
		delete req.session.user._salt;

		/* Return the user object if there's no redirection */
		if(!req.query.redirect)
			new Response(app, req, res, null, req.session.user);
	
	} else {
		/* Return an error if the password didn't match */
		new Response(app, req, res, new SaplingError({
			"status": "401",
			"code": "4001",
			"title": "Invalid User or Password",
			"detail": "Either the user does not exist or the password is incorrect.",
			"meta": {
				"type": "login",
				"error": "invalid"
			}
		}));
		return false;
	}

	/* If we need to redirect, let's redirect */
	if (req.query.redirect) {
		res.redirect(req.query.redirect);
	}
};
