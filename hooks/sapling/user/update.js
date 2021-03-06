/**
 * User Update
 *
 * Attempt to edit the details of the currently logged-in
 * user.
 */

'use strict';


/* Dependencies */
const Hash = require('../../../lib/Hash');

const Response = require('../../../lib/Response');
const SaplingError = require('../../../lib/SaplingError');


/* Hook /api/user/update */
module.exports = async function (app, request, response) {
	/* If the user isn't logged in */
	if (!request.session || !request.session.user) {
		return new Response(app, request, response, new SaplingError({
			status: '401',
			code: '4002',
			title: 'Unauthorized',
			detail: 'You must log in before completing this action.',
			meta: {
				type: 'login',
				error: 'unauthorized'
			}
		}));
	}

	/* If password isn't provided */
	if (!request.body.password) {
		return new Response(app, request, response, new SaplingError({
			status: '422',
			code: '1001',
			title: 'Invalid Input',
			detail: 'You must provide a value for key `password`',
			meta: {
				key: 'password',
				rule: 'required'
			}
		}));
	}

	/* Get the current user */
	const user = await app.storage.get({
		url: `/data/users/_id/${request.session.user._id}/?single=true`,
		session: request.session
	});

	/* Hash the incoming password */
	const password = await new Hash().hash(request.body.password, user._salt);

	/* If password is valid, update details */
	if (user.password === password.toString('base64')) {
		/* Delete password field */
		delete request.body.password;

		/* Handle password change */
		if (request.body.new_password) {
			/* Hash and delete the new password */
			const hash = await new Hash().hash(request.body.new_password);

			/* Add fields to request body */
			request.body._salt = hash[0];
			request.body.password = hash[1];
		}

		/* Delete new password field */
		delete request.body.new_password;
	} else {
		/* Throw error if password didn't match */
		return new Response(app, request, response, new SaplingError({
			status: '422',
			code: '1009',
			title: 'Incorrect Password',
			detail: 'Value for key `password` did not match the password in the database.',
			meta: {
				key: 'password',
				rule: 'match'
			}
		}));
	}

	/* Send to the database */
	const userData = await app.storage.post({
		url: `/data/users/_id/${user._id}`,
		body: request.body,
		session: request.session
	});

	/* If we need to redirect, let's redirect */
	if (request.query.redirect) {
		response.redirect(request.query.redirect);
	} else {
		/* Clean the output */
		for (const record of userData) {
			delete record.password;
			delete record._salt;
		}

		/* Respond with the user object */
		return new Response(app, request, response, null, userData);
	}
};
