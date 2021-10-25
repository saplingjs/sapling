/**
 * User Login
 *
 * Attempt to log the user in, and return an error on invalid input,
 * or a success message or redirection on success.
 */

/* Dependencies */
import _ from 'underscore';

import Hash from '@sapling/sapling/lib/Hash.js';
import Redirect from '@sapling/sapling/lib/Redirect.js';
import Response from '@sapling/sapling/lib/Response.js';
import SaplingError from '@sapling/sapling/lib/SaplingError.js';


/* Hook /api/user/login */
export default async function login(app, request, response) {
	/* Fetch the user model */
	const rules = app.storage.getRules('users');

	/* Find all identifiable fields */
	const identifiables = Object.keys(rules).filter(field => rules[field].identifiable);

	/* Figure out which request value is used */
	let identValue = false;
	let identConditions = [];

	if ('_identifiable' in request.body) {
		/* If present, use the general _identifiable post value */
		identValue = request.body._identifiable;

		/* Construct conditional selector, where every field marked as identifiable will be checked for the value */
		for (const ident of identifiables) {
			identConditions.push({ [ident]: identValue });
		}
	} else {
		/* Otherwise just check for any other identifiables in the request */
		for (const ident of identifiables) {
			if (ident in request.body) {
				/* Once found, set as the value and storage search condition */
				identValue = request.body[ident];
				identConditions = [{ [ident]: identValue }];
			}
		}
	}

	/* If identValue wasn't assigned, reject request */
	if (identValue === false) {
		return new Response(app, request, response, new SaplingError({
			status: '401',
			code: '1001',
			title: 'Invalid Input',
			detail: 'No email address or identifiable provided.',
			meta: {
				key: 'identifiable',
				rule: 'required',
			},
		}));
	}

	/* Get the user from storage for each identifiable */
	let data = [];
	for (const condition of identConditions) {
		data = data.concat(await app.storage.db.read('users', condition, { limit: 1 }, []));
	}

	/* If no user is found, throw error */
	if (data.length === 0) {
		return new Response(app, request, response, new SaplingError({
			status: '401',
			code: '4001',
			title: 'Invalid User or Password',
			detail: 'Either the user does not exist or the password is incorrect.',
			meta: {
				type: 'login',
				error: 'invalid',
			},
		}));
	}

	/* If no password was provided, throw error */
	if (!request.body.password) {
		return new Response(app, request, response, new SaplingError({
			status: '422',
			code: '1001',
			title: 'Invalid Input',
			detail: 'You must provide a value for key `password`',
			meta: {
				key: 'password',
				rule: 'required',
			},
		}));
	}

	/* Select first result */
	const user = data[0];

	/* Hash the incoming password */
	const password = await new Hash().hash(request.body.password, user._salt);

	/* If the password matches */
	if (user.password === password.toString('base64')) {
		/* Create a user session */
		request.session.user = _.extend({}, user);

		/* Remove the sensitive stuff */
		delete request.session.user.password;
		delete request.session.user._salt;
	} else {
		/* Return an error if the password didn't match */
		return new Response(app, request, response, new SaplingError({
			status: '401',
			code: '4001',
			title: 'Invalid User or Password',
			detail: 'Either the user does not exist or the password is incorrect.',
			meta: {
				type: 'login',
				error: 'invalid',
			},
		}));
	}

	/* If we need to redirect, let's redirect */
	if (!(new Redirect(app, request, response, request.session.user)).do()) {
		/* Otherwise, reply with the user object */
		return new Response(app, request, response, null, request.session.user);
	}
}
