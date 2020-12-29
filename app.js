/**
 * App
 * 
 * Initialises a Sapling instance and handles incoming requests
 */


/* System dependencies */
const async = require("async");

/* Internal dependencies */
const { console } = require("./lib/Cluster");
const Response = require("./lib/Response");
const Utils = require("./lib/Utils");


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
	constructor(dir, opts, next) {
		/* Global vars */
		this.dir = dir;
		opts = opts || {};
		this.opts = opts;

		/* Define an admin session for big ops */
		this.adminSession = {
			user: { role: "admin" }
		};

		/* Load utility functions */
		this.utils = new Utils(this);

		/* Load everything */
		async.series([
			callback => require('./core/loadConfig').call(this, callback),
			callback => {
				if (opts.loadServer !== false)
					require('./core/loadServer').call(this, opts, callback);
			},
			callback => {
				if (opts.loadModel !== false)
					require('./core/loadModel').call(this, callback);
			},
			callback => {
				if (opts.loadPermissions !== false)
					require('./core/loadPermissions').call(this, callback);
			},
			callback => {
				if (opts.loadController !== false)
					require('./core/loadController').call(this, callback);
			},
			callback => {
				if (opts.loadHooks !== false)
					require('./core/loadHooks').call(this, callback);
			},
			callback => {
				if (opts.loadViews !== false)
					require('./core/loadCustomTags').call(this, callback);
			},
			callback => {
				require('./core/loadModules').call(this, callback);
			},
			callback => {
				if (opts.loadViews !== false) {
					for (const route in this.controller) {
						require('./core/initRoute').call(this, route, this.controller[route]);
					}
				}
	
				if (opts.loadREST !== false)
					require('./core/loadRest').call(this, callback);
			},
			callback => {
				this.server.use((request, response) => {
					new Response(this, request, response, null, false);
				});
				callback();
			},
		], (err, results) => {
			if(err) {
				console.error("Error starting Sapling");
				console.error(err);
				console.error(err.stack);
				return false;
			}

			if(next) next();
		});
	}

	/* Load remaining methods */
	parseMethodRouteKey = require('./core/parseMethodRouteKey')
	runHook = require('./core/runHook')

}

module.exports = App;
