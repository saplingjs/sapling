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

/* Server dependencies */
const express = require("express");
const session = require("express-session");
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const logger = require('morgan');

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
				if (opts.loadViews !== false)
					this.loadHook(callback);
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
			"models": "models",
			"views": "views",
			"autoRouting": "auto",
			"controller": "routes.json",
			"extension": "html",
			"secret": this.utils.randString(),
			"staticDir": "public",
			"cacheViews": true,
			"showError": true,
			"strict": false,
			"production": "auto",
			"db": {
				"type": "Memory"
			},
			"render": {
				"type": "HTML"
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
			"aws": {
				"region": "us-west-2"
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
			this.config.autoRouting = false;
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


		/* Persist sessions through reload */
		if (!server.sessionHandler) {
			/* TODO: Implement non-Redis store  */
			const sessionStore = null;

			server.sessionHandler = session({
				store: sessionStore,
				secret, 
				resave: false,
				saveUninitialized: true,
				cookie: {maxAge: null}
			});
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
		const controllerPath = path.join(this.dir, this.config.controller);

		this.controller = {};

		/* Generate a controller from the available views */
		if(this.config.autoRouting === "on" || this.config.autoRouting === "auto" || this.config.autoRouting === true) {
			const viewsPath = path.join(this.dir, this.config.views);

			if(fs.existsSync(viewsPath)) {
				/* Load all views in the views directory */
				const views = this.utils.getFiles(viewsPath);

				/* Go through each view */
				for (let i = 0; i < views.length; ++i) {
					const segments = views[i].split("/");

					/* Filter out the views where any segment begins with _ */
					const protectedSegments = segments.filter(item => {
						var re = /^\_/;
						return re.test(item);
					});

					if(protectedSegments.length)
						continue;
					
					/* Filter out filesystem bits */
					const view = views[i].replace(path.resolve(this.dir, this.config.views), "").replace(`.${this.config.extension}`, "");
					const route = view.replace("/index", "");

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
				if(this.config.autoRouting === "on") {
					Object.assign(this.controller, JSON.parse(file.toString()));
				} else {
					this.controller = JSON.parse(file.toString());
				}
			} catch (e) {
				console.error(`Controller at path: \`${controllerPath}\` could not be loaded.`);
			}
		}

		console.log("CONTROLLER", this.controller);

		/* Next stage of the setup */
		next();
	}

	/**
	 * Load the model structures and initialise
	 * the storage instance for this app.
	 * 
	 * @param {function} next Chain callback
	 */
	loadModel(next) {
		const modelPath = path.join(this.dir, this.config.models);
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
		const perms = fs.readFileSync(permissionsPath);

		/* Try to parse it into JSON */
		try {
			this.permissions = JSON.parse(perms);
		} catch (e) {
			console.error(`permissions at path: [${permissionsPath}] not found.`);
			console.error(e);
			console.error(e.stack);
		}

		/* Loop over the urls in permissions */
		Object.keys(this.permissions).forEach(url => {
			/* Format expected: "GET /url/here" */
			const parts = url.split(" ");

			/* If we have more than two bits, skip it */
			if (parts.length < 2) {
				return;
			}

			/* First part is the method: get, post, delete */
			let method = parts[0].toLowerCase();
			/* Second part is the URL */
			const route = parts[1];

			/* The minimum role level required for this method+route combination */
			const role = this.permissions[url];
			
			/* default method is `all`. */
			if (!["get", "post", "delete"].includes(method)) {
				method = "all";
			}

			/* Create middleware for each particular method+route combination */
			this.server[method](route, (req, res, next) => {
				console.log("PERMISSION", method, route, role);

				/* If the current route is not allowed for the current user, display an error */
				if (!this.user.isUserAllowed(req.permission, req.session.user)) {
					new Response(this, req, res, [{message: "You do not have permission to complete this action."}]);
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
		const self = this;
		const handler = (req, res) => {
			self.templating.renderView(
				view, 
				{}, 
				req, 
				res
			);
		};

		/* Listen on both GET and POST with the same handler */
		this.server.get(route, handler);
		this.server.post(route, handler);

		/* Save the routes for later */
		this.routeStack.get.push(route);
		this.routeStack.post.push(route);
	}


	/**
	 * Setup hooks into the template parser to
	 * return data from the storage engine.
	 *
	 * @param {function} view Chain callback
	 */
	loadHook(next) {
		const self = this;
		this.hooks = {
			get(block, next) {
				//pause parsing and decode request
				const expr = block.expr.split(" ");
				
				const url = expr[0];
				let role = expr[1];
				// as = expr[2]
				let key = expr[3];
				
				// if role has been left out, use current user or stranger
				if (role == 'as') {
					role = false;
					key = expr[2];
				}

				const baseurl = url.split("?")[0];
				
				// see if this url has a permission associated
				const permission = self.user.getRoleForRoute("get", baseurl);

				// if no role is provided, use current
				const session = role ? { user: { role } } : this.data.session;

				const allowed = self.user.isUserAllowed(permission, session.user);
				console.log("IS ALLOWED", session, allowed, permission)

				// not allowed so give an empty array
				if (!allowed) {
					this.saveDots(key, []);
					return next();
				}

				//request the data then continue parsing
				self.storage.get({
					url, 
					permission, 
					session
				}, (err, data) => {
					if(err)
						console.error(err);

					this.saveDots(key, data);
					next();
				});
			},

			post(block, next) {
				// pause parsing and decode request
				const expr = block.expr.split(" ");
				
				const url = expr[0];
				const body = expr[1];
				let role = expr[2];
				// as = expr[3]
				let key = expr[4];

				// role has been left out
				if (role == 'as') {
					role = false;
					key = expr[3];
				}

				const baseurl = url.split("?")[0];
				
				// see if this url has a permission associated
				const permission = self.user.getRoleForRoute("post", baseurl);
				const session = role ? { user: { role } } : this.data.session;
				const allowed = self.user.isUserAllowed(permission, session.user);

				// not allowed so give an empty array
				if (!allowed) {
					return next();
				}

				// request the data then continue parsing
				self.storage.post({
					url: baseurl,
					body: this.extractDots(body),
					permission, 
					session
				}, (err, data) => {
					if(err)
						console.error(err);

					if (key) {
						this.saveDots(key, data);
					}

					next();
				});
			},

			debug({rawExpr, end}, next) {
				const value = this.extractDots(rawExpr);
				this.pieces.push(`<pre>${JSON.stringify(value, null, '\t')}</pre>`);
				this.start = end + 1;
				next();
			},

			redirect({expr}, next) {
				this.onredirect && this.onredirect.call(this, expr);
				return false;
			},

			error({expr}, next) {
				this.onerror && this.onerror.call(this, expr);
				return false;
			},

			json({rawExpr}, next) {
				const data = this.extractDots(rawExpr);
				this.onjson && this.onjson.call(this, data);
				return false;
			}
		};

		next();
	}


	/**
	 * Setup the endpoints for the /data interface
	 *
	 * @param {function} view Chain callback
	 */
	loadREST(next) {
		/* Direct user creation to a special case endpoint */
		this.server.post(/\/data\/users\/?$/, this.user.register);

		/* Otherwise, send each type of query to be handled by Storage */
		this.server.get("/data/*", async (req, res) => {
			const data = await this.storage.get(req, res);
			if(data)
				new Response(this, req, res, null, data);
			else
				new Response(this, req, res, new SaplingError("Something went wrong"));
		});
		this.server.post("/data/*", async (req, res) => {
			const data = await this.storage.post(req, res);
			if(data)
				new Response(this, req, res, null, data);
			else
				new Response(this, req, res, new SaplingError("Something went wrong"));
		});
		this.server.delete("/data/*", async (req, res) => {
			const data = await this.storage.delete(req, res);
			if(data)
				new Response(this, req, res, null, data);
			else
				new Response(this, req, res, new SaplingError("Something went wrong"));
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
