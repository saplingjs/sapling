/**
 * Load controller
 */


/* Dependencies */
const fs = require("fs");
const path = require("path");

const { console } = require("../lib/Cluster");
const Templating = require("../lib/Templating");


/**
 * Load the controller JSON file into routes.
 * 
 * @param {function} next Chain callback
 */
module.exports = async function loadController(next) {
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
};
