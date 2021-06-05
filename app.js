/**
 * App
 *
 * Initialises a Sapling instance and handles incoming requests
 */

'use strict';


/* System dependencies */
import async from 'async';

/* Internal dependencies */
import { console } from './lib/Cluster.js';
import Response from './lib/Response.js';
import Utils from './lib/Utils.js';

import parseMethodRouteKey from './core/parseMethodRouteKey.js';
import runHook from './core/runHook.js';


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
			async callback => (await import('./core/loadConfig.js')).default.call(this, callback),
			async callback => {
				if (options.loadServer !== false) {
					(await import('./core/loadServer.js')).default.call(this, options, callback);
				}
			},
			async callback => {
				if (options.loadModel !== false) {
					(await import('./core/loadModel.js')).default.call(this, callback);
				}
			},
			async callback => {
				if (options.loadPermissions !== false) {
					(await import('./core/loadPermissions.js')).default.call(this, callback);
				}
			},
			async callback => {
				if (options.loadController !== false) {
					(await import('./core/loadController.js')).default.call(this, callback);
				}
			},
			async callback => {
				if (options.loadHooks !== false) {
					(await import('./core/loadHooks.js')).default.call(this, callback);
				}
			},
			async callback => {
				if (options.loadViews !== false) {
					(await import('./core/loadCustomTags.js')).default.call(this, callback);
				}
			},
			async callback => {
				(await import('./core/loadModules.js')).default.call(this, callback);
			},
			async callback => {
				if (options.loadViews !== false) {
					for (const route in this.controller) {
						if ({}.hasOwnProperty.call(this.controller, route)) {
							(await import('./core/initRoute.js')).default.call(this, route, this.controller[route]);
						}
					}
				}

				if (options.loadREST !== false) {
					(await import('./core/loadRest.js')).default.call(this, callback);
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
	parseMethodRouteKey = parseMethodRouteKey;
	runHook = runHook;
}

export default App;
