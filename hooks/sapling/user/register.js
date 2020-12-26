/**
 * User Register
 * 
 * Create a new user.
 */


/* Dependencies */
const Response = require("../../../lib/Response");


/* Hook /api/user/register */
module.exports = async function(app, req, res) {

	/* Error collection */
	const err = [];
	
	/* If a role is specified, check the current user is allowed to create it */
	if (req.session.user) {
		if (req.body.role && !this.app.storage.inheritRole(req.session.user.role, req.body.role)) {
			err.push({message: `Do not have permission to create the role \`${req.body.role}\`.`})
		}
	} else {
		if (req.body.role) {
			err.push({message: `Do not have permission to create the role \`${req.body.role}\`.`})
		}
	}
	
	/* If no email is given */
	if (!req.body.email) {
		err.push({
			"status": "422",
			"code": "1001",
			"title": "Invalid Input",
			"detail": "You must provide a value for key `email`",
			"meta": {
				"key": "email",
				"rule": "required"
			}
		});
	}
	
	/* If no password is given */
	if (!req.body.password) {
		err.push({
			"status": "422",
			"code": "1001",
			"title": "Invalid Input",
			"detail": "You must provide a value for key `password`",
			"meta": {
				"key": "password",
				"rule": "required"
			}
		});
	}
	
	/* Show the above errors, if any */
	if (err.length) { 
		new Response(this.app, req, res, new SaplingError(err));
		return false;
	}
	
	/* Hash the password, and add it to the request */
	const hash = await Hash.hash(req.body.password, user._salt);
	req.body._salt = hash[0];
	req.body.password = hash[1];

	/* Remove all possible confirmation fields */
	if(req.body.password2)
		delete req.body.password2;
	if(req.body.confirm_password)
		delete req.body.confirm_password;
	if(req.body.password_confirm)
		delete req.body.password_confirm;

	/* Save to the database */
	let userData = await this.app.storage.post({
		url: "/data/users",
		session: req.session,
		permission: req.permission,
		body: req.body
	});

	/* Clean the output */
	if (userData) {
		if(userData.password) delete userData.password;
		if(userData._salt) delete userData._salt;
	}

	console.log("REGISTER", err, data);

	/* Respond with the user object */
	new Response(app, req, res, null, userData);
};
