/**
 * Load custom tags
 */

'use strict';


/**
 * Setup custom tags into the template parser to
 * return data from the storage engine.
 *
 * @param {function} next Chain callback
 */
module.exports = async function (next) {
	const self = this;
	await this.templating.renderer.registerTags({

		/**
		 * Set a template variable with data from a given
		 * data API URL.  The driver implementation must
		 * handle assigning the return value to a template
		 * variable.
		 *
		 * @param {string} url Data API URL
		 * @param {string} role Optional user role, defaults to current user role
		 */
		async get(url, role) {
			/* See if this url has a permission associated */
			const baseurl = url.split('?')[0];
			const permission = self.user.getRolesForRoute('get', baseurl);

			/* If no role is provided, use current */
			const session = role ? { user: { role } } : this.data.session;

			/* Check permission */
			const allowed = self.user.isUserAllowed(permission, session.user);
			console.log('IS ALLOWED', session, allowed, permission);

			/* Not allowed so give an empty array */
			if (!allowed) {
				return [];
			}

			/* Request the data */
			return await self.storage.get({
				url,
				permission: { role: permission },
				session
			});
		}
	});

	next();
};
