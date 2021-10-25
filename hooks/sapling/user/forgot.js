/**
 * User Forgot
 *
 * Handle creating a reset token for accounts where the
 * user has forgotten the password.
 */

/* Dependencies */
import { console } from '@sapling/sapling/lib/Cluster.js';
import Redirect from '@sapling/sapling/lib/Redirect.js';
import Response from '@sapling/sapling/lib/Response.js';
import SaplingError from '@sapling/sapling/lib/SaplingError.js';
import Validation from '@sapling/sapling/lib/Validation.js';


/* Hook /api/user/forgot */
export default async function forgot(app, request, response) {
	/* Check email for format */
	const errors = new Validation().validate(request.body.email, 'email', { email: true, required: true });
	if (errors.length > 0) {
		return new Response(app, request, response, new SaplingError(errors));
	}

	/* Get authkey and identifiable from database */
	const { email } = await app.storage.get({
		url: `/data/users/email/${request.body.email}/?single=true`,
		session: app.adminSession,
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
			session: app.adminSession,
		});

		/* Data for recovery email */
		const templateData = {
			name: app.name,
			key,
			url: app.config.url,
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
	if (!(new Redirect(app, request, response)).do()) {
		/* Respond positively */
		return new Response(app, request, response);
	}
}
