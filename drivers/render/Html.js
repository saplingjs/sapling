/**
 * HTML driver for Sapling
 *
 * A simple fallback render driver that just loads the HTML files
 * its given.
 */

/* Dependencies */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import _ from 'underscore';
import SaplingError from '../../lib/SaplingError.js';
import Interface from './Interface.js';


/**
 * The HTML class
 */
export default class HTML extends Interface {
	/**
	 * Initialise HTML
	 */
	constructor(App, viewsPath) {
		super();
		this.app = App;
		this.viewsPath = viewsPath;
	}


	/**
	 * Render a template file
	 *
	 * @param {string} template Path of the template file being rendered, relative to root
	 * @param {object} data Object of data to pass to the template
	 */
	async render(template, data) {
		/* Read the template file */
		let html = '';
		try {
			html = await fs.readFile(path.resolve(this.viewsPath, template), 'utf8');
		} catch (error) {
			return new SaplingError(error);
		}

		/* Do some rudimentary var replacement */
		html = html.replace(/{{ ?([\w.]+) ?(?:\| ?safe ?)?}}/gi, (tag, identifier) =>
			/* Return either matching data, or the tag literal */
			_.get(data, identifier, tag),
		);

		return html;
	}


	/**
	 * Register custom tags with the template engine
	 */
	registerTags() {
		return true;
	}
}
