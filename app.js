/**
 * App
 * 
 * Initialises a Sapling instance and handles incoming requests
 */


/* System dependencies */
const path = require("path");
const async = require("async");
const fs = require("fs");
const _ = require("underscore");
const cron = require("cron").CronJob;
const argv = require('yargs').argv;
const routeMatcher = require('path-match')();

/* Server dependencies */
const express = require("express");
const session = require("express-session");
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const logger = require('morgan');
const fileUpload = require('express-fileupload');

/* Internal dependencies */
const { Cluster, console } = require("./lib/Cluster");
const SaplingError = require("./lib/SaplingError");
const Notifications = require("./lib/Notifications");
const Response = require("./lib/Response");
const Storage = require("./lib/Storage");
const Templating = require("./lib/Templating");
const User = require("./lib/User");
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
			callback => this.loadConfig(callback),
			callback => {
				if (opts.loadServer !== false)
					this.loadServer(opts, callback);
			},
			callback => {
				if (opts.loadModel !== false)
					this.loadModel(callback);
			},
			callback => {
				if (opts.loadPermissions !== false)
					this.loadPermissions(callback);
			},
			callback => {
				if (opts.loadController !== false)
					this.loadController(callback);
			},
			callback => {
				if (opts.loadHooks !== false)
					this.loadHooks(callback);
			},
			callback => {
				if (opts.loadViews !== false)
					this.loadCustomTags(callback);
			},
			callback => {
				this.loadModules(callback);
			},
			callback => {
				if (opts.loadViews !== false) {
					for (const route in this.controller) {
						this.initRoute(route, this.controller[route]);
					}
				}
	
				if (opts.loadREST !== false)
					this.loadREST(callback);
			},
			callback => {
				this.server.use((req, res) => {
					new Response(this, req, res, null, false);
				});
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

	/*
	* Load the configuration data. Should exist in a file
	* called "config" and must be valid JSON.
	*/
	async loadConfig(next) {
		/* Default configuration values */
		const defaultConfig = {
			"staticDir": "public",
			"modelsDir": "models",
			"viewsDir": "views",
			"hooksDir": "hooks",
			"autoRouting": true,
			"routes": "routes.json",
			"hooks": "hooks.json",
			"extension": "html",
			"secret": this.utils.randString(),
			"showError": true,
			"strict": false,
			"production": "auto",
			"db": {
				"driver": "Memory"
			},
			"render": {
				"driver": "HTML"
			},
			"sessionStore": {
				"type": null,
				"options": {}
			},
			"mail": {
				"type": "SMTP",
				"service": "Gmail",
				"auth": {
					user: process.env.MAIL_USER,
					password: process.env.MAIL_PASS
				}
			},
			"upload": {
				"type": "local",
				"destination": "public/uploads"
			},
			"port": argv.port || this.opts.port || 3000,
			"url": ""
		};

		this.config = {};
		Object.assign(this.config, defaultConfig);

		/* Location of the configuration */
		const configPath = path.join(this.dir, "config.json");

		/* Load the configuration */
		if(fs.existsSync(configPath)) {
			/* If we have a config file, let's load it */
			let file = fs.readFileSync(configPath);

			/* Parse and merge the config, or throw an error if it's malformed */
			try {
				const c = JSON.parse(file.toString());
				_.extend(this.config, c);
			} catch (e) {
				console.error("Error loading config");
				console.error(e, e.stack);
			}
		} else {
			/* If not, let's add a fallback */
			_.extend(this.config, {"name": "untitled"});
		}

		/* Detect production environment */
		if(this.config.production === "auto") {
			this.config.production = process.env.NODE_ENV === "production";
		}

		/* Figure out automatic CORS */
		if(!('cors' in this.config)) {
			this.config.cors = !this.config.production;
		}

		console.log("Production mode is", this.config.production);
		console.log("CORS is", this.config.cors);

		/* Set other config based on production */
		if(this.config.production === true || this.config.production === "on") {
			/* Check if there's a separate production config */
			const prodConfigPath = path.join(this.dir, `config.${process.env.NODE_ENV}.json`);
			
			if(fs.existsSync(prodConfigPath)) {
				/* If we have a config file, let's load it */
				let file = fs.readFileSync(prodConfigPath);

				this.config = {};
				Object.assign(this.config, defaultConfig);
	
				/* Parse and merge the config, or throw an error if it's malformed */
				try {
					const pc = JSON.parse(file.toString());
					_.extend(this.config, pc);
				} catch (e) {
					console.error("Error loading production config");
					console.error(e, e.stack);
				}
			}

			/* Set immutable production vars */
			this.config.strict = true;
			this.config.showError = false;
		}

		console.log("CONFIG", this.config);

		/* Set the app name */
		this.name = this.config.name;

		next();
	}

	/**
	 * Configure the Express server from the config data.
	 * 
	 * @param {function} next Chain callback
	 */
	loadServer({reload, listen}, next) {
		let server;
		let self = this;

		if (reload && this.server) {
			this.routeStack = {'get': [], 'post': [], 'delete': []};
			//this.server.routes = server._router.map;
			//this.server.stack.length = 2;
		} else {
			server = express();
			this.routeStack = {'get': [], 'post': [], 'delete': []};
		}


		/* Use the app secret from config, or generate one if needed */
		let secret = this.config.secret || (this.config.secret = this.utils.randString());
		server.use(cookieParser(secret));


		/* Allow file uploads */
		server.use(fileUpload({
			useTempFiles: true
		}));

		/* Ensure the upload directory exists */
		this.uploadDir = path.join(this.dir, this.config.upload.destination);
		if (!fs.existsSync(this.uploadDir)){
			fs.mkdirSync(this.uploadDir);
		}


		/* Persist sessions through reload */
		if (!server.sessionHandler) {
			/* Set session options */
			let sessionConfig = {
				secret, 
				resave: false,
				saveUninitialized: true,
				cookie: {maxAge: null}
			};

			/* If we've defined a type, load it */
			if('type' in this.config.sessionStore && this.config.sessionStore.type !== null) {
				/* TODO: Potentially find a way to support additional setup code */
				/* i.e. connect-redis ^4.0.0 requires an external Redis client */
				const store = require(this.config.sessionStore.type)(session);
				sessionConfig.store = new store(this.config.sessionStore.options);
			}

			/* Create session handler */
			server.sessionHandler = session(sessionConfig);
		}
		server.use(server.sessionHandler);


		/* Handle the directory for our static resources */
		/* TODO: Make into a recursive function to reduce duplicated code */
		if (this.config.staticDir !== false) {
			/* If it's a string, surface it */
			if(typeof this.config.staticDir === 'string') {
				const staticDirDir = path.join(this.dir, this.config.staticDir);
				server.use(`/${this.config.staticDir}`, express.static(staticDirDir, { maxAge: 1 }));
			}

			/* If it's an array, loop through it */
			if(typeof this.config.staticDir === 'object') {
				this.config.staticDir.forEach(staticDir => {
					const staticDirDir = path.join(self.dir, staticDir);
					server.use(`/${staticDir}`, express.static(staticDirDir, { maxAge: 1 }));
				});
			}
		}

		server.use(bodyParser.urlencoded({ extended: true }));
		server.use(bodyParser.json());
		server.use(logger(Cluster.logger));

		/* Enable the /data data interface */
		server.use("/data/", ({method}, res, n) => {
			/* Send CORS headers if explicitly enabled in config */
			if(self.config.cors === true) {
				res.header("Access-Control-Allow-Origin", "*");
				res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
				res.header("Access-Control-Allow-Headers", "Content-Type");
			}

			/* Handle preflight requests */
			if (method === "OPTIONS") {
				return res.sendStatus(200);
			}

			n();
		});

		/* Define the /api interface */
		server.use("/api/", (req, res, n) => {
			/* Send CORS headers if explicitly enabled in config */
			if(self.config.cors) {
				res.header("Access-Control-Allow-Origin", "*");
				res.header("Access-Control-Allow-Methods", "GET,POST");
				res.header("Access-Control-Allow-Headers", "Content-Type");
			}

			n();
		});
		
		/* Start listening on the given port */
		if (listen !== false) {
			Cluster.listening(this.config.port);
			server.http = server.listen(this.config.port);
		}

		this.server = server;
		next();
	}


	/**
	 * Load the controller JSON file.
	 * 
	 * @param {function} next Chain callback
	 */
	async loadController(next) {
		/* Load templating engine */
		this.templating = new Templating(this);

		/* Location of the controller file */
		const controllerPath = path.join(this.dir, this.config.routes);

		this.controller = {};

		/* Generate a controller from the available views */
		if(this.config.autoRouting === 'on' || this.config.autoRouting === true) {
			const viewsPath = path.join(this.dir, this.config.viewsDir);

			if(fs.existsSync(viewsPath)) {
				/* Load all views in the views directory */
				const views = this.utils.getFiles(viewsPath);

				/* Go through each view */
				for (let i = 0; i < views.length; ++i) {
					const segments = views[i].split('/');

					/* Filter out the views where any segment begins with _ */
					const protectedSegments = segments.filter(item => {
						var re = /^\_/;
						return re.test(item);
					});

					if(protectedSegments.length)
						continue;
					
					/* Filter out any files that do not use the correct file extension */
					if(views[i].split('.').slice(-1)[0] !== this.config.extension)
						continue;
					
					/* Filter out filesystem bits */
					const view = views[i].replace(path.resolve(this.dir, this.config.viewsDir), '').replace(`.${this.config.extension}`, '');
					let route = view.replace('/index', '');

					/* Make sure root index is a slash and not an empty key */
					if(route === '')
						route = '/';

					/* Create an automatic GET route for a given view */
					this.controller[route] = view.replace(/^\/+/g, '');
				}
			}
		}

		/* Load the controller file */
		if(fs.existsSync(controllerPath)) {
			/* If we have a controller file, let's load it */
			let file = fs.readFileSync(controllerPath);

			/* Parse and merge the controller, or throw an error if it's malformed */
			try {
				let routes = JSON.parse(file.toString());

				/* Remove file extension */
				Object.keys(routes).forEach(route => {
					routes[route] = routes[route].split('.').slice(0, -1).join('.');
				});

				/* Merge routes if autorouting, replace routes if not */
				if(this.config.autoRouting === "on" || this.config.autoRouting === true) {
					Object.assign(this.controller, routes);
				} else {
					this.controller = routes;
				}
			} catch (e) {
				console.error(`Controller at path: \`${controllerPath}\` could not be loaded.`, e);
			}
		}

		console.log("CONTROLLER", this.controller);

		/* Next stage of the setup */
		next();
	}


	/**
	 * Load the hooks JSON file.
	 * 
	 * @param {function} next Chain callback
	 */
	async loadHooks(next) {
		/* Location of the hooks file */
		const hooksPath = path.join(this.dir, this.config.hooks);

		this.hooks = {};

		/* Load the hooks file */
		if(fs.existsSync(hooksPath)) {
			/* If we have a hooks file, let's load it */
			let file = fs.readFileSync(hooksPath);

			/* Parse and merge the hooks, or throw an error if it's malformed */
			try {
				let hooks = JSON.parse(file.toString());

				/* Set exported functions as object values */
				for(let hook of Object.keys(hooks)) {
					let { method, route } = this.parseMethodRouteKey(hook);

					this.hooks[`${method.toUpperCase()} ${route}`] = require(path.join(this.dir, this.config.hooksDir, hooks[hook]));

					/* Initialise hook if it doesn't exist in the controller */
					/* TODO: make this condition neater */
					if(!(route in this.controller) && !route.startsWith('/data') && !route.startsWith('data')) {
						/* Listen on */
						this.server[method](route, async (req, res) => {
							/* Run a hook, if it exists */
							await this.runHook(method, route, req, res, null, () => {
								new Response(this, req, res, null);
							});
						});

						/* Save the route for later */
						this.routeStack[method].push(route);
					}
				}
			} catch (e) {
				console.error(`Hooks could not be loaded.  Make sure all hook files exist.`, e);
			}
		}

		console.log("HOOKS", Object.keys(this.hooks));

		/* Next stage of the setup */
		next();
	}


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
	async runHook(method, route, req, res, data, next) {
		console.log("Finding hooks for ", method, route);

		let found = false;

		/* Go through all hook definitions */
		for(let hook of Object.keys(this.hooks)) {
			/* Get hook definition route */
			let { method: hookMethod, route: hookRoute } = this.parseMethodRouteKey(hook);

			/* If the route and method match, run the hook */
			if (routeMatcher(hookRoute)(route) !== false && hookMethod.toLowerCase() == method.toLowerCase()) {
				await this.hooks[hook](this, req, res, data, next);
				found = true;
				break;
			}
		}

		/* Return whatever was found */
		if(!found) next(this, req, res, data);
	}


	/**
	 * Load the model structures and initialise
	 * the storage instance for this app.
	 * 
	 * @param {function} next Chain callback
	 */
	loadModel(next) {
		const modelPath = path.join(this.dir, this.config.modelsDir);
		let structure = {};

		if(fs.existsSync(modelPath)) {
			/* Load all models in the model directory */
			let files = fs.readdirSync(modelPath);

			/* Go through each model */
			for (let i = 0; i < files.length; ++i) {
				const file = files[i].toString();
				const table = file.split(".")[0];

				if (table == "") {
					files.splice(i--, 1);
					continue; 
				}

				const model = fs.readFileSync(path.join(modelPath, file));

				/* Read the model JSON into the structure */
				try {
					structure[table] = JSON.parse(model.toString());
				} catch (e) {
					console.error("Error parsing model `%s`", table);
				}
			}

			this.structure = structure;
		} else {
			console.warn(`Models at path \`${modelPath}\` does not exist`);

			this.structure = {};
		}

		/* Create a storage instance based on the models */
		this.storage = new Storage(this, {
			name: this.name, 
			schema: this.structure,
			config: this.config,
			dir: this.dir
		});

		if(next) next();
	}


	/**
	 * Parse a string with a method and route into their
	 * constituent parts.
	 * 
	 * @param {string} key 
	 */
	parseMethodRouteKey(key) {
		let obj = {
			method: false,
			route: false
		}

		/* Format expected: "GET /url/here" */
		const parts = key.split(" ");

		/* Behave differently based on the number of segments */
		switch(parts.length) {
			case 1:
				/* Default to get */
				obj.method = "get";
				/* Assume the only part is the URL */
				obj.route = parts[0];
				break;

			case 2:
				/* First part is the method: get, post, delete */
				obj.method = parts[0].toLowerCase();
				/* Second part is the URL */
				obj.route = parts[1];
				break;

			default:
				break;
		}

		/* TODO: send an error if the method isn't an acceptable method */
		/* TODO: send an error if the route isn't in a plausible format */

		return obj;
	}


	/**
	 * Load the permissions file, and implement the middleware
	 * to validate the permission before continuing to the
	 * route handler.
	 * 
	 * @param {function} next Chain callback
	 */
	loadPermissions(next) {
		/* Load the permissions file */
		/* TODO: Provide fallback in case the file is missing or mangled */
		const permissionsPath = path.join(this.dir, "permissions.json");
		this.permissions = {};
		let perms = {};

		try {
			perms = JSON.parse(fs.readFileSync(permissionsPath));
		} catch (e) {
			console.warn(`Permissions at path: ${permissionsPath} not found.`);
		}

		/* Loop over the urls in permissions */
		Object.keys(perms).forEach(url => {
			/* Format expected: "GET /url/here" */
			let { method, route } = this.parseMethodRouteKey(url);

			if(!route)
				return false;

			/* The minimum role level required for this method+route combination */
			let perm = perms[url];

			if(typeof perms[url] === 'string') {
				/* If it's a string, convert it to object */
				perm = { role: [ perms[url] ], redirect: false };

			} else if(Array.isArray(perms[url])) {
				/* If it's an array, convert it to object */
				perm = { role: perms[url], redirect: false };

			} else if(typeof perms[url] === 'object' && perms[url] !== null) {
				/* If it's an object, ensure it's proper */
				if(!('role' in perms[url])) {
					throw new SaplingError(`Permission setting for ${url} is missing a role`);
				}
				if(!(typeof perms[url].role === 'string' || Array.isArray(perms[url].role))) {
					throw new SaplingError(`Permission setting for ${url} is malformed`);
				}
				if(typeof perms[url].role === 'string') {
					perm = { role: [ perms[url].role ], redirect: perms[url].redirect };
				}

			} else {
				/* If it's something else, we don't want it */
				throw new SaplingError(`Permission setting for ${url} is malformed`);
			}

			/* Save to object */
			this.permissions[url] = perm;
			
			/* Default method is `all`. */
			if (!["get", "post", "delete"].includes(method)) {
				method = "all";
			}

			/* Create middleware for each particular method+route combination */
			this.server[method](route, (req, res, next) => {
				console.log("PERMISSION", method, route, perm);

				/* Save for later */
				req.permission = perm;

				/* If the current route is not allowed for the current user, display an error */
				if (!this.user.isUserAllowed(req.permission.role, req.session.user)) {
					if(req.permission.redirect) {
						res.redirect(req.permission.redirect);
					} else {
						new Response(this, req, res, new SaplingError("You do not have permission to complete this action."));
					}
				} else next();
			});
			
		});
	
		if(next) next();
	}


	/**
	 * Initialise the given route; load and render the view,
	 * create the appropriate listeners.
	 * 
	 * @param {string} route Name of the route to be loaded
	 * @param {function} view Chain callback
	 */
	initRoute(route, view) {
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
					new Response(this.app, req, res, html);
				} else {
					new Response(this.app, req, res, null, html);
				}
			});
		};

		/* Listen on both GET and POST with the same handler */
		this.server.get(route, handler);
		this.server.post(route, handler);

		/* Save the routes for later */
		this.routeStack.get.push(route);
		this.routeStack.post.push(route);
	}


	/**
	 * Setup custom tags into the template parser to
	 * return data from the storage engine.
	 *
	 * @param {function} view Chain callback
	 */
	async loadCustomTags(next) {
		const self = this;
		await this.templating.renderer.registerTags({

			/**
			 * Set a template variable with data from a given
			 * data API URL.  The driver implementation must 
			 * handle assigning the return value to a template
			 * variable.
			 * 
			 * @param {string} url Data API URL
			 * @param {string} role Optional user role, defaults to current user role
			 */
			async get(url, role) {
				/* See if this url has a permission associated */
				const baseurl = url.split("?")[0];
				const permission = self.user.getRolesForRoute("get", baseurl);

				/* If no role is provided, use current */
				const session = role ? { user: { role } } : this.data.session;

				/* Check permission */
				const allowed = self.user.isUserAllowed(permission, session.user);
				console.log("IS ALLOWED", session, allowed, permission)

				/* Not allowed so give an empty array */
				if (!allowed) {
					return [];
				}

				/* Request the data */
				return await self.storage.get({
					url, 
					permission: { role: permission }, 
					session
				});
			}
		});

		next();
	}


	/**
	 * Setup the endpoints for the /data interface
	 *
	 * @param {function} view Chain callback
	 */
	loadREST(next) {
		/* Direct user creation to a special case endpoint */
		this.server.post(/\/data\/users\/?$/, (req, res) => {
			this.runHook("post", "/api/user/register", req, res);
		});

		/* Otherwise, send each type of query to be handled by Storage */
		this.server.get("/data/*", async (req, res) => {
			/* Get data */
			const data = await this.storage.get(req, res);

			/* Run hooks, then send data */
			await this.runHook("get", req.originalUrl, req, res, data, (app, req, res, data) => {
				if(data)
					new Response(this, req, res, null, data || []);
				else
					new Response(this, req, res, new SaplingError("Something went wrong"));
			});
		});
		this.server.post("/data/*", async (req, res) => {
			/* Send data */
			const data = await this.storage.post(req, res);

			/* Run hooks, then send data */
			await this.runHook("post", req.originalUrl, req, res, data, (app, req, res, data) => {
				if(data)
					new Response(this, req, res, null, data || []);
				else
					new Response(this, req, res, new SaplingError("Something went wrong"));
			});
		});
		this.server.delete("/data/*", async (req, res) => {
			/* Delete data */
			const data = await this.storage.delete(req, res);

			/* Run hooks, then send data */
			await this.runHook("delete", req.originalUrl, req, res, null, (app, req, res, data) => {
				if(data)
					new Response(this, req, res, null, data || []);
				else
					new Response(this, req, res, new SaplingError("Something went wrong"));
			});
		});

		next();
	}


	/**
	 * Load all separate modules as needed
	 *
	 * @param {function} view Chain callback
	 */
	loadModules(next) {
		this.user = new User(this);

		if(this.config.mail)
			this.notifications = new Notifications(this);

		next();
	}


	/**
	 * Reload the whole server (get new views, config, etc)
	 */
	reload() {
		console.log(`\n\n**** RESTARTING ****\n\n`);
	
		/* Don't attempt to listen on the same port again */
		this.opts.listen = false;
		this.opts.reload = true;

		/* Restart the server */
		App.call(this, this.config.name, this.opts, () => {
			console.log("RESTARTED");
		});
	}
}

module.exports = App;
