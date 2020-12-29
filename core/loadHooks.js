/**
 * Load hooks
 */


/* Dependencies */
const fs = require('fs');
const path = require('path');

const { console } = require('../lib/Cluster');
const Response = require('../lib/Response');


/**
 * Load the hooks JSON file, and listen to non-data API hooks.
 *
 * @param {function} next Chain callback
 */
module.exports = async function (next) {
	/* Location of the hooks file */
	const hooksPath = path.join(this.dir, this.config.hooks);

	this.hooks = {};

	/* Load the hooks file */
	if (fs.existsSync(hooksPath)) {
		/* If we have a hooks file, let's load it */
		const file = fs.readFileSync(hooksPath);

		/* Parse and merge the hooks, or throw an error if it's malformed */
		try {
			const hooks = JSON.parse(file.toString());

			/* Set exported functions as object values */
			for (const hook of Object.keys(hooks)) {
				const { method, route } = this.parseMethodRouteKey(hook);

				this.hooks[`${method.toUpperCase()} ${route}`] = require(path.join(this.dir, this.config.hooksDir, hooks[hook]));

				/* Initialise hook if it doesn't exist in the controller */
				if (!(route in this.controller) && !route.startsWith('/data') && !route.startsWith('data')) {
					/* Listen on */
					this.server[method](route, async (request, response) => {
						/* Run a hook, if it exists */
						await this.runHook(method, route, request, response, null, () => {
							new Response(this, request, response, null);
						});
					});

					/* Save the route for later */
					this.routeStack[method].push(route);
				}
			}
		} catch (error) {
			console.error('Hooks could not be loaded.  Make sure all hook files exist.', error);
		}
	}

	console.log('HOOKS', Object.keys(this.hooks));

	/* Next stage of the setup */
	next();
};
