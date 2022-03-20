/**
 * Load hooks
 */

/* Dependencies */
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { console } from '../lib/Cluster.js';
import Response from '../lib/Response.js';
import SaplingError from '../lib/SaplingError.js';


/**
 * Digest hooks files
 *
 * @returns {object} Hooks
 */
export async function digest() {
	/* Location of the hooks file */
	const hooksPath = path.join(this.dir, this.config.hooks);

	const formattedHooks = {};

	/* Load the hooks file */
	if (await this.utils.exists(hooksPath)) {
		/* If we have a hooks file, let's load it */
		let file = null;
		let hooks = {};

		/* Read the hooks file, or throw an error if it can't be done */
		try {
			file = await fs.readFile(hooksPath);
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
			const { default: hookMethod } = await import(path.join(this.dir, this.config.hooksDir, hooks[hook]));
			formattedHooks[`${method} ${route}`] = hookMethod;
		}
	}

	return formattedHooks;
}


/**
 * Load the hooks JSON file, and listen to non-data API hooks.
 *
 * @param {function} next Chain callback
 */
export default async function loadHooks(next) {
	/* Digest hooks */
	this.hooks = await digest.call(this);

	for (const hook of Object.keys(this.hooks)) {
		const { method, route } = this.parseMethodRouteKey(hook);

		/* Initialise hook if it doesn't exist in the controller */
		if (!(route in this.controller) && !route.startsWith('/data') && !route.startsWith('data')) {
			/* Listen on */
			this.server[method](route, async (request, response) =>
				/* Run a hook, if it exists */
				await this.runHook(method, route, request, response, null, () => new Response(this, request, response, null)),
			);

			/* Save the route for later */
			this.routeStack[method].push(route);
		}
	}

	console.log('HOOKS', Object.keys(this.hooks));

	if (next) {
		next();
	}
}
