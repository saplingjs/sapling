/**
 * User Forgot
 *
 * Handle creating a reset token for accounts where the
 * user has forgotten the password.
 */

'use strict';


/* Dependencies */
const { console } = require('@sapling/sapling/lib/Cluster');
const Response = require('@sapling/sapling/lib/Response');
const SaplingError = require('@sapling/sapling/lib/SaplingError');
const Validation = require('@sapling/sapling/lib/Validation');


/* Hook /api/user/forgot */
module.exports = async function (app, request, response) {
	/* Check email for format */
	const errors = new Validation().validate(request.body.email, 'email', { email: true, required: true });
	if (errors.length > 0) {
		return new Response(app, request, response, new SaplingError(errors));
	}

	/* Get authkey and identifiable from database */
	const { email } = await app.storage.get({
		url: `/data/users/email/${request.body.email}/?single=true`,
		session: app.adminSession
	});

	/* Only do stuff if we found a user */
	if (email) {
		/* Make sure key is > Date.now() */
		let key = (Date.now() + (2 * 60 * 60 * 1000)).toString(16);
		key += app.utils.randString();

		/* Save key for later */
		await app.storage.post({
			url: `/data/users/email/${request.body.email}`,
			body: { _authkey: key },
			session: app.adminSession
		});

		/* Data for recovery email */
		const templateData = {
			name: app.name,
			key,
			url: app.config.url
		};

		/* Send authkey via email */
		try {
			await app.notifications.sendNotification('lostpass', templateData, email);
		} catch (error) {
			console.error(new SaplingError(error));
		}
	}

	/* Respond the same way whether or not we did anything */
	/* If we need to redirect, let's redirect */
	if (request.query.redirect) {
		response.redirect(request.query.redirect);
	} else {
		/* Respond positively */
		return new Response(app, request, response);
	}
};
