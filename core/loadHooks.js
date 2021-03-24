/**
 * Load hooks
 */

'use strict';


/* Dependencies */
const fs = require('fs');
const path = require('path');

const { console } = require('../lib/Cluster');
const Response = require('../lib/Response');
const SaplingError = require('../lib/SaplingError');


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
		let file = null;
		let hooks = {};

		/* Read the hooks file, or throw an error if it can't be done */
		try {
			file = fs.readFileSync(hooksPath);
		} catch {
			throw new SaplingError(`Hooks at ${hooksPath} could not be read.`);
		}

		/* Parse the hooks, or throw an error if it's malformed */
		try {
			hooks = JSON.parse(file.toString());
		} catch {
			throw new SaplingError(`Hooks at ${hooksPath} could not be parsed.`);
		}

		/* Set exported functions as object values */
		for (const hook of Object.keys(hooks)) {
			const { method, route } = this.parseMethodRouteKey(hook);

			this.hooks[`${method} ${route}`] = require(path.join(this.dir, this.config.hooksDir, hooks[hook]));

			/* Initialise hook if it doesn't exist in the controller */
			if (!(route in this.controller) && !route.startsWith('/data') && !route.startsWith('data')) {
				/* Listen on */
				this.server[method](route, async (request, response) => {
					/* Run a hook, if it exists */
					return await this.runHook(method, route, request, response, null, () => {
						return new Response(this, request, response, null);
					});
				});

				/* Save the route for later */
				this.routeStack[method].push(route);
			}
		}
	}

	console.log('HOOKS', Object.keys(this.hooks));

	if (next) {
		next();
	}
};
