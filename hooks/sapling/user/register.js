/**
 * User Register
 *
 * Create a new user.
 */

'use strict';


/* Dependencies */
const _ = require('underscore');

const { console } = require('../../../lib/Cluster');
const Hash = require('../../../lib/Hash');
const Response = require('../../../lib/Response');
const SaplingError = require('../../../lib/SaplingError');


/* Hook /api/user/register */
module.exports = async function (app, request, response) {
	/* Error collection */
	const errors = [];

	/* If a role is specified, check the current user is allowed to create it */
	if (request.session.user) {
		if (request.body.role && !app.user.isRoleAllowed(request.session.user.role, request.body.role)) {
			errors.push({ message: `Do not have permission to create the role \`${request.body.role}\`.` });
		}
	} else if (request.body.role) {
		errors.push({ message: `Do not have permission to create the role \`${request.body.role}\`.` });
	}

	/* If no email is given */
	if (!request.body.email) {
		errors.push({
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
		errors.push({
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

	/* Validate for format */
	/* Doing this here because by the time we do it Storage, the password's been hashed */
	const validation = app.storage.validateData(_.extend(request, { collection: 'users' }), response);

	/* Show the above errors, if any */
	const combinedErrors = [...errors, ...validation];
	if (combinedErrors.length > 0) {
		return new Response(app, request, response, new SaplingError(combinedErrors));
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
	}, response);

	/* If post() already gave a response */
	if (userData instanceof Response) {
		return userData;
	}

	/* Clean the output */
	for (const record of userData) {
		delete record.password;
		delete record._salt;
	}

	console.log('REGISTER', errors, userData);

	/* If we need to redirect, let's redirect */
	if (request.query.redirect) {
		response.redirect(request.query.redirect);
	} else {
		/* Respond with the user object */
		return new Response(app, request, response, null, userData);
	}
};
