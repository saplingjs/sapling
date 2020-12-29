/**
 * Run hook
 */


/* Dependencies */
const routeMatcher = require('path-match')();


/**
 * Run any registered hook that matches the given method
 * and route.  Returns null if no hook found, otherwise
 * returns what the hook returns.
 *
 * @param {string} method Method of the route being tested
 * @param {string} route Route being tested
 * @param {string} req Request object
 * @param {string} res Response object
 * @param {string} data Data, if any
 * @param {function} next Callback for after the hook
 */
module.exports = async function runHook(method, route, request, res, data, next) {
	console.log('Finding hooks for', method, route);

	let found = false;

	/* Go through all hook definitions */
	for (const hook of Object.keys(this.hooks)) {
		/* Get hook definition route */
		const { method: hookMethod, route: hookRoute } = this.parseMethodRouteKey(hook);

		/* If the route and method match, run the hook */
		if (routeMatcher(hookRoute)(route) !== false && hookMethod.toLowerCase() == method.toLowerCase()) {
			await this.hooks[hook](this, request, res, data, next);
			found = true;
			break;
		}
	}

	/* Return whatever was found */
	if (!found) {
		next(this, request, res, data);
	}
};
