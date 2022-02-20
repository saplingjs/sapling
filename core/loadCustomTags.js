/**
 * Load custom tags
 */

/**
 * Setup custom tags into the template parser to
 * return data from the storage engine.
 *
 * @param {function} next Chain callback
 */
export default async function loadCustomTags(next) {
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
			const permission = this.user.getRolesForRoute('get', baseurl);

			/* If no role is provided, use current */
			const session = role ? { user: { role } } : ((this.data && this.data.session) || {});

			/* Check permission */
			const allowed = this.user.isUserAllowed(permission, session.user || {});

			/* Not allowed so give an empty array */
			if (!allowed) {
				return this.storage.formatResponse([]);
			}

			/* Request the data */
			return await this.storage.get({
				url,
				permission: { role: permission },
				session,
			});
		},
	});

	if (next) {
		next();
	}
}
