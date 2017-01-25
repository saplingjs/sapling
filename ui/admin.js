var ff = require("ff");
var path = require("path");
var Validation = require("../lib/Validation");

var connection = require("riak-js");

var allowedConfigKeys = [
	'errorView',
	'csrf',
	'reCAPTCHA',
	'rateLimit',
	'url'
];

var allowedModelKeys = [
	'maxlen',
	'max',
	'minlen',
	'min',
	'required',
	'default',
	'type',
	'values',
	'unique',
	'access'
];

var Admin = {
	init: function (app) {
		this.setupRoutes(app);
	},

	setupRoutes: function (app) {

		app.server.get("/admin/views", function (req, res) {
			var f = ff(this, function () {
				app.fs.readdir(path.join(app.dir, app.config.views), f.slot())
			}, function (dirs) {
				//remove directories from list
				for (var i = 0; i < dirs.length; ++i) {
					if (dirs[i].indexOf(".") == -1) {
						dirs.splice(i--, 1);
					}
				}

				res.json(dirs);
			});
		});

		app.server.get("/admin/views/:name", function (req, res) {
			ff(function () {
				var p = path.join(app.dir, app.config.views, req.params.name + "." + app.config.extension)
				app.fs.readFile(p, this.slot());
			}).cb(function (err, content) {
				if (err) {
					return res.status(500).json([{message: "No view found."}]);
				}

				res.json(content.toString());
			});
		});

		app.server.get("/admin/structure", function (req, res) {
			res.json(app.structure)
		});

		app.server.get("/admin/controller", function (req, res) {
			res.json(app.controller)
		});

		app.server.get("/admin/config", function (req, res) {
			var hash = {};
			for (var i = 0; i < allowedConfigKeys.length; ++i) {
				hash[allowedConfigKeys[i]] = app.config[allowedConfigKeys[i]] || "";
			}

			res.json(hash)
		});

		app.server.get("/admin/permissions", function (req, res) {
			res.json(app.permissions)
		});

		app.server.post("/admin/views", function (req, res) {
			console.log(app.dir, app.config.views, req.body.name + "." + app.config.extension)
			var p = path.join(app.dir, app.config.views, req.body.name + "." + app.config.extension);
			var basename = path.basename(req.body.name);

			if (!Validation.testFieldName(basename)) {
				return res.status(500).json([{message: "Invalid template name"}]);
			}

			var f = ff(this, function () {
				if (app.config.type === "free") {
					app.fs.readdir(path.join(app.dir, app.config.views), f.slot());
				}
			}, function (views) {
				if (views && views.length > 8 && app.config.type === "free") {
					return f.fail("Reached page limit. Upgrade to premium for unlimited pages.");
				}

				app.fs.writeFile(p, req.body.content, f.slot());
			}, function () {
				res.json("ok");
				app.reload();	
			}).error(function (err) {
				res.json(500, [{message: err}]);
			});	
		});

		app.server.delete("/admin/views/:name", function (req, res) {
			var name = req.params.name;

			var p = path.join(app.dir, app.config.views, name + "." + app.config.extension);
			app.fs.unlink(p);

			res.json("ok");
			app.reload();
		});

		app.server.post("/admin/models", function (req, res) {
			var d = req.body.content;
			var name = req.body.name;

			if (!d) {
				d = {};
			}

			var errors = [];

			// validate model name
			if (!Validation.testFieldName(name)) {
				errors.push({message: "Model name is invalid."});
			}

			// validate the new model
			for (var key in d) {
				if (!Validation.testFieldName(key)) {
					errors.push({message: "Field name `"+key+"` is invalid."});
					break;
				}

				var model = d[key];
				for (var field in model) {
					// remove unrecognized keys
					if (allowedModelKeys.indexOf(field) == -1) {
						delete model[field];
					}
				}

				if (model.values && !Array.isArray(model.values)) {
					errors.push({message: "Values must be a list of values."});
					break;
				}

				if (!model.access || !model.access.w || !model.access.r) {
					errors.push({message: "Access controls invalid."});
					break;
				}
			}
			
			if (errors.length) {
				return res.status(500).json(errors);
			}

			console.log(d)
			app.structure[name] = d;

			var p = path.join(app.dir, app.config.models, req.body.name + ".json");
			app.fs.writeFile(p, JSON.stringify(d, null, '\t'), function () {
				res.json("ok");
				app.reload();
			});
		});

		app.server.delete("/admin/models/:name", function (req, res) {
			var name = req.params.name;
			if (name == "users") {
				return res.send(500);
			}

			var p = path.join(app.dir, app.config.models, name + ".json");
			app.fs.unlink(p);
			delete app.structure[name];

			res.json("ok");
			app.reload();
		});

		app.server.post("/admin/config", function (req, res) {
			var c = req.body;

			if (c.url) {
				// normalize url
				c.url = c.url.trim();
				c.url = c.url.replace(/http(s)?:\/\/(www\.)?/g, "");
				c.url = c.url.split(/\/|\?/)[0];

				// if not subdomain
				if (app.config.url.indexOf(".sapling.io") == -1 &&
					app.config.url !== c.url) {

					console.log("Subdomain remove", app.config.url)
					connection.remove("cache", "url:" + app.config.url);
				}

				if (app.config.url !== c.url) {
					var f = ff(this, function () {
						connection.get("cache", "url:" + c.url, f.slotPlain(2));
					}, function (err, space) {
						console.log("SAVE", !!(err || !space), err, space, c.url, app.name)
						if (err || !space) {
							connection.save("cache", "url:" + c.url, app.name);
						} else {
							c.url = "";
						}
					});
				}
			}

			for (var key in c) {
				if (allowedConfigKeys.indexOf(key) == -1) {
					console.error("Illegal key", key)
					continue;
				}

				app.config[key] = c[key];
			}

			app.fs.writeFile(path.join(app.dir, "config.json"), JSON.stringify(app.config, null, '\t'), function () {
				res.json("ok");
				app.reload();	
			});
		});

		app.server.post("/admin/permissions", function (req, res) {
			var c = req.body;

			for (var key in c) {
				if (!key) { continue; }
				app.permissions[key] = c[key];
			}

			app.fs.writeFile(path.join(app.dir, "permissions.json"), JSON.stringify(app.permissions, null, '\t'), function () {
				res.json("ok");
				app.reload();	
			});
		});

		app.server.delete("/admin/permissions", function (req, res) {
			var c = req.body;
			console.log(c)
			delete app.permissions[c.route];
			
			app.fs.writeFile(path.join(app.dir, "permissions.json"), JSON.stringify(app.permissions, null, '\t'), function () {
				res.json("ok");
				app.reload();	
			});
		});

		app.server.post("/admin/controller", function (req, res) {
			var c = req.body;

			for (var key in c) {
				if (!key) {
					return res.status(500).json([{message: "Route must not be empty"}]);
				}

				if (!c[key]) {
					return res.status(500).json([{message: "Page must not be empty"}]);
				}

				app.controller[key] = c[key];
			}

			app.fs.writeFile(path.join(app.dir, "controller.json"), JSON.stringify(app.controller, null, '\t'), function () {
				res.json("ok");
				app.reload();				
			});
		});

		app.server.delete("/admin/controller", function (req, res) {
			var c = req.body;
			
			if (!c.route) {
				return res.status(500).json([{message: "Route must exist"}])
			}

			delete app.controller[c.route];
			
			app.fs.writeFile(path.join(app.dir, "controller.json"), JSON.stringify(app.controller, null, '\t'), function () {
				res.json("ok");
				app.reload();				
			});
		});
	}
};

module.exports = Admin;