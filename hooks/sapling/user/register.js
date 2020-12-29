/**
 * User Register
 *
 * Create a new user.
 */


/* Dependencies */
const Hash = require('../../../lib/Hash');

const Response = require('../../../lib/Response');


/* Hook /api/user/register */
module.exports = async function (app, request, res) {
	/* Error collection */
	const err = [];

	/* If a role is specified, check the current user is allowed to create it */
	if (request.session.user) {
		if (request.body.role && !app.storage.inheritRole(request.session.user.role, request.body.role)) {
			err.push({ message: `Do not have permission to create the role \`${request.body.role}\`.` });
		}
	} else if (request.body.role) {
		err.push({ message: `Do not have permission to create the role \`${request.body.role}\`.` });
	}

	/* If no email is given */
	if (!request.body.email) {
		err.push({
			status: '422',
			code: '1001',
			title: 'Invalid Input',
			detail: 'You must provide a value for key `email`',
			meta: {
				key: 'email',
				rule: 'required'
			}
		});
	}

	/* If no password is given */
	if (!request.body.password) {
		err.push({
			status: '422',
			code: '1001',
			title: 'Invalid Input',
			detail: 'You must provide a value for key `password`',
			meta: {
				key: 'password',
				rule: 'required'
			}
		});
	}

	/* Show the above errors, if any */
	if (err.length) {
		new Response(app, request, res, new SaplingError(err));
		return false;
	}

	/* Hash the password, and add it to the request */
	const hash = await new Hash().hash(request.body.password);
	request.body._salt = hash[0];
	request.body.password = hash[1];

	/* Remove all possible confirmation fields */
	delete request.body.password2;
	delete request.body.confirm_password;
	delete request.body.password_confirm;

	/* Save to the database */
	const userData = await app.storage.post({
		url: '/data/users',
		session: request.session,
		permission: request.permission,
		body: request.body
	}, res);

	/* If we successfully saved it */
	if (userData) {
		/* Clean the output */
		for (const record of userData) {
			delete record.password;
			delete record._salt;
		}

		console.log('REGISTER', err, userData);

		/* If we need to redirect, let's redirect */
		if (request.query.redirect) {
			res.redirect(request.query.redirect);
		} else {
			/* Respond with the user object */
			new Response(app, request, res, null, userData);
		}
	}
};
