/**
 * App
 *
 * Initialises a Sapling instance and handles incoming requests
 */

'use strict';


/* System dependencies */
const async = require('async');

/* Internal dependencies */
const { console } = require('./lib/Cluster.js');
const Response = require('./lib/Response.js');
const Utils = require('./lib/Utils.js');


/**
 * The App class
 */
class App {
	/**
	 * Load and construct all aspects of the app
	 *
	 * @param {string} dir Directory for the site files
	 * @param {object} opts Optional options to override the defaults and filesystem ones
	 * @param {function} next Callback after initialisation
	 */
	constructor(dir, options, next) {
		/* Global vars */
		this.dir = dir;
		options = options || {};
		this.opts = options;

		/* Define an admin session for big ops */
		this.adminSession = {
			user: { role: 'admin' }
		};

		/* Load utility functions */
		this.utils = new Utils(this);

		/* Load everything */
		async.series([
			callback => require('./core/loadConfig.js').call(this, callback),
			callback => {
				if (options.loadServer !== false) {
					require('./core/loadServer.js').call(this, options, callback);
				}
			},
			callback => {
				if (options.loadModel !== false) {
					require('./core/loadModel.js').call(this, callback);
				}
			},
			callback => {
				if (options.loadPermissions !== false) {
					require('./core/loadPermissions.js').call(this, callback);
				}
			},
			callback => {
				if (options.loadController !== false) {
					require('./core/loadController.js').call(this, callback);
				}
			},
			callback => {
				if (options.loadHooks !== false) {
					require('./core/loadHooks.js').call(this, callback);
				}
			},
			callback => {
				if (options.loadViews !== false) {
					require('./core/loadCustomTags.js').call(this, callback);
				}
			},
			callback => {
				require('./core/loadModules.js').call(this, callback);
			},
			callback => {
				if (options.loadViews !== false) {
					for (const route in this.controller) {
						if ({}.hasOwnProperty.call(this.controller, route)) {
							require('./core/initRoute.js').call(this, route, this.controller[route]);
						}
					}
				}

				if (options.loadREST !== false) {
					require('./core/loadRest.js').call(this, callback);
				}
			},
			callback => {
				this.server.use((request, response) => {
					new Response(this, request, response, null, false);
				});
				callback();
			}
		], error => {
			if (error) {
				console.error('Error starting Sapling');
				console.error(error);
				console.error(error.stack);
				return false;
			}

			if (next) {
				next();
			}
		});
	}

	/* Load remaining methods */
	parseMethodRouteKey = require('./core/parseMethodRouteKey.js');
	runHook = require('./core/runHook.js');
}

module.exports = App;
