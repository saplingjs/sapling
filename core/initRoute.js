/**
 * Initialise route
 */

/* Dependencies */
import { console } from '../lib/Cluster.js';
import Response from '../lib/Response.js';
import SaplingError from '../lib/SaplingError.js';


/**
 * Initialise the given route; load and render the view,
 * create the appropriate listeners.
 *
 * @param {string} route Name of the route to be loaded
 * @param {function} view Chain callback
 */
export default async function initRoute(route, view) {
	console.log('Loaded route', `${route}`);

	/* Create a handler for incoming requests */
	const handler = async (request, response) =>
		/* Run a hook, if it exists */
		await this.runHook('get', route, request, response, null, async () => {
			const html = await this.templating.renderView(view, {}, request);

			return html instanceof SaplingError ? new Response(this, request, response, html) : new Response(this, request, response, null, html);
		});

	/* Listen on both GET and POST with the same handler */
	this.server.get(route, handler);
	this.server.post(route, handler);

	/* Save the routes for later */
	this.routeStack.get.push(route);
	this.routeStack.post.push(route);
}
