/**
 * User Forgot
 *
 * Handle creating a reset token for accounts where the
 * user has forgotten the password.
 */


/* Dependencies */
const Response = require('../../../lib/Response');


/* Hook /api/user/forgot */
module.exports = async function (app, request, response) {
	/* Get authkey and identifiable from database */
	const { _authkey: authkey, email } = await app.storage.get({
		url: `/data/users/email/${request.body.email}/?single=true`,
		session: app.adminSession
	});

	/* Only do stuff if we found a user */
	if (email) {
		/* Only allow sending authkey once every 2 hours */
		/* TODO: Revisit whether this is actually necessary */
		if (authkey) {
			var key = Number.parseInt(authkey.slice(0, Math.max(0, authkey.length - 11)), 16);
			const diff = key - Date.now();

			if (diff > 0) {
				const hours = diff / 60 / 60 / 1000;
				new Response(app, request, response, new SaplingError(`Must wait ${hours.toFixed(1)} hours before sending another recovery email.`));
			}
		}

		/* Make sure key is > Date.now() */
		var key = (Date.now() + 2 * 60 * 60 * 1000).toString(16);
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
		await app.notifications.sendNotification('lostpass', templateData, email);
	}

	/* Respond the same way whether or not we did anything */
	/* If we need to redirect, let's redirect */
	if (request.query.redirect) {
		response.redirect(request.query.redirect);
	} else {
		/* Respond positively */
		new Response(app, request, response);
	}
};
