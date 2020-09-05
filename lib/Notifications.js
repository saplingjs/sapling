/**
 * Notifications
 * 
 * Sending 
 */

'use strict';

const _ = require("underscore");
const fs = require('fs');
const nodemailer = require('nodemailer');
const path = require('path');

module.exports = class Notifications {

	forgotTemplateHTML = "";

	constructor(App) {
		this.app = App;

		/* Load the config */
		this.config = _.extend({}, this.app.config.mail);

		/* Don't send type to nodemailer */
		const type = this.config.type;
		delete this.config.type;

		/* Create mailer if we have the necessary config */
		if(this.config.auth.username && this.config.auth.password)
			this.mailer = nodemailer.createTransport(type, this.config);
		
		this.renderTemplates();
	}


	/**
	 * Load and render all notification templates
	 */
	renderTemplates() {
		this.forgotTemplateHTML = _.template(fs.readFileSync(path.join(this.app.dir, "/static/mail/lostpass.html")).toString());
	}


	/**
	 * Send a notification in the available method(s)
	 * 
	 * @param  {...any} args Sender arguments
	 */
	sendNotification(...args) {
		return this.mailer.sendMail(...args);
	}
};
