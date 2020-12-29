/**
 * User Update
 * 
 * Attempt to edit the details of the currently logged-in
 * user.
 */


/* Dependencies */
const Hash = require("../../../lib/Hash");

const Response = require("../../../lib/Response");
const SaplingError = require("../../../lib/SaplingError");


/* Hook /api/user/update */
module.exports = async function(app, req, res) {

	/* If the user isn't logged in */
	if (!req.session || !req.session.user) {
		new Response(app, req, res, new SaplingError({
			"status": "401",
			"code": "4002",
			"title": "Unauthorized",
			"detail": "You must log in before completing this action.",
			"meta": {
				"type": "login",
				"error": "unauthorized"
			}
		}));
		return false;
	}

	/* If password isn't provided */
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

	/* Get the current user */
	const user = await app.storage.get({
		url: `/data/users/_id/${req.session.user._id}/?single=true`,
		session: req.session
	});
	
	/* Hash the incoming password */
	const password = await (new Hash()).hash(req.body.password, user._salt);

	/* If password is valid, update details */
	if (user.password === password.toString("base64")) {
		/* Delete password field */
		delete req.body.password;

		/* Handle password change */
		if (req.body.new_password) {
			/* Hash and delete the new password */
			const hash = (new Hash()).hash(req.body.new_password);

			/* Add fields to request body */
			req.body._salt = hash[0];
			req.body.password = hash[1];
		}

		/* Delete new password field */
		delete req.body.new_password;

	} else {
		/* Throw error if password didn't match */
		new Response(app, req, res, new SaplingError({
			"status": "422",
			"code": "1009",
			"title": "Incorrect Password",
			"detail": "Value for key `password` did not match the password in the database.",
			"meta": {
				"key": "password",
				"rule": "match"
			}
		}));
		return false;
	}

	/* Send to the database */
	let userData = await app.storage.post({
		url: `/data/users/_id/${user._id}`,
		body: req.body,
		session: req.session
	});

	/* If we need to redirect, let's redirect */
	if (req.query.redirect) {
		res.redirect(req.query.redirect);
	} else {
		/* Clean the output */
		for(let record of userData) {
			delete record.password;
			delete record._salt;
		}
		
		/* Respond with the user object */
		new Response(app, req, res, null, userData);
	}
};
