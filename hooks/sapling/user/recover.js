/**
 * User Recover
 *
 * Handle recovering a user account.
 */

/* Dependencies */
import Hash from '@sapling/sapling/lib/Hash.js';

import Redirect from '@sapling/sapling/lib/Redirect.js';
import Response from '@sapling/sapling/lib/Response.js';
import SaplingError from '@sapling/sapling/lib/SaplingError.js';


/* Hook /api/user/recover */
export default async function recover(app, request, response) {
	/* If the new password has not been provided, throw error */
	if (!request.body.new_password) {
		return new Response(app, request, response, new SaplingError({
			status: '422',
			code: '1001',
			title: 'Invalid Input',
			detail: 'You must provide a value for key `new_password`',
			meta: {
				key: 'password',
				rule: 'required',
			},
		}));
	}

	/* If the new password does not match rules, throw error  */
	const validation = app.request.validateData({
		body: { password: request.body.new_password },
		collection: 'users',
		type: 'filter',
	}, response);

	if (validation.length > 0) {
		return new Response(app, request, response, new SaplingError(validation));
	}

	/* If the auth key has not been provided, throw error */
	if (!request.body.auth) {
		return new Response(app, request, response, new SaplingError({
			status: '422',
			code: '1001',
			title: 'Invalid Input',
			detail: 'You must provide a value for key `auth`',
			meta: {
				key: 'auth',
				rule: 'required',
			},
		}));
	}

	/* Check key time */
	let key = request.body.auth;
	key = Number.parseInt(key.slice(0, Math.max(0, key.length - 11)), 16);

	const diff = key - Date.now();

	/* If the key has expired, show error */
	if (Number.isNaN(diff) || diff <= 0) {
		return new Response(app, request, response, new SaplingError({
			status: '401',
			code: '4003',
			title: 'Authkey Expired',
			detail: 'The authkey has expired and can no longer be used.',
			meta: {
				type: 'recover',
				error: 'expired',
			},
		}));
	}

	/* Get users matching the key with admin privs */
	const user = await app.storage.get({
		url: `/data/users/_authkey/${request.body.auth}/?single=true`,
		session: app.adminSession,
	});

	/* If there is no such user */
	if (!user) {
		return new Response(app, request, response, new SaplingError({
			status: '401',
			code: '4004',
			title: 'Authkey Invalid',
			detail: 'The authkey could not be located in the database.',
			meta: {
				type: 'recover',
				error: 'invalid',
			},
		}));
	}

	/* Hash and delete the new password */
	const hash = await new Hash().hash(request.body.new_password);
	delete request.body.new_password;

	/* Update the new password and clear the key */
	const { data: userData } = await app.storage.post({
		url: `/data/users/_id/${user._id}`,
		body: { password: hash[1], _salt: hash[0], _authkey: '' },
		session: app.adminSession,
	});

	/* Clean the output */
	if (userData.length > 0) {
		if ('password' in userData[0]) {
			delete userData[0].password;
		}

		if ('_salt' in userData[0]) {
			delete userData[0]._salt;
		}
	}

	/* If we need to redirect, let's redirect */
	if (!(new Redirect(app, request, response, userData)).do()) {
		/* Respond with the user object */
		return new Response(app, request, response, null, userData);
	}
}
