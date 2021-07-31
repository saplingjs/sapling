/**
 * Notifications
 *
 * Sending email notifications to the end user
 */

'use strict';


/* Dependencies */
import _ from 'underscore';
import path from 'path';

import SaplingError from './SaplingError.js';
import Templating from './Templating.js';
import Validation from './Validation.js';

import frontMatter from 'front-matter';
import nodemailer from 'nodemailer';


/**
 * The Notifications class
 */
export default class Notifications {
	/**
	 * Initialise the Notifications class
	 *
	 * @param {object} App The App instance
	 */
	constructor(App) {
		this.app = App;

		/* Create a Templating instance */
		this.templating = new Templating(this.app, path.join(this.app.dir, 'static/mail'));

		/* Load the config */
		this.config = _.extend({}, this.app.config.mail);

		/* Create mailer if we have the necessary config */
		if (this.config.host && this.config.auth.user && this.config.auth.pass) {
			this.mailer = nodemailer.createTransport(this.config);
		}
	}


	/**
	 * Send a notification in the available method(s)
	 *
	 * @param {string} template Name of the notification template
	 * @param {object} data Data that will be injected into the template
	 * @param {string} recipient Email address of the recipient
	 */
	async sendNotification(template, data, recipient) {
		let html = '';
		let meta = {};

		try {
			/* Read template */
			html = await this.templating.renderView(template, data);

			/* Parse front matter */
			meta = frontMatter(html);
		} catch (error) {
			throw new SaplingError(`Could not load notification template \`${template}\`.`, error);
		}

		/* Check the email address is proper */
		const errors = new Validation().validateEmail(recipient, 'recipient', { email: true });
		if (errors.length > 0) {
			throw new SaplingError(`Cannot send notification: ${recipient} is not a valid email address`);
		}

		/* Send notification */
		if (this.mailer) {
			return this.mailer.sendMail({
				to: recipient,
				subject: meta.attributes.subject || 'Message',
				html: meta.body
			});
		}

		throw new SaplingError('Cannot send notification: mail host or authentication not set');
	}
}
