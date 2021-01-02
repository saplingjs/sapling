/**
 * Notifications
 *
 * Sending email notifications to the end user
 */

'use strict';


/* Dependencies */
const _ = require('underscore');
const path = require('path');

const { console } = require('./Cluster');
const SaplingError = require('./SaplingError');
const Templating = require('./Templating');
const Validation = require('./Validation');

const frontMatter = require('front-matter');
const nodemailer = require('nodemailer');


/**
 * The Notifications class
 */
module.exports = class Notifications {
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

		/* Don't send type to nodemailer */
		const type = this.config.type;
		delete this.config.type;

		/* Create mailer if we have the necessary config */
		if (this.config.auth.username && this.config.auth.password) {
			this.mailer = nodemailer.createTransport(type, this.config);
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
			html = await this.templating.renderer.render(`${template}.${this.app.config.extension}`, data);

			/* Parse front matter */
			meta = frontMatter(html);
		} catch (error) {
			console.error(`Could not load notification template \`${template}\`.`, error);
		}

		/* Check the email address is proper */
		const errors = new Validation().validateEmail(recipient, 'recipient', { email: true });
		if (errors.length > 0) {
			console.error(new SaplingError(`Cannot send notification: ${recipient} is not a valid email address`));
			return true;
		}

		/* Send notification */
		if (this.mailer) {
			return this.mailer.sendMail({
				to: recipient,
				subject: meta.attributes.subject || 'Message',
				html: meta.body
			});
		}

		console.error(new SaplingError('Cannot send notification: mail.auth.username and mail.auth.password not set'));
		return true;
	}
};
