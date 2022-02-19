/**
 * App
 *
 * Initialises a Sapling instance and handles incoming requests
 */

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
			user: { role: 'admin' },
		};

		/* Load utility functions */
		this.utils = new Utils(this);

		/* Load everything */
		async.series([
			async callback => {
				const { default: loadConfig } = await import('./core/loadConfig.js');
				await loadConfig.call(this, callback);
			},
			async callback => {
				if (options.loadServer !== false) {
					const { default: loadServer } = await import('./core/loadServer.js');
					await loadServer.call(this, options, callback);
				}
			},
			async callback => {
				if (options.loadModel !== false) {
					const { default: loadModel } = await import('./core/loadModel.js');
					await loadModel.call(this, callback);
				}
			},
			async callback => {
				if (options.loadPermissions !== false) {
					const { default: loadPermissions } = await import('./core/loadPermissions.js');
					await loadPermissions.call(this, callback);
				}
			},
			async callback => {
				if (options.loadController !== false) {
					const { default: loadController } = await import('./core/loadController.js');
					await loadController.call(this, callback);
				}
			},
			async callback => {
				if (options.loadHooks !== false) {
					const { default: loadHooks } = await import('./core/loadHooks.js');
					await loadHooks.call(this, callback);
				}
			},
			async callback => {
				if (options.loadViews !== false) {
					const { default: loadCustomTags } = await import('./core/loadCustomTags.js');
					await loadCustomTags.call(this, callback);
				}
			},
			async callback => {
				const { default: loadModules } = await import('./core/loadModules.js');
				await loadModules.call(this, callback);
			},
			async callback => {
				if (options.loadViews !== false) {
					for (const route in this.controller) {
						if (Object.prototype.hasOwnProperty.call(this.controller, route)) {
							const { default: initRoute } = await import('./core/initRoute.js');
							await initRoute.call(this, route, this.controller[route]);
						}
					}
				}

				if (options.loadREST !== false) {
					const { default: loadRest } = await import('./core/loadRest.js');
					await loadRest.call(this, callback);
				}
			},
			callback => {
				this.server.use((request, response) => {
					new Response(this, request, response, null, false);
				});
				callback();
			},
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
