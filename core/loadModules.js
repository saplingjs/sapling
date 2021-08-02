/**
 * Load modules
 */

'use strict';


/* Dependencies */
import Notifications from '../lib/Notifications.js';
import Uploads from '../lib/Uploads.js';
import User from '../lib/User.js';


/**
 * Load all separate modules as needed
 *
 * @param {function} next Chain callback
 */
export default async function loadModules(next) {
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
}
