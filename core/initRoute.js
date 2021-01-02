/**
 * Initialise route
 */

'use strict';


/* Dependencies */
const Response = require('../lib/Response');
const SaplingError = require('../lib/SaplingError');


/**
 * Initialise the given route; load and render the view,
 * create the appropriate listeners.
 *
 * @param {string} route Name of the route to be loaded
 * @param {function} view Chain callback
 */
module.exports = async function (route, view) {
	console.log('Loaded route', `${route}`);

	/* Create a handler for incoming requests */
	const handler = async (request, response) => {
		/* Run a hook, if it exists */
		await this.runHook('get', route, request, response, null, async () => {
			const html = await this.templating.renderView(view, {}, request);

			if (html instanceof SaplingError) {
				new Response(this, request, response, html);
			} else {
				new Response(this, request, response, null, html);
			}
		});
	};

	/* Listen on both GET and POST with the same handler */
	this.server.get(route, handler);
	this.server.post(route, handler);

	/* Save the routes for later */
	this.routeStack.get.push(route);
	this.routeStack.post.push(route);
};
