/**
 * User Logged In Status
 *
 * Fetch whether the user is currently logged in or not.  Returns false
 * if the user isn't logged in, or the user object if they are.
 */

'use strict';


/* Dependencies */
const _ = require('underscore');

const Response = require('@sapling/sapling/lib/Response');


/* Hook /api/user/logged */
module.exports = async function (app, request, response) {
	/* If session exists */
	if (request.session && request.session.user) {
		/* Get the user from storage */
		const user = await app.storage.get({
			url: `/data/users/_id/${request.session.user._id}/?single=true`,
			session: request.session
		});

		/* Set the user session */
		request.session.user = _.extend({}, user);

		/* Remove sensitive fields */
		delete request.session.user.password;
		delete request.session.user._salt;

		/* Respond with the user object */
		return new Response(app, request, response, null, request.session.user);
	}

	/* If no session, return empty object */
	return new Response(app, request, response, null, {});
};
