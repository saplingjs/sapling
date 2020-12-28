/**
 * User Login
 * 
 * Attempt to log the user in, and return an error on invalid input,
 * or a success message or redirection on success.
 */


/* Dependencies */
const Hash = require("../../../lib/Hash");

const Response = require("../../../lib/Response");
const SaplingError = require("../../../lib/SaplingError");


/* Hook /api/user/login */
module.exports = async function(app, req, res) {

	/* Find all identifiable fields */
	let identifiables = Object.keys(app.storage.schema.users).filter(field => app.storage.schema.users[field].identifiable);

	/* Figure out which request value is used */
	let identValue = false;
	let identConditions = [];

	if('_identifiable' in req.body) {
		/* If present, use the general _identifiable post value */
		identValue = req.body._identifiable;

		/* Construct conditional selector, where every field marked as identifiable will be checked for the value */
		for(let ident of identifiables) {
			identConditions.push({ [ident]: identValue });
		}
	} else {
		/* Otherwise just check for any other identifiables in the request */
		for(let ident of identifiables) {
			if(ident in req.body) {
				/* Once found, set as the value and storage search condition */
				identValue = req.body[ident];
				identConditions = [ { [ident]: identValue } ];
			}
		}
	}

	/* If identValue wasn't assigned, reject request */
	if (identValue === false) {
		new Response(app, req, res, new SaplingError({
			"status": "401",
			"code": "1001",
			"title": "Invalid Input",
			"detail": "No email address or identifiable provided.",
			"meta": {
				"type": "identifiable",
				"error": "required"
			}
		}));
		return false;
	}

	/* Get the user from storage */
	let data = await app.storage.db.read("users", { '$or': identConditions }, {}, []);

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
	const password = await (new Hash()).hash(req.body.password || "", user._salt);

	/* If the password matches */
	if (user.password === password.toString("base64")) {
		/* Create a user session */
		req.session.user = _.extend({}, user);

		/* Remove the sensitive stuff */
		delete req.session.user.password;
		delete req.session.user._salt;
	
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
	} else {
		/* Otherwise, reply with the user object */
		new Response(app, req, res, null, req.session.user);
	}
};
