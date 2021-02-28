/**
 * Load modules
 */

'use strict';


/* Dependencies */
const Notifications = require('../lib/Notifications');
const User = require('../lib/User');


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

	if (next) {
		next();
	}
};
