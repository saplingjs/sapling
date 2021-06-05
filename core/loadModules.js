/**
 * Load modules
 */

'use strict';


/* Dependencies */
const Notifications = require('../lib/Notifications.js');
const Uploads = require('../lib/Uploads.js');
const User = require('../lib/User.js');


/**
 * Load all separate modules as needed
 *
 * @param {function} next Chain callback
 */
module.exports = async function (next) {
	this.user = new User(this);

	if (this.config.mail) {
		this.notifications = new Notifications(this);
	}

	if (this.config.upload) {
		this.uploads = new Uploads(this);
	}

	if (next) {
		next();
	}
};
