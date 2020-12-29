/**
 * Initialise route
 */


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
module.exports = async function initRoute(route, view) {
	console.log("Loaded route ", `${route}`)
	
	/* Create a handler for incoming requests */
	const handler = async (req, res) => {
		/* Run a hook, if it exists */
		await this.runHook("get", route, req, res, null, async () => {
			let html = await this.templating.renderView(
				view, 
				{}, 
				req, 
				res
			);

			if(html instanceof SaplingError) {
				new Response(this, req, res, html);
			} else {
				new Response(this, req, res, null, html);
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
