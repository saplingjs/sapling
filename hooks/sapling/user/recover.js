/**
 * User Recover
 *
 * Handle recovering a user account.
 */


/* Dependencies */
const Hash = require('../../../lib/Hash');

const Response = require('../../../lib/Response');
const SaplingError = require('../../../lib/SaplingError');


/* Hook /api/user/recover */
module.exports = async function (app, request, response) {
	/* If the auth key has not been provided, throw error */
	if (!request.query.auth) {
		new Response(app, request, response, new SaplingError({
			status: '422',
			code: '1001',
			title: 'Invalid Input',
			detail: 'You must provide a value for key `auth`',
			meta: {
				key: 'auth',
				rule: 'required'
			}
		}));
		return false;
	}

	/* Check key time */
	let key = request.query.auth;
	key = Number.parseInt(key.slice(0, Math.max(0, key.length - 11)), 16);

	const diff = key - Date.now();

	/* If the key has expired, show error */
	if (Number.isNaN(diff) || diff <= 0) {
		new Response(app, request, response, new SaplingError({
			status: '401',
			code: '4003',
			title: 'Authkey Expired',
			detail: 'The authkey has expired and can no longer be used.',
			meta: {
				type: 'recover',
				error: 'expired'
			}
		}));
		return false;
	}

	/* Get users matching the key with admin privs */
	const user = await app.storage.get({
		url: `/data/users/_authkey/${request.query.auth}/?single=true`,
		session: App.adminSession
	});

	/* If there is no such user */
	if (!user) {
		new Response(app, request, response, new SaplingError({
			status: '401',
			code: '4004',
			title: 'Authkey Invalid',
			detail: 'The authkey could not be located in the database.',
			meta: {
				type: 'recover',
				error: 'invalid'
			}
		}));
		return false;
	}

	/* Hash and delete the new password */
	/* TODO: Validate against password rules in the model */
	const hash = new Hash().hash(request.body.new_password);
	delete request.body.new_password;

	/* Update the new password and clear the key */
	const userData = await app.storage.post({
		url: `/data/users/_id/${user._id}`,
		body: { password: hash[1], _salt: hash[0], _authkey: '' },
		session: App.adminSession
	});

	/* If we need to redirect, let's redirect */
	if (request.query.redirect) {
		response.redirect(request.query.redirect);
	} else {
		/* Clean the output */
		if (userData) {
			if (userData.password) {
				delete userData.password;
			}

			if (userData._salt) {
				delete userData._salt;
			}
		}

		/* Respond with the user object */
		new Response(app, request, response, null, userData);
	}
};
