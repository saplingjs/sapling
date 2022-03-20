/**
 * Load controller
 */

/* Dependencies */
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { console } from '../lib/Cluster.js';
import Templating from '../lib/Templating.js';


/**
 * Digest controller.json and/or views directory for the controller
 *
 * @returns {object} Controller
 */
export async function digest() {
	let controller = {};

	/* Generate a controller from the available views */
	if ((this.config.autoRouting === 'on' || this.config.autoRouting === true) && this.config.viewsDir !== null) {
		const viewsPath = path.join(this.dir, this.config.viewsDir);

		if (await this.utils.exists(viewsPath)) {
			const viewsLstat = await fs.lstat(viewsPath);

			if (viewsLstat.isDirectory()) {
				/* Load all views in the views directory */
				const views = await this.utils.getFiles(viewsPath);

				/* Go through each view */
				for (const view_ of views) {
					const segments = path.relative(this.dir, view_).split('/');

					/* Filter out the views where any segment begins with _ */
					const protectedSegments = segments.filter(item => {
						const re = /^_/;
						return re.test(item);
					});

					if (protectedSegments.length > 0) {
						continue;
					}

					/* Filter out any files that do not use the correct file extension */
					if (this.config.extension !== null && view_.split('.').slice(-1)[0] !== this.config.extension) {
						continue;
					}

					/* Filter out filesystem bits */
					const view = view_.replace(path.resolve(this.dir, this.config.viewsDir), '').replace(`.${this.config.extension}`, '');
					let route = view.replace('/index', '');

					/* Make sure root index is a slash and not an empty key */
					if (route === '') {
						route = '/';
					}

					/* Create an automatic GET route for a given view */
					controller[route] = view.replace(/^\/+/g, '');
				}
			}
		}
	}

	/* Location of the controller file */
	const controllerPath = path.join(this.dir, this.config.routes || '');

	/* Load the controller file */
	if (await this.utils.exists(controllerPath)) {
		const controllerLstat = await fs.lstat(controllerPath);

		if (controllerLstat.isFile()) {
			/* Parse and merge the controller, or throw an error if it's malformed */
			try {
				/* Load the controller file */
				const file = await fs.readFile(controllerPath);
				const routes = JSON.parse(file.toString());

				/* Remove file extension */
				for (const route of Object.keys(routes)) {
					routes[route] = routes[route].split('.').slice(0, -1).join('.');
				}

				/* Merge routes if autorouting, replace routes if not */
				if (this.config.autoRouting === 'on' || this.config.autoRouting === true) {
					Object.assign(controller, routes);
				} else {
					controller = routes;
				}
			} catch (error) {
				console.error(`Controller at path: \`${controllerPath}\` could not be loaded.`, error);
			}
		}
	}

	return controller;
}


/**
 * Load the controller JSON file into routes.
 *
 * @param {function} next Chain callback
 */
export default async function loadController(next) {
	/* Load templating engine */
	this.templating = new Templating(this);
	await this.templating.importDriver();

	/* Digest controller */
	this.controller = await digest.call(this, this.config);
	console.log('CONTROLLER', this.controller);

	if (next) {
		next();
	}
}
